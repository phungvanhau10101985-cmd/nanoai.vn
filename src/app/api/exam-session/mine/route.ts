import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createAdminClient } from '@supabase/supabase-js'

type SessionRow = {
  id: string
  code: string
  title: string
  duration_minutes: number
  status: string
  created_at: string
  class_id: string | null
  school_id: string | null
  classes?: { name?: string | null } | Array<{ name?: string | null }> | null
  schools?: { name?: string | null } | Array<{ name?: string | null }> | null
}

function resolveBaseUrl(req: NextRequest): string {
  const envBaseRaw = String(
    process.env.NEXT_PUBLIC_SITE_URL
    || process.env.APP_URL
    || process.env.VERCEL_PROJECT_PRODUCTION_URL
    || process.env.VERCEL_URL
    || ''
  ).trim()
  const envBase = envBaseRaw
    ? (envBaseRaw.startsWith('http') ? envBaseRaw : `https://${envBaseRaw}`)
    : ''
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
    requestOrigin.startsWith('http')
    && !requestOrigin.includes('localhost')
    && !requestOrigin.includes('127.0.0.1')
  ) return requestOrigin
  if (envBase) return envBase
  return requestOrigin.startsWith('http') ? requestOrigin : 'https://nanoai.vn'
}

function buildExamUrl(baseUrl: string, code: string): string {
  return `${baseUrl}/lam-bai/${code}`
}

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
    if ('error' in authResult) return NextResponse.json({ error: authResult.error }, { status: 401 })
    const { user } = authResult

    const admin = getAdminClient()
    const baseUrl = resolveBaseUrl(req)
    const { data, error } = await admin
      .from('exam_sessions')
      .select('id, code, title, duration_minutes, status, created_at, class_id, school_id, classes(name), schools(name)')
      .eq('teacher_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const sessions = (data ?? []) as SessionRow[]
    const sessionIds = sessions.map((s) => s.id)

    const questionCounts = new Map<string, number>()
    if (sessionIds.length > 0) {
      const { data: questionRows, error: qErr } = await admin
        .from('exam_questions')
        .select('session_id')
        .in('session_id', sessionIds)
      if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })
      for (const row of questionRows ?? []) {
        const sid = String((row as { session_id?: unknown }).session_id ?? '')
        if (!sid) continue
        questionCounts.set(sid, (questionCounts.get(sid) ?? 0) + 1)
      }
    }

    const items = sessions.map((s) => ({
      id: s.id,
      code: s.code,
      title: s.title,
      status: s.status,
      durationMinutes: s.duration_minutes,
      totalQuestions: questionCounts.get(s.id) ?? 0,
      createdAt: s.created_at,
      examUrl: buildExamUrl(baseUrl, s.code),
      classId: s.class_id,
      schoolId: s.school_id,
      className: String((Array.isArray(s.classes) ? s.classes[0]?.name : s.classes?.name) ?? ''),
      schoolName: String((Array.isArray(s.schools) ? s.schools[0]?.name : s.schools?.name) ?? ''),
    }))

    return NextResponse.json({ items })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = createClient()
    const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
    if ('error' in authResult) return NextResponse.json({ error: authResult.error }, { status: 401 })
    const { user } = authResult

    const body = await req.json().catch(() => ({}))
    const code = String(body?.code ?? '').trim().toUpperCase()
    if (!code) return NextResponse.json({ error: 'Thiếu mã bài thi.' }, { status: 400 })

    const admin = getAdminClient()
    const { data: session, error: sessionErr } = await admin
      .from('exam_sessions')
      .select('id, teacher_id')
      .eq('code', code)
      .single()

    if (sessionErr || !session) return NextResponse.json({ error: 'Không tìm thấy bài thi.' }, { status: 404 })
    if (String(session.teacher_id ?? '') !== user.id) {
      return NextResponse.json({ error: 'Bạn không có quyền xóa bài thi này.' }, { status: 403 })
    }

    const sessionId = String(session.id)
    await admin.from('exam_attempts').delete().eq('session_id', sessionId)
    await admin.from('exam_questions').delete().eq('session_id', sessionId)
    const { error: deleteSessionErr } = await admin.from('exam_sessions').delete().eq('id', sessionId)
    if (deleteSessionErr) return NextResponse.json({ error: deleteSessionErr.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
