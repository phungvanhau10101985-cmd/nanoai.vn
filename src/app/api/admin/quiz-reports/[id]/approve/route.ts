import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getUserForAction } from '@/lib/auth'
import {
  createQuizWithGemini,
  verifyQuizWithAI,
  quizToMarker,
  type QuizData,
} from '@/lib/quiz-ai'
import { createUserNotificationWithEmail } from '@/lib/notifications/create-user-notification-server'

function adminClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

type SlideItem = {
  title?: string
  blocks?: Array<{ header?: string; content?: string }>
  content?: string
  imageUrl?: string
  visualEmbed?: string
  visualLayout?: 1 | 2 | 4
  visualCells?: unknown[]
}

/** Admin duyệt báo cáo: approved=true giữ nguyên, approved=false thay câu mới (Gemini + DeepSeek) */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createClient()
    const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
    if ('error' in authResult) return NextResponse.json({ error: authResult.error }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', authResult.user!.id).single()
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Chỉ quản trị viên mới được duyệt.' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const approved = body?.approved === true

    const adminSupabase = adminClient()

    const { data: report, error: fetchErr } = await adminSupabase
      .from('quiz_question_reports')
      .select('id, user_id, curriculum_id, slide_index, block_index, quiz_marker, slide_content, slide_title')
      .eq('id', id)
      .eq('status', 'admin_pending')
      .single()

    if (fetchErr || !report) {
      return NextResponse.json({ error: 'Không tìm thấy báo cáo hoặc đã được xử lý.' }, { status: 404 })
    }

    if (approved) {
      await adminSupabase
        .from('quiz_question_reports')
        .update({
          status: 'admin_approved',
          admin_approved_at: new Date().toISOString(),
          admin_user_id: authResult.user!.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      const notifKept = {
        user_id: report.user_id,
        type: 'quiz_report_resolved',
        title: 'Báo cáo câu hỏi của bạn đã được xử lý',
        body:
          'Ban quản trị đã xem xét và giữ nguyên nội dung câu hỏi trên giáo trình. Cảm ơn bạn đã góp ý giúp NanoAI chính xác hơn. Mở ứng dụng và xem mục thông báo (chuông) để biết thêm ngữ cảnh.',
        meta: { curriculum_id: report.curriculum_id, slide_index: report.slide_index, action: 'kept' },
      }
      await createUserNotificationWithEmail(adminSupabase, notifKept)

      return NextResponse.json({ action: 'kept', message: 'Đã duyệt giữ nguyên câu hỏi.' })
    }

    const fullContent = report.slide_title
      ? `## ${report.slide_title}\n\n${report.slide_content}`
      : report.slide_content
    if (!fullContent?.trim()) {
      return NextResponse.json({ error: 'Thiếu nội dung slide.' }, { status: 400 })
    }

    const created = await createQuizWithGemini(fullContent, report.user_id)
    if (!created) {
      return NextResponse.json({ error: 'AI không tạo được câu mới.' }, { status: 500 })
    }

    const verified = await verifyQuizWithAI(fullContent, created.quiz, report.user_id)
    const finalQuiz: QuizData =
      verified && !verified.verified && typeof verified.correctIndex === 'number' && verified.correctIndex >= 0 && verified.correctIndex <= 3
        ? { ...created.quiz, correctIndex: verified.correctIndex }
        : created.quiz
    const newMarker = quizToMarker(finalQuiz)

    const { data: slidesRow } = await adminSupabase
      .from('worksheet_slides')
      .select('content_json, topic, subject_id, grade_level_id')
      .eq('curriculum_id', report.curriculum_id)
      .single()

    if (!slidesRow) {
      return NextResponse.json({ error: 'Không tìm thấy slide.' }, { status: 404 })
    }

    const slides = slidesRow.content_json as SlideItem[]
    if (!Array.isArray(slides)) {
      return NextResponse.json({ error: 'Cấu trúc slide không hợp lệ.' }, { status: 500 })
    }

    const slide = slides[report.slide_index]
    if (!slide) {
      return NextResponse.json({ error: 'Slide không tồn tại.' }, { status: 404 })
    }

    const blocks = slide.blocks ?? []
    const rawContent =
      blocks.length > 0 && blocks[report.block_index]
        ? blocks[report.block_index].content ?? ''
        : (report.block_index === 0 ? slide.content ?? '' : '')

    if (!rawContent.includes(report.quiz_marker)) {
      return NextResponse.json({ error: 'Block hoặc câu hỏi không khớp.' }, { status: 404 })
    }

    const newContent = rawContent.replace(report.quiz_marker, newMarker)
    let newSlides: SlideItem[]

    if (blocks.length > 0) {
      const newBlocks = [...blocks]
      newBlocks[report.block_index] = { ...blocks[report.block_index], content: newContent }
      newSlides = slides.map((s, i) =>
        i === report.slide_index ? { ...s, blocks: newBlocks } : s
      )
    } else {
      newSlides = slides.map((s, i) =>
        i === report.slide_index ? { ...s, content: newContent } : s
      )
    }

    await adminSupabase
      .from('worksheet_slides')
      .update({
        content_json: newSlides,
        topic: slidesRow.topic,
        subject_id: slidesRow.subject_id,
        grade_level_id: slidesRow.grade_level_id,
      })
      .eq('curriculum_id', report.curriculum_id)

    await adminSupabase
      .from('quiz_question_reports')
      .update({
        status: 'admin_rejected',
        quiz_marker: newMarker,
        ai_reasoning: 'Admin duyệt sai – đã thay câu mới (Gemini + DeepSeek).',
        ai_model_used: 'gemini-2.5-pro',
        admin_approved_at: new Date().toISOString(),
        admin_user_id: authResult.user!.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    const notifReplaced = {
      user_id: report.user_id,
      type: 'quiz_report_resolved',
      title: 'Báo cáo câu hỏi của bạn đã được xử lý',
      body:
        'Ban quản trị đã thay thế bằng câu hỏi mới phù hợp nội dung slide. Bạn có thể học lại trên giáo trình. Cảm ơn bạn đã báo cáo giúp cải thiện chất lượng.',
      meta: { curriculum_id: report.curriculum_id, slide_index: report.slide_index, action: 'replaced' },
    }
    await createUserNotificationWithEmail(adminSupabase, notifReplaced)

    return NextResponse.json({
      action: 'replaced',
      newMarker,
      message: 'Đã thay câu hỏi mới.',
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[admin/quiz-reports/approve]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
