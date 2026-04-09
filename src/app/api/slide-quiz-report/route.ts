import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import {
  fetchQuizQuestionReportSlotPg,
  fetchQuizQuestionReportsResolvedForUserPg,
  upsertQuizQuestionReportTeacherPg,
} from '@/lib/db/quiz-reports-pg'
import {
  checkQuizWrongWithGemini,
  checkQuizWrongWithGPT,
  createQuizWithGemini,
  createQuizWithGPT,
  verifyQuizWithAI,
  quizToMarker,
  type QuizData,
} from '@/lib/quiz-ai'
import { parseQuizData } from '@/lib/parse-quiz-data'

function extractQuizFromMarker(marker: string): QuizData | null {
  const m = marker.match(/\[quiz:\s*(.+[\x1f|][0-3])\]/i)
  if (!m) return null
  return parseQuizData(m[1].trim()) as QuizData | null
}

/** Lấy báo cáo đã được admin xử lý (để thông báo giáo viên) */
export async function GET(req: NextRequest) {
  try {
    const authResult = await getUserForAction()
    if ('error' in authResult) return NextResponse.json({ error: authResult.error }, { status: 401 })

    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Chưa cấu hình cơ sở dữ liệu.' }, { status: 503 })
    }

    const { searchParams } = new URL(req.url)
    const curriculumId = searchParams.get('curriculumId')?.trim()
    const resolved = searchParams.get('resolved') === '1'
    if (!curriculumId || !resolved) {
      return NextResponse.json({ error: 'Thiếu curriculumId hoặc resolved=1.' }, { status: 400 })
    }

    const since = new Date()
    since.setDate(since.getDate() - 7)

    const data = await fetchQuizQuestionReportsResolvedForUserPg(
      curriculumId,
      authResult.user!.id,
      since.toISOString()
    )
    if (data === null) {
      return NextResponse.json({ error: 'Không đọc được báo cáo.' }, { status: 500 })
    }
    return NextResponse.json({ items: data })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[slide-quiz-report] GET:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/** Giáo viên báo câu hỏi sai.
 * Luồng: report 1 → Gemini kiểm tra; report 2 → GPT kiểm tra; report 3 → Admin duyệt.
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await getUserForAction()
    if ('error' in authResult) return NextResponse.json({ error: authResult.error }, { status: 401 })
    const { user } = authResult

    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Chưa cấu hình cơ sở dữ liệu.' }, { status: 503 })
    }

    const body = await req.json().catch(() => ({}))
    const curriculumId = String(body?.curriculumId ?? '').trim()
    const slideIndex = Number(body?.slideIndex) ?? 0
    const blockIndex = Number(body?.blockIndex) ?? 0
    const quizMarker = String(body?.quizMarker ?? '').trim()
    const slideContent = String(body?.slideContent ?? '').trim()
    const slideTitle = String(body?.slideTitle ?? '').trim()

    if (!curriculumId || !quizMarker) {
      return NextResponse.json({ error: 'Thiếu curriculumId hoặc quizMarker.' }, { status: 400 })
    }

    const quizData = extractQuizFromMarker(quizMarker)
    if (!quizData) {
      return NextResponse.json({ error: 'Định dạng câu hỏi không hợp lệ.' }, { status: 400 })
    }

    const fullContent = slideTitle ? `## ${slideTitle}\n\n${slideContent}` : slideContent
    if (!fullContent.trim()) {
      return NextResponse.json({ error: 'Thiếu nội dung slide để kiểm tra.' }, { status: 400 })
    }

    const existing = await fetchQuizQuestionReportSlotPg({
      curriculumId,
      userId: user!.id,
      slideIndex,
      blockIndex,
    })
    const reportCount = existing ? (existing.report_count ?? 1) + 1 : 1

    const upsertOrFail = async (p: Parameters<typeof upsertQuizQuestionReportTeacherPg>[0]) => {
      const ok = await upsertQuizQuestionReportTeacherPg(p)
      if (ok !== true) {
        throw new Error('Không lưu được báo cáo.')
      }
    }

    if (reportCount === 1) {
      const check = await checkQuizWrongWithGemini(fullContent, quizData, user!.id)
      if (!check) {
        return NextResponse.json({ error: 'Không thể kiểm tra (thiếu API key).' }, { status: 500 })
      }
      if (check.isWrong) {
        const created = await createQuizWithGemini(fullContent, user!.id)
        if (!created) {
          return NextResponse.json({ error: 'AI không tạo được câu mới.' }, { status: 500 })
        }
        const verified = await verifyQuizWithAI(fullContent, created.quiz, user!.id)
        const finalQuiz =
          verified && !verified.verified && typeof verified.correctIndex === 'number' && verified.correctIndex >= 0 && verified.correctIndex <= 3
            ? { ...created.quiz, correctIndex: verified.correctIndex }
            : created.quiz
        const newMarker = quizToMarker(finalQuiz)

        try {
          await upsertOrFail({
            curriculumId,
            userId: user!.id,
            slideIndex,
            blockIndex,
            quizMarker: newMarker,
            slideContent,
            slideTitle,
            reportCount: 1,
            status: 'ai_replaced',
            aiReasoning: check.reasoning,
            aiModelUsed: 'gemini-2.5-pro',
          })
        } catch (err) {
          const m = err instanceof Error ? err.message : String(err)
          return NextResponse.json({ error: m }, { status: 500 })
        }

        return NextResponse.json({ action: 'replaced', newMarker, reasoning: check.reasoning })
      }

      try {
        await upsertOrFail({
          curriculumId,
          userId: user!.id,
          slideIndex,
          blockIndex,
          quizMarker,
          slideContent,
          slideTitle,
          reportCount: 1,
          status: 'ai_checked_kept',
          aiReasoning: check.reasoning,
          aiModelUsed: 'gemini-2.5-pro',
        })
      } catch (err) {
        const m = err instanceof Error ? err.message : String(err)
        return NextResponse.json({ error: m }, { status: 500 })
      }

      return NextResponse.json({ action: 'kept', reasoning: check.reasoning })
    }

    if (reportCount === 2) {
      const check = await checkQuizWrongWithGPT(fullContent, quizData, user!.id)
      if (!check) {
        return NextResponse.json({ error: 'Không thể kiểm tra (thiếu OPENAI_API_KEY).' }, { status: 500 })
      }
      if (check.isWrong) {
        const created = await createQuizWithGPT(fullContent, user!.id)
        if (!created) {
          return NextResponse.json({ error: 'GPT không tạo được câu mới.' }, { status: 500 })
        }
        const verified = await verifyQuizWithAI(fullContent, created.quiz, user!.id)
        const finalQuiz =
          verified && !verified.verified && typeof verified.correctIndex === 'number' && verified.correctIndex >= 0 && verified.correctIndex <= 3
            ? { ...created.quiz, correctIndex: verified.correctIndex }
            : created.quiz
        const newMarker = quizToMarker(finalQuiz)

        try {
          await upsertOrFail({
            curriculumId,
            userId: user!.id,
            slideIndex,
            blockIndex,
            quizMarker: newMarker,
            slideContent,
            slideTitle,
            reportCount: 2,
            status: 'gpt_replaced',
            aiReasoning: check.reasoning,
            aiModelUsed: 'gpt-4o',
          })
        } catch (err) {
          const m = err instanceof Error ? err.message : String(err)
          return NextResponse.json({ error: m }, { status: 500 })
        }

        return NextResponse.json({ action: 'replaced', newMarker, reasoning: check.reasoning })
      }

      try {
        await upsertOrFail({
          curriculumId,
          userId: user!.id,
          slideIndex,
          blockIndex,
          quizMarker,
          slideContent,
          slideTitle,
          reportCount: 2,
          status: 'gpt_checked_kept',
          aiReasoning: check.reasoning,
          aiModelUsed: 'gpt-4o',
        })
      } catch (err) {
        const m = err instanceof Error ? err.message : String(err)
        return NextResponse.json({ error: m }, { status: 500 })
      }

      return NextResponse.json({ action: 'kept', reasoning: check.reasoning })
    }

    if (reportCount >= 3) {
      try {
        await upsertOrFail({
          curriculumId,
          userId: user!.id,
          slideIndex,
          blockIndex,
          quizMarker,
          slideContent,
          slideTitle,
          reportCount,
          status: 'admin_pending',
          aiReasoning: null,
          aiModelUsed: null,
        })
      } catch (err) {
        const m = err instanceof Error ? err.message : String(err)
        return NextResponse.json({ error: m }, { status: 500 })
      }

      return NextResponse.json({ action: 'admin_pending', message: 'Đã gửi cho admin kiểm tra.' })
    }

    return NextResponse.json({ error: 'Lỗi không xác định.' }, { status: 500 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[slide-quiz-report] Lỗi:', msg)
    return NextResponse.json({ error: `Lỗi: ${msg}` }, { status: 500 })
  }
}
