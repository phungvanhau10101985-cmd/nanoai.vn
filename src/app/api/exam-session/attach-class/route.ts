import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

function joinedSchoolName(schools: unknown): string {
  if (schools == null) return ''
  if (Array.isArray(schools)) {
    const row = schools[0] as { name?: string | null } | undefined
    return String(row?.name ?? '')
  }
  const row = schools as { name?: string | null }
  return String(row.name ?? '')
}

const ALLOWED_EXAM_TYPES = new Set(['15ph', '1tiet', 'hocky', 'totnghiep'])

function numOr(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

/** DB / PostgREST chưa có cột lineage — insert lần đầu thất bại vì field lạ. */
function shouldRetryInsertWithoutLineage(err: { message?: string } | null): boolean {
  if (!err?.message) return false
  return err.message.toLowerCase().includes('exam_lineage_root_id')
}

function resolveBaseUrl(req: NextRequest): string {
  const envBaseRaw = String(
    process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.APP_URL ||
      process.env.VERCEL_PROJECT_PRODUCTION_URL ||
      process.env.VERCEL_URL ||
      ''
  ).trim()
  const envBase = envBaseRaw ? (envBaseRaw.startsWith('http') ? envBaseRaw : `https://${envBaseRaw}`) : ''
  const envIsLocal = envBase.includes('localhost') || envBase.includes('127.0.0.1')

  const forwardedHostRaw = String(req.headers.get('x-forwarded-host') || '').trim()
  const forwardedHost = forwardedHostRaw.split(',')[0]?.trim() || ''
  const forwardedProtoRaw = String(req.headers.get('x-forwarded-proto') || '').trim()
  const forwardedProto = (forwardedProtoRaw.split(',')[0]?.trim() || 'https').toLowerCase()
  if (forwardedHost) {
    const isLocal = forwardedHost.includes('localhost') || forwardedHost.includes('127.0.0.1')
    if (isLocal && envBase && !envIsLocal) return envBase
    return `${isLocal ? 'http' : forwardedProto}://${forwardedHost}`
  }

  const host = String(req.headers.get('host') || '').trim()
  if (host) {
    const proto = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https'
    if ((host.includes('localhost') || host.includes('127.0.0.1')) && envBase && !envIsLocal) return envBase
    return `${proto}://${host}`
  }

  const requestOrigin = String(req.nextUrl.origin || '').trim()
  if (
    requestOrigin.startsWith('http') &&
    !requestOrigin.includes('localhost') &&
    !requestOrigin.includes('127.0.0.1')
  )
    return requestOrigin
  if (envBase) return envBase
  return requestOrigin.startsWith('http') ? requestOrigin : 'https://nanoai.vn'
}

/** Tạo bản sao phiên thi (cùng câu hỏi) gắn lớp khác — mã & QR mới. */
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
    if ('error' in authResult) return NextResponse.json({ error: authResult.error }, { status: 401 })
    const { user } = authResult

    const body = await req.json().catch(() => ({}))
    const sourceSessionId = String(body?.sourceSessionId ?? '').trim()
    const classId = String(body?.classId ?? '').trim()
    if (!sourceSessionId || !classId) {
      return NextResponse.json({ error: 'Thiếu phiên nguồn hoặc lớp.' }, { status: 400 })
    }

    const admin = getAdminClient()

    const { data: cls, error: classErr } = await admin
      .from('classes')
      .select('id, teacher_id, school_id, name, schools(name)')
      .eq('id', classId)
      .single()

    if (classErr || !cls) return NextResponse.json({ error: 'Không tìm thấy lớp.' }, { status: 404 })
    if (String(cls.teacher_id ?? '') !== user.id) {
      return NextResponse.json({ error: 'Bạn không quản lý lớp này.' }, { status: 403 })
    }

    const { data: src, error: srcErr } = await admin
      .from('exam_sessions')
      .select('*')
      .eq('id', sourceSessionId)
      .eq('teacher_id', user.id)
      .single()

    if (srcErr || !src) {
      return NextResponse.json({ error: 'Không tìm thấy bài thi hoặc không thuộc tài khoản của bạn.' }, { status: 404 })
    }

    const { data: qRows, error: qErr } = await admin
      .from('exam_questions')
      .select('question_text, options, correct_index, order, source, worksheet_question_id, points')
      .eq('session_id', sourceSessionId)
      .order('order', { ascending: true })

    if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })
    const questions = qRows ?? []
    if (questions.length === 0) {
      return NextResponse.json({ error: 'Phiên thi không có câu hỏi để sao chép.' }, { status: 400 })
    }

    const srcRow = src as { id: string; exam_lineage_root_id?: string | null }
    const lineageRootId = String(srcRow.exam_lineage_root_id ?? srcRow.id).trim()

    const { data: dupByLineage } = await admin
      .from('exam_sessions')
      .select('id')
      .eq('teacher_id', user.id)
      .eq('class_id', classId)
      .eq('exam_lineage_root_id', lineageRootId)
      .limit(1)
      .maybeSingle()

    const { data: dupRootRow } = await admin
      .from('exam_sessions')
      .select('id')
      .eq('teacher_id', user.id)
      .eq('class_id', classId)
      .eq('id', lineageRootId)
      .limit(1)
      .maybeSingle()

    if (dupByLineage?.id || dupRootRow?.id) {
      return NextResponse.json(
        { error: 'Lớp này đã được gắn bài thi này (cùng bộ câu hỏi).' },
        { status: 409 }
      )
    }

    let code = generateCode()
    for (let attempt = 0; attempt < 20; attempt++) {
      const { data: dup } = await admin.from('exam_sessions').select('id').eq('code', code).maybeSingle()
      if (!dup) break
      code = generateCode()
    }

    const schoolId = cls.school_id ? String(cls.school_id) : null
    const prevConfig = src.config
    const nextConfig =
      prevConfig && typeof prevConfig === 'object' && !Array.isArray(prevConfig)
        ? { ...(prevConfig as Record<string, unknown>), classId, schoolId }
        : prevConfig

    const rawExamType = String((src as { exam_type?: string }).exam_type ?? '15ph')
    const examType = ALLOWED_EXAM_TYPES.has(rawExamType) ? rawExamType : '15ph'
    const durationMinutes = Math.max(1, Math.round(numOr((src as { duration_minutes?: unknown }).duration_minutes, 15)))
    const minutesPerQuestion = Math.max(0.1, Math.round(numOr((src as { minutes_per_question?: unknown }).minutes_per_question, 1) * 10) / 10)

    const practiceHomework = Boolean((src as { is_practice_homework?: boolean }).is_practice_homework)
    const baseRow = {
      code,
      teacher_id: user.id,
      title: String((src as { title?: string }).title ?? 'Bài thi').slice(0, 500),
      exam_type: examType,
      subject_id: String((src as { subject_id?: string }).subject_id ?? 'toan').slice(0, 200),
      grade_level_id: String((src as { grade_level_id?: string }).grade_level_id ?? 'lop-12').slice(0, 200),
      class_id: classId,
      school_id: schoolId,
      duration_minutes: durationMinutes,
      minutes_per_question: minutesPerQuestion,
      config: (nextConfig ?? {}) as Record<string, unknown>,
      status: 'active' as const,
      is_practice_homework: practiceHomework,
    }

    let { data: session, error: sessionErr } = await admin
      .from('exam_sessions')
      .insert({ ...baseRow, exam_lineage_root_id: lineageRootId })
      .select('id')
      .single()

    if (sessionErr && shouldRetryInsertWithoutLineage(sessionErr)) {
      console.warn('[exam-session/attach-class] insert without exam_lineage_root_id:', sessionErr.message)
      ;({ data: session, error: sessionErr } = await admin.from('exam_sessions').insert(baseRow).select('id').single())
    }

    if (sessionErr || !session?.id) {
      console.error('[exam-session/attach-class] insert session', sessionErr?.message, sessionErr?.code, sessionErr?.details)
      return NextResponse.json(
        {
          error: 'Không tạo được phiên thi mới.',
          debug: process.env.NODE_ENV === 'development' ? sessionErr?.message : undefined,
        },
        { status: 500 }
      )
    }

    const newSessionId = String(session.id)
    const inserts = questions.map((q: Record<string, unknown>, idx: number) => ({
      session_id: newSessionId,
      question_text: String(q.question_text ?? ''),
      options: Array.isArray(q.options) ? q.options : q.options ?? [],
      correct_index: typeof q.correct_index === 'number' ? q.correct_index : Number(q.correct_index) || 0,
      order: typeof q.order === 'number' ? q.order : idx,
      source: q.source != null ? String(q.source) : 'official',
      worksheet_question_id: q.worksheet_question_id != null ? String(q.worksheet_question_id) : null,
      points:
        typeof q.points === 'number' && Number.isFinite(q.points)
          ? q.points
          : Math.max(0.25, Number(q.points) || 1),
    }))

    const { error: insErr } = await admin.from('exam_questions').insert(inserts)
    if (insErr) {
      console.error('[exam-session/attach-class] insert questions', insErr.message)
      await admin.from('exam_sessions').delete().eq('id', newSessionId)
      return NextResponse.json({ error: 'Không sao chép được câu hỏi.' }, { status: 500 })
    }

    const baseUrl = resolveBaseUrl(req)
    const examUrl = `${baseUrl}/lam-bai/${code}`
    revalidatePath(`/lop/${classId}`)

    return NextResponse.json({
      success: true,
      code,
      examUrl,
      sessionId: newSessionId,
      totalQuestions: inserts.length,
      durationMinutes: src.duration_minutes ?? 15,
      className: String(cls.name ?? ''),
      schoolName: joinedSchoolName(cls.schools),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
