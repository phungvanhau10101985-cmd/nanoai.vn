import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { verifyExamLayoutToken } from '@/lib/exam-layout-token'
import { CLASS_ENROLLMENT_ERROR_VI, hasCompleteClassEnrollment } from '@/lib/lop/require-class-enrollment'
import { publicExamEssayImageUrlPrefix } from '@/lib/exam-essay-config'
import { isServerDeadlinePassed } from '@/lib/exam-session/finalize-overdue-exam-attempt'

const MAX_ESSAY_TEXT = 12000
const MAX_IMAGES_PER_ESSAY = 10

function normalizeEssayDraft(
  raw: unknown,
  essayQuestionIds: Set<string>,
  urlPrefix: string
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
        if (!s.startsWith(urlPrefix)) continue
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
    const serverSupabase = createServerClient()
    const { data: authData } = await serverSupabase.auth.getUser()
    const user = authData.user
    if (!user) {
      return NextResponse.json({ error: 'Vui lòng đăng nhập.' }, { status: 401 })
    }

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

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    const { data: session, error: sessionErr } = await supabase
      .from('exam_sessions')
      .select('id, class_id, duration_minutes')
      .eq('code', code.toUpperCase())
      .eq('status', 'active')
      .single()

    if (sessionErr || !session) {
      return NextResponse.json({ error: 'Không tìm thấy bài thi.' }, { status: 404 })
    }

    const layout = await verifyExamLayoutToken(layoutToken)
    if (!layout || layout.sessionId !== String(session.id) || layout.userId !== user.id) {
      return NextResponse.json(
        { error: 'Phiên làm bài không hợp lệ hoặc đã hết hạn.' },
        { status: 400 }
      )
    }

    if (session.class_id) {
      const ok = await hasCompleteClassEnrollment(supabase, String(session.class_id), user.id)
      if (!ok) {
        return NextResponse.json({ error: CLASS_ENROLLMENT_ERROR_VI }, { status: 403 })
      }
    }

    const { data: attempt, error: attErr } = await supabase
      .from('exam_attempts')
      .select('id, submitted_at, deadline_at, started_at')
      .eq('session_id', session.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (attErr || !attempt || attempt.submitted_at != null) {
      return NextResponse.json({ error: 'Không có phiên làm bài đang mở.' }, { status: 400 })
    }

    const durationMin =
      typeof session.duration_minutes === 'number' ? session.duration_minutes : 15
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

    const { data: questions } = await supabase
      .from('exam_questions')
      .select('id, options')
      .eq('session_id', session.id)

    const scorableQuestionIds = new Set(
      (questions ?? [])
        .filter((q) => {
          const opts = Array.isArray(q.options) ? q.options : []
          return opts.length >= 2
        })
        .map((q) => String(q.id))
    )
    const essayQuestionIds = new Set(
      (questions ?? [])
        .filter((q) => !scorableQuestionIds.has(String(q.id)))
        .map((q) => String(q.id))
    )

    const urlPrefix = publicExamEssayImageUrlPrefix()
    const mergedEssay = normalizeEssayDraft(body?.essaySubmission, essayQuestionIds, urlPrefix)
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

    const { error: upErr } = await supabase
      .from('exam_attempts')
      .update({
        answers,
        essay_submission: mergedEssay,
      })
      .eq('id', attempt.id)
      .is('submitted_at', null)

    if (upErr) {
      console.error('[exam-draft]', upErr.message)
      return NextResponse.json({ error: 'Lưu nháp thất bại.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[exam-draft]', msg)
    return NextResponse.json({ error: `Lỗi: ${msg}` }, { status: 500 })
  }
}
