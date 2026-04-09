import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { hasCompleteClassMemberProfileForExamPg } from '@/lib/db/classes-pg'
import {
  fetchExamAttemptOpenForDraftPg,
  fetchExamQuestionOptionsForSessionPg,
  fetchExamSessionActiveByCodeForDraftPg,
  updateExamAttemptDraftAnswersPg,
} from '@/lib/db/exam-session-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { verifyExamLayoutToken } from '@/lib/exam-layout-token'
import { CLASS_ENROLLMENT_ERROR_VI } from '@/lib/lop/require-class-enrollment'
import { isPublicExamEssayImageUrl } from '@/lib/exam-essay-config'
import { isServerDeadlinePassed } from '@/lib/exam-session/finalize-overdue-exam-attempt'

const MAX_ESSAY_TEXT = 12000
const MAX_IMAGES_PER_ESSAY = 10

function normalizeEssayDraft(
  raw: unknown,
  essayQuestionIds: Set<string>
): Record<string, { text: string; imageUrls: string[] }> {
  const out: Record<string, { text: string; imageUrls: string[] }> = {}
  if (!raw || typeof raw !== 'object') return out
  const o = raw as Record<string, unknown>
  for (const qid of essayQuestionIds) {
    const v = o[qid]
    if (!v || typeof v !== 'object') continue
    const rec = v as Record<string, unknown>
    const text = String(rec.text ?? '').trim().slice(0, MAX_ESSAY_TEXT)
    const urlsRaw = rec.imageUrls
    const imageUrls: string[] = []
    if (Array.isArray(urlsRaw)) {
      for (const u of urlsRaw) {
        const s = String(u ?? '').trim()
        if (!isPublicExamEssayImageUrl(s)) continue
        if (imageUrls.length >= MAX_IMAGES_PER_ESSAY) break
        if (!imageUrls.includes(s)) imageUrls.push(s)
      }
    }
    out[qid] = { text, imageUrls }
  }
  return out
}

/** Lưu nháp đáp án trong lúc làm (debounce phía client). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const auth = await getUserForAction('Vui lòng đăng nhập.')
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }
    const user = auth.user

    const { code } = await params
    if (!code || code.length < 4) {
      return NextResponse.json({ error: 'Mã bài thi không hợp lệ.' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    const layoutToken = String(body?.layoutToken ?? '').trim()
    const answers = body?.answers
    if (!layoutToken) {
      return NextResponse.json({ error: 'Thiếu layoutToken.' }, { status: 400 })
    }
    if (!answers || typeof answers !== 'object') {
      return NextResponse.json({ error: 'Thiếu answers.' }, { status: 400 })
    }

    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Chưa cấu hình cơ sở dữ liệu.' }, { status: 503 })
    }

    const codeUpper = code.toUpperCase()
    const sessionRow = await fetchExamSessionActiveByCodeForDraftPg(codeUpper)
    if (sessionRow === null) {
      return NextResponse.json({ error: 'Lỗi đọc bài thi.' }, { status: 500 })
    }
    if (sessionRow === 'not_found') {
      return NextResponse.json({ error: 'Không tìm thấy bài thi.' }, { status: 404 })
    }

    const layout = await verifyExamLayoutToken(layoutToken)
    if (!layout || layout.sessionId !== String(sessionRow.id) || layout.userId !== user.id) {
      return NextResponse.json(
        { error: 'Phiên làm bài không hợp lệ hoặc đã hết hạn.' },
        { status: 400 }
      )
    }

    if (sessionRow.class_id) {
      const ok = await hasCompleteClassMemberProfileForExamPg(String(sessionRow.class_id), user.id)
      if (ok === null) {
        return NextResponse.json({ error: 'Lỗi kiểm tra tham gia lớp.' }, { status: 500 })
      }
      if (!ok) {
        return NextResponse.json({ error: CLASS_ENROLLMENT_ERROR_VI }, { status: 403 })
      }
    }

    const attemptState = await fetchExamAttemptOpenForDraftPg(sessionRow.id, user.id)
    if (attemptState === null) {
      return NextResponse.json({ error: 'Lỗi đọc phiên làm bài.' }, { status: 500 })
    }
    if (attemptState === 'missing' || attemptState === 'submitted') {
      return NextResponse.json({ error: 'Không có phiên làm bài đang mở.' }, { status: 400 })
    }
    const attempt = attemptState

    const durationMin = sessionRow.duration_minutes
    if (
      isServerDeadlinePassed(
        attempt.deadline_at,
        attempt.started_at,
        durationMin,
        Date.now()
      )
    ) {
      return NextResponse.json(
        { error: 'Đã hết thời gian làm bài. Vui lòng tải lại trang.' },
        { status: 400 }
      )
    }

    const questions = await fetchExamQuestionOptionsForSessionPg(sessionRow.id)
    if (questions === null) {
      return NextResponse.json({ error: 'Lỗi đọc câu hỏi.' }, { status: 500 })
    }

    const questionRows = questions as Array<{ id: string; options?: unknown }>
    const scorableQuestionIds = new Set(
      questionRows
        .filter((q) => {
          const opts = Array.isArray(q.options) ? q.options : []
          return opts.length >= 2
        })
        .map((q) => String(q.id))
    )
    const essayQuestionIds = new Set(
      questionRows
        .filter((q) => !scorableQuestionIds.has(String(q.id)))
        .map((q) => String(q.id))
    )

    const mergedEssay = normalizeEssayDraft(body?.essaySubmission, essayQuestionIds)
    for (const qid of essayQuestionIds) {
      if (!mergedEssay[qid]) mergedEssay[qid] = { text: '', imageUrls: [] }
      const textFromAnswer =
        typeof (answers as Record<string, unknown>)[qid] === 'string'
          ? String((answers as Record<string, unknown>)[qid]).trim().slice(0, MAX_ESSAY_TEXT)
          : ''
      if (textFromAnswer && !mergedEssay[qid].text) {
        mergedEssay[qid] = { ...mergedEssay[qid], text: textFromAnswer }
      }
    }

    const updated = await updateExamAttemptDraftAnswersPg(attempt.id, user.id, answers, mergedEssay)
    if (updated === null) {
      return NextResponse.json({ error: 'Lưu nháp thất bại.' }, { status: 500 })
    }
    if (!updated) {
      return NextResponse.json({ error: 'Không có phiên làm bài đang mở.' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[exam-draft]', msg)
    return NextResponse.json({ error: `Lỗi: ${msg}` }, { status: 500 })
  }
}
