import { NextRequest, NextResponse } from 'next/server'
import { requireAdminWithStepUp } from '@/lib/auth/require-step-up'
import { isPgConfigured } from '@/lib/db/pool'
import {
  fetchQuizQuestionReportPendingByIdPg,
  fetchWorksheetSlidesByCurriculumIdPg,
  updateQuizQuestionReportApprovedPg,
  updateQuizQuestionReportReplacedPg,
  updateWorksheetSlidesContentJsonPg,
} from '@/lib/db/quiz-reports-pg'
import {
  createQuizWithGemini,
  verifyQuizWithAI,
  quizToMarker,
  type QuizData,
} from '@/lib/quiz-ai'
import { createUserNotificationWithEmail } from '@/lib/notifications/create-user-notification-server'

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
    const auth = await requireAdminWithStepUp()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status })
    }
    const adminUserId = auth.user.id

    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Chưa cấu hình cơ sở dữ liệu.' }, { status: 503 })
    }

    const body = await req.json().catch(() => ({}))
    const approved = body?.approved === true

    const report = await fetchQuizQuestionReportPendingByIdPg(id)
    if (!report) {
      return NextResponse.json({ error: 'Không tìm thấy báo cáo hoặc đã được xử lý.' }, { status: 404 })
    }

    if (approved) {
      const ok = await updateQuizQuestionReportApprovedPg(id, adminUserId)
      if (ok !== true) {
        return NextResponse.json({ error: 'Không cập nhật được trạng thái báo cáo.' }, { status: 500 })
      }

      const notifKept = {
        user_id: report.user_id,
        type: 'quiz_report_resolved',
        title: 'Báo cáo câu hỏi của bạn đã được xử lý',
        body:
          'Ban quản trị đã xem xét và giữ nguyên nội dung câu hỏi trên giáo trình. Cảm ơn bạn đã góp ý giúp NanoAI chính xác hơn. Mở ứng dụng và xem mục thông báo (chuông) để biết thêm ngữ cảnh.',
        meta: {
          push_url: '/giao-trinh',
          curriculum_id: report.curriculum_id,
          slide_index: report.slide_index,
          action: 'kept',
        },
      }
      await createUserNotificationWithEmail(notifKept)

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

    const slidesRow = await fetchWorksheetSlidesByCurriculumIdPg(report.curriculum_id)
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
      newSlides = slides.map((s, i) => (i === report.slide_index ? { ...s, blocks: newBlocks } : s))
    } else {
      newSlides = slides.map((s, i) => (i === report.slide_index ? { ...s, content: newContent } : s))
    }

    const upSlides = await updateWorksheetSlidesContentJsonPg({
      curriculumId: report.curriculum_id,
      contentJson: newSlides,
      topic: slidesRow.topic,
      subjectId: slidesRow.subject_id,
      gradeLevelId: slidesRow.grade_level_id,
    })
    if (upSlides !== true) {
      return NextResponse.json({ error: 'Không cập nhật được slide.' }, { status: 500 })
    }

    const upReport = await updateQuizQuestionReportReplacedPg({
      reportId: id,
      adminUserId: adminUserId,
      newQuizMarker: newMarker,
    })
    if (upReport !== true) {
      return NextResponse.json({ error: 'Không cập nhật được báo cáo.' }, { status: 500 })
    }

    const notifReplaced = {
      user_id: report.user_id,
      type: 'quiz_report_resolved',
      title: 'Báo cáo câu hỏi của bạn đã được xử lý',
      body:
        'Ban quản trị đã thay thế bằng câu hỏi mới phù hợp nội dung slide. Bạn có thể học lại trên giáo trình. Cảm ơn bạn đã báo cáo giúp cải thiện chất lượng.',
      meta: {
        push_url: '/giao-trinh',
        curriculum_id: report.curriculum_id,
        slide_index: report.slide_index,
        action: 'replaced',
      },
    }
    await createUserNotificationWithEmail(notifReplaced)

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
