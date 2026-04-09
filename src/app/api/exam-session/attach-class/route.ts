import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getUserForAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import {
  deleteExamSessionByIdPg,
  examSessionCodeTakenPg,
  existsExamDuplicateAttachPg,
  fetchClassForAttachExamPg,
  fetchExamQuestionsForAttachCopyPg,
  fetchExamSessionByIdForTeacherPg,
  insertExamQuestionsBulkAttachPg,
  insertExamSessionAttachPg,
  insertExamSessionAttachWithoutLineagePg,
} from '@/lib/db/exam-session-admin-pg'
import { defaultPublicOrigin } from '@/lib/public-app-origin'

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

const ALLOWED_EXAM_TYPES = new Set(['15ph', '1tiet', 'hocky', 'totnghiep'])

function numOr(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
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
  return requestOrigin.startsWith('http') ? requestOrigin : defaultPublicOrigin()
}

/** Tạo bản sao phiên thi (cùng câu hỏi) gắn lớp khác — mã & QR mới. */
export async function POST(req: NextRequest) {
  try {
    const authResult = await getUserForAction()
    if ('error' in authResult) return NextResponse.json({ error: authResult.error }, { status: 401 })
    const { user } = authResult

    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Chưa cấu hình cơ sở dữ liệu.' }, { status: 503 })
    }

    const body = await req.json().catch(() => ({}))
    const sourceSessionId = String(body?.sourceSessionId ?? '').trim()
    const classId = String(body?.classId ?? '').trim()
    if (!sourceSessionId || !classId) {
      return NextResponse.json({ error: 'Thiếu phiên nguồn hoặc lớp.' }, { status: 400 })
    }

    const clsFetch = await fetchClassForAttachExamPg(classId, user.id)
    if (clsFetch === null) {
      return NextResponse.json({ error: 'Không thể đọc lớp.' }, { status: 503 })
    }
    if (clsFetch === 'not_found') {
      return NextResponse.json({ error: 'Không tìm thấy lớp.' }, { status: 404 })
    }
    if (clsFetch === 'forbidden') {
      return NextResponse.json({ error: 'Bạn không quản lý lớp này.' }, { status: 403 })
    }
    const cls = clsFetch

    const src = await fetchExamSessionByIdForTeacherPg(sourceSessionId, user.id)
    if (src === null) {
      return NextResponse.json({ error: 'Không thể đọc phiên thi.' }, { status: 503 })
    }
    if (src === 'not_found') {
      return NextResponse.json({ error: 'Không tìm thấy bài thi hoặc không thuộc tài khoản của bạn.' }, { status: 404 })
    }

    const questions = await fetchExamQuestionsForAttachCopyPg(sourceSessionId)
    if (questions === null) {
      return NextResponse.json({ error: 'Không thể đọc câu hỏi.' }, { status: 500 })
    }
    if (questions.length === 0) {
      return NextResponse.json({ error: 'Phiên thi không có câu hỏi để sao chép.' }, { status: 400 })
    }

    const srcRow = src as { id: string; exam_lineage_root_id?: string | null }
    const lineageRootId = String(srcRow.exam_lineage_root_id ?? srcRow.id).trim()

    const dupCheck = await existsExamDuplicateAttachPg({
      teacherId: user.id,
      classId,
      lineageRootId,
    })
    if (dupCheck === null) {
      return NextResponse.json({ error: 'Không thể kiểm tra trùng lặp.' }, { status: 503 })
    }
    if (dupCheck) {
      return NextResponse.json(
        { error: 'Lớp này đã được gắn bài thi này (cùng bộ câu hỏi).' },
        { status: 409 }
      )
    }

    let code = generateCode()
    for (let attempt = 0; attempt < 20; attempt++) {
      const taken = await examSessionCodeTakenPg(code)
      if (taken === null) {
        return NextResponse.json({ error: 'Không thể tạo mã bài thi.' }, { status: 503 })
      }
      if (!taken) break
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
    const minutesPerQuestion = Math.max(
      0.1,
      Math.round(numOr((src as { minutes_per_question?: unknown }).minutes_per_question, 1) * 10) / 10
    )

    const practiceHomework = Boolean((src as { is_practice_homework?: boolean }).is_practice_homework)
    const baseParams = {
      code,
      teacherId: user.id,
      title: String((src as { title?: string }).title ?? 'Bài thi').slice(0, 500),
      examType,
      subjectId: String((src as { subject_id?: string }).subject_id ?? 'toan').slice(0, 200),
      gradeLevelId: String((src as { grade_level_id?: string }).grade_level_id ?? 'lop-12').slice(0, 200),
      classId,
      schoolId,
      durationMinutes,
      minutesPerQuestion,
      config: (nextConfig ?? {}) as Record<string, unknown>,
      practiceHomework,
    }

    const firstIns = await insertExamSessionAttachPg({ ...baseParams, lineageRootId })
    let newSessionId: string | null = null
    if (firstIns && 'id' in firstIns && firstIns.id) {
      newSessionId = firstIns.id
    } else if (firstIns && 'retryWithoutLineage' in firstIns && firstIns.retryWithoutLineage) {
      console.warn('[exam-session/attach-class] insert without exam_lineage_root_id:', firstIns.error)
      const second = await insertExamSessionAttachWithoutLineagePg(baseParams)
      newSessionId = second?.id ?? null
    }

    if (!newSessionId) {
      console.error('[exam-session/attach-class] insert session')
      return NextResponse.json(
        {
          error: 'Không tạo được phiên thi mới.',
          debug: process.env.NODE_ENV === 'development' ? 'insert failed' : undefined,
        },
        { status: 500 }
      )
    }
    const insQuestions = await insertExamQuestionsBulkAttachPg(newSessionId, questions)
    if (insQuestions !== true) {
      console.error('[exam-session/attach-class] insert questions')
      await deleteExamSessionByIdPg(newSessionId)
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
      totalQuestions: questions.length,
      durationMinutes: (src as { duration_minutes?: number }).duration_minutes ?? 15,
      className: String(cls.name ?? ''),
      schoolName: String(cls.school_name ?? ''),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
