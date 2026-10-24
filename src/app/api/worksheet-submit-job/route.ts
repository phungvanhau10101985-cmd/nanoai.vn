/**
 * Submit worksheet job – chạy ngầm, không phụ thuộc client.
 * Trả về jobId ngay, worker xử lý sau.
 * Chỉ dùng cho luồng step-by-step (quiz/essay).
 */
import { NextRequest, NextResponse } from 'next/server'
import { insertWorksheetJobFromPg } from '@/lib/db/worksheet-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { preflightWorksheetQuestions, WorksheetCreditsError } from '@/lib/db/worksheet-ai-quota-pg'
import { getUserForAction } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const auth = await getUserForAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const userId = auth.user?.id

    // step_by_step_quiz | step_by_step_essay – JSON body
    const body = await req.json().catch(() => ({}))
    const jobType = body.type === 'essay' ? 'step_by_step_essay' : 'step_by_step_quiz'
    const curriculumMarkdown = String(body?.curriculumMarkdown ?? '').trim()
    if (!curriculumMarkdown) return NextResponse.json({ error: 'Vui lòng tạo giáo trình trước.' }, { status: 400 })

    const count = Math.max(0, Math.min(Number(body.count ?? 0), jobType === 'step_by_step_quiz' ? 20 : 10))
    if (count === 0) {
      const msg = jobType === 'step_by_step_quiz'
        ? 'Nhập số câu trắc nghiệm ≥ 1.'
        : 'Nhập số bài tự luận ≥ 1.'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const kind = jobType === 'step_by_step_quiz' ? 'quiz' : 'essay'
    const curriculumIdForQuota = (body?.curriculumId as string)?.trim() || null
    try {
      const gate = await preflightWorksheetQuestions({
        userId: userId!,
        curriculumId: curriculumIdForQuota,
        kind,
        count,
      })
      if (!gate.ok) {
        const denied = new WorksheetCreditsError(gate.required, gate.balance, gate.freeRemaining)
        return NextResponse.json(
          {
            error: denied.message,
            code: denied.code,
            required: denied.required,
            balance: denied.balance,
            freeRemaining: denied.freeRemaining,
          },
          { status: 402 }
        )
      }
    } catch (quotaError) {
      const msg = quotaError instanceof Error ? quotaError.message : String(quotaError)
      return NextResponse.json({ error: msg }, { status: 503 })
    }

    const params = {
      curriculumMarkdown,
      topic: String(body?.topic ?? '').trim() || 'Phiếu bài tập',
      subjectId: String(body?.subjectId ?? 'toan'),
      gradeLevelId: String(body?.gradeLevelId ?? 'lop-6'),
      curriculumId: (body?.curriculumId as string) || null,
      lessonTopics: Array.isArray(body?.lessonTopics) ? (body.lessonTopics as string[]).filter(Boolean) : undefined,
      count,
      difficulty: String(body?.difficulty ?? (jobType === 'step_by_step_quiz' ? 'medium' : 'thong-hieu')),
      sessionQuizCountByDiff: body?.sessionQuizCountByDiff ?? {},
      sessionEssayCountByBloom: body?.sessionEssayCountByBloom ?? {},
    }

    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Chưa cấu hình cơ sở dữ liệu.' }, { status: 503 })
    }

    const jobId = await insertWorksheetJobFromPg({ userId: userId!, type: jobType, params })
    if (!jobId) {
      return NextResponse.json({ error: 'Lỗi tạo job.' }, { status: 500 })
    }

    return NextResponse.json({ jobId })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
