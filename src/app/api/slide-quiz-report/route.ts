import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
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
  // Khớp format [quiz:...] – nội dung kết thúc bằng \x1f hoặc | + digit 0-3
  const m = marker.match(/\[quiz:\s*(.+[\x1f|][0-3])\]/i)
  if (!m) return null
  return parseQuizData(m[1].trim()) as QuizData | null
}

/** Lấy báo cáo đã được admin xử lý (để thông báo giáo viên) */
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
    if ('error' in authResult) return NextResponse.json({ error: authResult.error }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const curriculumId = searchParams.get('curriculumId')?.trim()
    const resolved = searchParams.get('resolved') === '1'
    if (!curriculumId || !resolved) {
      return NextResponse.json({ error: 'Thiếu curriculumId hoặc resolved=1.' }, { status: 400 })
    }

    const since = new Date()
    since.setDate(since.getDate() - 7)

    const { data, error } = await supabase
      .from('quiz_question_reports')
      .select('id, slide_index, block_index, status, admin_approved_at')
      .eq('curriculum_id', curriculumId)
      .eq('user_id', authResult.user!.id)
      .in('status', ['admin_approved', 'admin_rejected'])
      .gte('admin_approved_at', since.toISOString())
      .order('admin_approved_at', { ascending: false })
      .limit(10)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ items: data ?? [] })
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
    const supabase = createClient()
    const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
    if ('error' in authResult) return NextResponse.json({ error: authResult.error }, { status: 401 })
    const { user } = authResult

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

    const { data: existing } = await supabase
      .from('quiz_question_reports')
      .select('id, report_count, status')
      .eq('curriculum_id', curriculumId)
      .eq('user_id', user!.id)
      .eq('slide_index', slideIndex)
      .eq('block_index', blockIndex)
      .maybeSingle()

    const reportCount = existing ? (existing.report_count ?? 1) + 1 : 1

    if (reportCount === 1) {
      const check = await checkQuizWrongWithGemini(fullContent, quizData)
      if (!check) {
        return NextResponse.json({ error: 'Không thể kiểm tra (thiếu API key).' }, { status: 500 })
      }
      if (check.isWrong) {
        const created = await createQuizWithGemini(fullContent)
        if (!created) {
          return NextResponse.json({ error: 'AI không tạo được câu mới.' }, { status: 500 })
        }
        const verified = await verifyQuizWithAI(fullContent, created.quiz)
        const finalQuiz = verified && !verified.verified && typeof verified.correctIndex === 'number' && verified.correctIndex >= 0 && verified.correctIndex <= 3
          ? { ...created.quiz, correctIndex: verified.correctIndex }
          : created.quiz
        const newMarker = quizToMarker(finalQuiz)

        await supabase.from('quiz_question_reports').upsert(
          {
            curriculum_id: curriculumId,
            user_id: user!.id,
            slide_index: slideIndex,
            block_index: blockIndex,
            quiz_marker: newMarker,
            slide_content: slideContent,
            slide_title: slideTitle,
            report_count: 1,
            status: 'ai_replaced',
            ai_reasoning: check.reasoning,
            ai_model_used: 'gemini-2.5-pro',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'curriculum_id,slide_index,block_index,user_id' }
        )

        return NextResponse.json({ action: 'replaced', newMarker, reasoning: check.reasoning })
      }

      await supabase.from('quiz_question_reports').upsert(
        {
          curriculum_id: curriculumId,
          user_id: user!.id,
          slide_index: slideIndex,
          block_index: blockIndex,
          quiz_marker: quizMarker,
          slide_content: slideContent,
          slide_title: slideTitle,
          report_count: 1,
          status: 'ai_checked_kept',
          ai_reasoning: check.reasoning,
          ai_model_used: 'gemini-2.5-pro',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'curriculum_id,slide_index,block_index,user_id' }
      )

      return NextResponse.json({ action: 'kept', reasoning: check.reasoning })
    }

    if (reportCount === 2) {
      const check = await checkQuizWrongWithGPT(fullContent, quizData)
      if (!check) {
        return NextResponse.json({ error: 'Không thể kiểm tra (thiếu OPENAI_API_KEY).' }, { status: 500 })
      }
      if (check.isWrong) {
        const created = await createQuizWithGPT(fullContent)
        if (!created) {
          return NextResponse.json({ error: 'GPT không tạo được câu mới.' }, { status: 500 })
        }
        const verified = await verifyQuizWithAI(fullContent, created.quiz)
        const finalQuiz = verified && !verified.verified && typeof verified.correctIndex === 'number' && verified.correctIndex >= 0 && verified.correctIndex <= 3
          ? { ...created.quiz, correctIndex: verified.correctIndex }
          : created.quiz
        const newMarker = quizToMarker(finalQuiz)

        await supabase.from('quiz_question_reports').upsert(
          {
            curriculum_id: curriculumId,
            user_id: user!.id,
            slide_index: slideIndex,
            block_index: blockIndex,
            quiz_marker: newMarker,
            slide_content: slideContent,
            slide_title: slideTitle,
            report_count: 2,
            status: 'gpt_replaced',
            ai_reasoning: check.reasoning,
            ai_model_used: 'gpt-4o',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'curriculum_id,slide_index,block_index,user_id' }
        )

        return NextResponse.json({ action: 'replaced', newMarker, reasoning: check.reasoning })
      }

      await supabase.from('quiz_question_reports').upsert(
        {
          curriculum_id: curriculumId,
          user_id: user!.id,
          slide_index: slideIndex,
          block_index: blockIndex,
          quiz_marker: quizMarker,
          slide_content: slideContent,
          slide_title: slideTitle,
          report_count: 2,
          status: 'gpt_checked_kept',
          ai_reasoning: check.reasoning,
          ai_model_used: 'gpt-4o',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'curriculum_id,slide_index,block_index,user_id' }
      )

      return NextResponse.json({ action: 'kept', reasoning: check.reasoning })
    }

    if (reportCount >= 3) {
      await supabase.from('quiz_question_reports').upsert(
        {
          curriculum_id: curriculumId,
          user_id: user!.id,
          slide_index: slideIndex,
          block_index: blockIndex,
          quiz_marker: quizMarker,
          slide_content: slideContent,
          slide_title: slideTitle,
          report_count: reportCount,
          status: 'admin_pending',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'curriculum_id,slide_index,block_index,user_id' }
      )

      return NextResponse.json({ action: 'admin_pending', message: 'Đã gửi cho admin kiểm tra.' })
    }

    return NextResponse.json({ error: 'Lỗi không xác định.' }, { status: 500 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[slide-quiz-report] Lỗi:', msg)
    return NextResponse.json({ error: `Lỗi: ${msg}` }, { status: 500 })
  }
}
