import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getUserForAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import {
  deleteExamSessionByIdPg,
  examSessionCodeTakenPg,
  fetchClassForAttachExamPg,
  fetchExamQuestionsForAttachCopyPg,
  insertExamQuestionsBulkAttachPg,
  insertExamSessionAttachPg,
  insertExamSessionAttachWithoutLineagePg,
} from '@/lib/db/exam-session-admin-pg'
import { fetchExamPresetSourcePg, findTeacherExamCopyPg } from '@/lib/db/exam-preset-pg'
import { defaultPublicOrigin } from '@/lib/public-app-origin'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ALLOWED_EXAM_TYPES = new Set(['15ph', '1tiet', 'hocky', 'totnghiep'])

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

function numOr(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function resolveBaseUrl(req: NextRequest): string {
  const host = String(req.headers.get('x-forwarded-host') || req.headers.get('host') || '').split(',')[0]?.trim() || ''
  if (!host) return defaultPublicOrigin()
  const local = host.includes('localhost') || host.startsWith('127.')
  const proto = local ? 'http' : String(req.headers.get('x-forwarded-proto') || 'https').split(',')[0]?.trim() || 'https'
  return `${proto}://${host}`
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getUserForAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth
    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Chưa cấu hình cơ sở dữ liệu.' }, { status: 503 })
    }
    const body = await req.json().catch(() => ({}))
    const sourceSessionId = String(body?.sourceSessionId ?? '').trim()
    const classId = String(body?.classId ?? '').trim()
    const requestedSchoolId = String(body?.schoolId ?? '').trim()
    const titleOverride = String(body?.title ?? '').trim()
    if (!UUID_RE.test(sourceSessionId) || !UUID_RE.test(classId)) {
      return NextResponse.json({ error: 'Thiếu đề hoặc lớp.' }, { status: 400 })
    }

    const cls = await fetchClassForAttachExamPg(classId, user.id)
    if (cls === null) return NextResponse.json({ error: 'Không thể đọc lớp.' }, { status: 503 })
    if (cls === 'not_found') return NextResponse.json({ error: 'Không tìm thấy lớp.' }, { status: 404 })
    if (cls === 'forbidden') return NextResponse.json({ error: 'Bạn không quản lý lớp này.' }, { status: 403 })

    const src = await fetchExamPresetSourcePg(sourceSessionId)
    if (src === null) return NextResponse.json({ error: 'Không thể đọc đề.' }, { status: 503 })
    if (src === 'not_found') return NextResponse.json({ error: 'Không tìm thấy đề.' }, { status: 404 })

    const lineageRootId = String(src.exam_lineage_root_id ?? src.id ?? sourceSessionId).trim()
    const existing = await findTeacherExamCopyPg({
      teacherId: user.id,
      classId,
      lineageRootId,
    })
    const schoolId = cls.school_id ? String(cls.school_id) : requestedSchoolId || null
    if (existing?.code) {
      return NextResponse.json({
        success: true,
        reused: true,
        code: existing.code,
        examUrl: `${resolveBaseUrl(req)}/lam-bai/${existing.code}`,
        sessionId: existing.id,
        totalQuestions: existing.totalQuestions,
        durationMinutes: existing.durationMinutes,
        title: titleOverride || existing.title,
        classId,
        schoolId,
        className: String(cls.name ?? ''),
        schoolName: String(cls.school_name ?? ''),
      })
    }

    const questions = await fetchExamQuestionsForAttachCopyPg(sourceSessionId)
    if (questions === null) return NextResponse.json({ error: 'Không thể đọc câu hỏi.' }, { status: 500 })
    if (questions.length === 0) return NextResponse.json({ error: 'Đề không có câu hỏi.' }, { status: 400 })

    let code = generateCode()
    for (let attempt = 0; attempt < 20; attempt++) {
      const taken = await examSessionCodeTakenPg(code)
      if (taken === null) return NextResponse.json({ error: 'Không thể tạo mã bài thi.' }, { status: 503 })
      if (!taken) break
      code = generateCode()
    }

    const prevConfig = src.config
    const nextConfig = prevConfig && typeof prevConfig === 'object' && !Array.isArray(prevConfig)
      ? { ...(prevConfig as Record<string, unknown>), classId, schoolId, presetSourceId: sourceSessionId }
      : { classId, schoolId, presetSourceId: sourceSessionId }
    const rawExamType = String(src.exam_type ?? '15ph')
    const examType = ALLOWED_EXAM_TYPES.has(rawExamType) ? rawExamType : '15ph'
    const title = (titleOverride || String(src.title ?? 'Bài thi')).slice(0, 500)
    const baseParams = {
      code,
      teacherId: user.id,
      title,
      examType,
      subjectId: String(src.subject_id ?? 'toan').slice(0, 200),
      gradeLevelId: String(src.grade_level_id ?? 'lop-12').slice(0, 200),
      classId,
      schoolId,
      durationMinutes: Math.max(1, Math.round(numOr(src.duration_minutes, 15))),
      minutesPerQuestion: Math.max(0.1, Math.round(numOr(src.minutes_per_question, 1) * 10) / 10),
      config: nextConfig,
      practiceHomework: false,
    }

    const firstIns = await insertExamSessionAttachPg({ ...baseParams, lineageRootId })
    let newSessionId: string | null = null
    if (firstIns && 'id' in firstIns && firstIns.id) newSessionId = firstIns.id
    else if (firstIns && 'retryWithoutLineage' in firstIns && firstIns.retryWithoutLineage) {
      const second = await insertExamSessionAttachWithoutLineagePg(baseParams)
      newSessionId = second?.id ?? null
    }
    if (!newSessionId) {
      return NextResponse.json({ error: 'Không tạo được đề cho lớp này.' }, { status: 500 })
    }
    const copied = await insertExamQuestionsBulkAttachPg(newSessionId, questions)
    if (copied !== true) {
      await deleteExamSessionByIdPg(newSessionId)
      return NextResponse.json({ error: 'Không sao chép được câu hỏi.' }, { status: 500 })
    }
    revalidatePath(`/lop/${classId}`)
    return NextResponse.json({
      success: true,
      reused: false,
      code,
      examUrl: `${resolveBaseUrl(req)}/lam-bai/${code}`,
      sessionId: newSessionId,
      totalQuestions: questions.length,
      durationMinutes: baseParams.durationMinutes,
      title,
      classId,
      schoolId,
      className: String(cls.name ?? ''),
      schoolName: String(cls.school_name ?? ''),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[exam-session/from-preset]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
