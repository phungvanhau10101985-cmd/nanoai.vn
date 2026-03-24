import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { verifyExamLayoutToken } from '@/lib/exam-layout-token'
import { getExamAttemptFeedbackWithMeta, type ExamGradingMeta } from '@/lib/exam-feedback'
import { CLASS_ENROLLMENT_ERROR_VI, hasCompleteClassEnrollment } from '@/lib/lop/require-class-enrollment'
import { isValidStudentDobIso } from '@/lib/student-dob'
import {
  EXAM_ESSAY_IMAGE_RETENTION_DAYS,
  publicExamEssayImageUrlPrefix,
} from '@/lib/exam-essay-config'

const MAX_ESSAY_TEXT = 12000
const MAX_IMAGES_PER_ESSAY = 10

function normalizeEssaySubmission(
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

function essaySubmissionHasImageUrls(
  sub: Record<string, { text: string; imageUrls: string[] }>
): boolean {
  for (const v of Object.values(sub)) {
    if (v.imageUrls.length > 0) return true
  }
  return false
}

/** Nộp bài – điểm TN = tổng điểm các câu đúng (theo trọng số `points` từng câu); TL chưa chấm. Mỗi tài khoản một lần. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const serverSupabase = createServerClient()
    const { data: authData } = await serverSupabase.auth.getUser()
    const user = authData.user
    if (!user) {
      return NextResponse.json({ error: 'Vui lòng đăng nhập để nộp bài thi.' }, { status: 401 })
    }

    const { code } = await params
    if (!code || code.length < 4) {
      return NextResponse.json({ error: 'Mã bài thi không hợp lệ.' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    const studentName = String(body?.studentName ?? '').trim()
    const studentDob = String(body?.studentDob ?? '').trim()
    const layoutToken = String(body?.layoutToken ?? '').trim()
    const answers = body?.answers
    if (!studentName) {
      return NextResponse.json({ error: 'Vui lòng nhập họ tên học sinh.' }, { status: 400 })
    }
    if (!isValidStudentDobIso(studentDob)) {
      return NextResponse.json({ error: 'Vui lòng chọn ngày sinh hợp lệ.' }, { status: 400 })
    }
    if (!answers || typeof answers !== 'object') {
      return NextResponse.json({ error: 'Thiếu đáp án.' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    const { data: session, error: sessionErr } = await supabase
      .from('exam_sessions')
      .select('id, class_id, school_id, is_practice_homework')
      .eq('code', code.toUpperCase())
      .eq('status', 'active')
      .single()

    if (sessionErr || !session) {
      return NextResponse.json({ error: 'Không tìm thấy bài thi.' }, { status: 404 })
    }

    const practiceHomework = Boolean((session as { is_practice_homework?: boolean }).is_practice_homework)

    const layout = await verifyExamLayoutToken(layoutToken)
    if (!layout || layout.sessionId !== String(session.id) || layout.userId !== user.id) {
      return NextResponse.json(
        {
          error:
            'Phiên làm bài không hợp lệ hoặc đã hết hạn. Vui lòng tải lại trang đề thi rồi làm bài.',
        },
        { status: 400 }
      )
    }

    if (session.class_id) {
      const ok = await hasCompleteClassEnrollment(supabase, String(session.class_id), user.id)
      if (!ok) {
        return NextResponse.json({ error: CLASS_ENROLLMENT_ERROR_VI }, { status: 403 })
      }
    }

    const { data: existing } = await supabase
      .from('exam_attempts')
      .select('id')
      .eq('session_id', session.id)
      .eq('user_id', user.id)
      .limit(1)

    if (existing?.length) {
      return NextResponse.json({ error: 'Bạn đã nộp bài thi này rồi. Mỗi tài khoản chỉ được làm một lần.' }, { status: 409 })
    }

    const { data: questions } = await supabase
      .from('exam_questions')
      .select('id, correct_index, options, points')
      .eq('session_id', session.id)

    const readQuestionPoints = (row: { points?: unknown }): number => {
      const raw = row.points
      const p = typeof raw === 'number' ? raw : Number(raw)
      if (!Number.isFinite(p) || p < 0) return 1
      return Math.min(100, Math.round(p * 100) / 100)
    }

    const qMap = new Map((questions ?? []).map((q) => [String(q.id), q]))
    let correctCount = 0
    const scorableQuestionIds = new Set(
      (questions ?? [])
        .filter((q) => {
          const opts = Array.isArray(q.options) ? q.options : []
          if (opts.length < 2) return false
          const ci = typeof q.correct_index === 'number' ? q.correct_index : Number(q.correct_index)
          return Number.isFinite(ci)
        })
        .map((q) => String(q.id))
    )
    const essayQuestionIds = new Set(
      (questions ?? [])
        .filter((q) => !scorableQuestionIds.has(String(q.id)))
        .map((q) => String(q.id))
    )

    const urlPrefix = publicExamEssayImageUrlPrefix()
    const essaySubmission = normalizeEssaySubmission(body?.essaySubmission, essayQuestionIds, urlPrefix)
    for (const qid of essayQuestionIds) {
      const textFromAnswer =
        typeof (answers as Record<string, unknown>)[qid] === 'string'
          ? String((answers as Record<string, unknown>)[qid]).trim().slice(0, MAX_ESSAY_TEXT)
          : ''
      if (!essaySubmission[qid]) essaySubmission[qid] = { text: '', imageUrls: [] }
      if (!essaySubmission[qid].text && textFromAnswer) essaySubmission[qid].text = textFromAnswer
    }

    for (const qid of Array.from(scorableQuestionIds)) {
      const row = qMap.get(qid)
      const opts = row && Array.isArray(row.options) ? row.options : []
      const perm = layout.optionPerms[qid]
      if (!perm || !Array.isArray(perm) || perm.length !== opts.length) {
        return NextResponse.json(
          {
            error:
              'Dữ liệu đề thi không khớp (layoutToken). Vui lòng tải lại trang và làm lại từ đầu.',
          },
          { status: 400 }
        )
      }
    }

    let quizPointsMax = 0
    let essayPointsMax = 0
    for (const rawQ of questions ?? []) {
      const qid = String(rawQ.id)
      const w = readQuestionPoints(rawQ as { points?: unknown })
      if (scorableQuestionIds.has(qid)) quizPointsMax += w
      else essayPointsMax += w
    }
    quizPointsMax = Math.round(quizPointsMax * 100) / 100
    essayPointsMax = Math.round(essayPointsMax * 100) / 100

    let quizPointsEarned = 0
    for (const qid of scorableQuestionIds) {
      const q = qMap.get(qid)
      if (!q) continue
      const userAnswer = (answers as Record<string, unknown>)[qid]
      const dbOpts = Array.isArray(q.options) ? q.options : []
      const nOpt = dbOpts.length
      const ciRaw = typeof q.correct_index === 'number' ? q.correct_index : Number(q.correct_index ?? 0)
      const safeCorrect =
        nOpt >= 2 && Number.isFinite(ciRaw)
          ? Math.max(0, Math.min(nOpt - 1, Math.floor(ciRaw)))
          : 0
      const displayIdx = typeof userAnswer === 'number' ? userAnswer : parseInt(String(userAnswer), 10)
      if (!Number.isFinite(displayIdx)) continue
      const perm = layout.optionPerms[qid]
      let userOriginal = displayIdx
      if (perm && Array.isArray(perm) && perm.length === dbOpts.length && dbOpts.length >= 2) {
        if (displayIdx < 0 || displayIdx >= perm.length) continue
        userOriginal = perm[displayIdx]!
      }
      if (userOriginal === safeCorrect) {
        correctCount++
        quizPointsEarned += readQuestionPoints(q as { points?: unknown })
      }
    }

    const maxScore = Math.round((quizPointsMax + essayPointsMax) * 100) / 100
    const roundedEarned = Math.round(quizPointsEarned * 100) / 100
    const finalScore = Math.min(maxScore, roundedEarned)
    const gradingMeta: ExamGradingMeta = {
      quizCorrect: correctCount,
      quizTotal: scorableQuestionIds.size,
      quizPoints: roundedEarned,
      quizPointsMax,
      essayPointsMax,
      ...(essaySubmissionHasImageUrls(essaySubmission)
        ? {
            essayImageUrlsExpireAt: new Date(
              Date.now() + EXAM_ESSAY_IMAGE_RETENTION_DAYS * 86400000
            ).toISOString(),
          }
        : {}),
    }

    const feedback = getExamAttemptFeedbackWithMeta(finalScore, maxScore, gradingMeta)

    const { error: insertErr } = await supabase.from('exam_attempts').insert({
      session_id: session.id,
      user_id: user.id,
      class_id: session.class_id ?? null,
      school_id: session.school_id ?? null,
      student_name: studentName || null,
      student_code: studentDob || null,
      answers,
      essay_submission: essaySubmission,
      score: finalScore,
      max_score: maxScore,
      grading_meta: gradingMeta,
      started_at: new Date().toISOString(),
      submitted_at: new Date().toISOString(),
    })

    if (insertErr) {
      console.error('[exam-submit] Insert failed:', insertErr.message)
      return NextResponse.json({ error: 'Lưu bài làm thất bại.' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      practiceHomework,
      score: finalScore,
      maxScore,
      grade10: feedback.grade10,
      scoreOn100: feedback.scoreOn100,
      comment: feedback.comment,
      shareHint: feedback.shareHint,
      scoringBreakdown: gradingMeta,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[exam-submit] Error:', msg)
    return NextResponse.json({ error: `Lỗi: ${msg}` }, { status: 500 })
  }
}
