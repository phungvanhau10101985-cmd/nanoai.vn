import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import {
  countExamQuestionsBySessionIdsPg,
  deleteExamSessionByCodeForTeacherPg,
  fetchExamSessionsMineForTeacherPg,
} from '@/lib/db/exam-session-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { defaultPublicOrigin } from '@/lib/public-app-origin'

function resolveBaseUrl(req: NextRequest): string {
  const envBaseRaw = String(
    process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.APP_URL ||
      process.env.VERCEL_PROJECT_PRODUCTION_URL ||
      process.env.VERCEL_URL ||
      ''
  ).trim()
  const envBase = envBaseRaw
    ? envBaseRaw.startsWith('http')
      ? envBaseRaw
      : `https://${envBaseRaw}`
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
    requestOrigin.startsWith('http') &&
    !requestOrigin.includes('localhost') &&
    !requestOrigin.includes('127.0.0.1')
  )
    return requestOrigin
  if (envBase) return envBase
  return requestOrigin.startsWith('http') ? requestOrigin : defaultPublicOrigin()
}

function buildExamUrl(baseUrl: string, code: string): string {
  return `${baseUrl}/lam-bai/${code}`
}

export async function GET(req: NextRequest) {
  try {
    const authResult = await getUserForAction()
    if ('error' in authResult) return NextResponse.json({ error: authResult.error }, { status: 401 })
    const { user } = authResult

    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Chưa cấu hình cơ sở dữ liệu.' }, { status: 503 })
    }

    const baseUrl = resolveBaseUrl(req)
    const only = String(req.nextUrl.searchParams.get('only') ?? '').toLowerCase()
    const onlyFilter: 'all' | 'homework' | 'exam' =
      only === 'homework' ? 'homework' : only === 'exam' ? 'exam' : 'all'

    const sessions = await fetchExamSessionsMineForTeacherPg(user.id, onlyFilter)
    if (sessions === null) {
      return NextResponse.json({ error: 'Không tải được danh sách bài thi.' }, { status: 500 })
    }

    const sessionIds = sessions.map((s) => s.id)
    const questionCounts = await countExamQuestionsBySessionIdsPg(sessionIds)
    if (questionCounts === null) {
      return NextResponse.json({ error: 'Không tải được số câu hỏi.' }, { status: 500 })
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
      className: String(s.class_name ?? ''),
      schoolName: String(s.school_name ?? ''),
      practiceHomework: s.is_practice_homework,
    }))

    return NextResponse.json({ items })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authResult = await getUserForAction()
    if ('error' in authResult) return NextResponse.json({ error: authResult.error }, { status: 401 })
    const { user } = authResult

    const body = await req.json().catch(() => ({}))
    const code = String(body?.code ?? '').trim().toUpperCase()
    if (!code) return NextResponse.json({ error: 'Thiếu mã bài thi.' }, { status: 400 })

    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Chưa cấu hình cơ sở dữ liệu.' }, { status: 503 })
    }

    const del = await deleteExamSessionByCodeForTeacherPg(code, user.id)
    if (del === null) {
      return NextResponse.json({ error: 'Không xóa được bài thi.' }, { status: 500 })
    }
    if (del === 'not_found') {
      return NextResponse.json({ error: 'Không tìm thấy bài thi.' }, { status: 404 })
    }
    if (del === 'forbidden') {
      return NextResponse.json({ error: 'Bạn không có quyền xóa bài thi này.' }, { status: 403 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
