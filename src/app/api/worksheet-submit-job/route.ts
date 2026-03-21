/**
 * Submit worksheet job – chạy ngầm, không phụ thuộc client.
 * Trả về jobId ngay, worker xử lý sau.
 * Chỉ dùng cho luồng step-by-step (quiz/essay).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
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

    const { data: job, error: insertErr } = await supabase
      .from('worksheet_jobs')
      .insert({
        user_id: userId,
        type: jobType,
        status: 'pending',
        params,
      })
      .select('id')
      .single()

    if (insertErr || !job?.id) return NextResponse.json({ error: insertErr?.message || 'Lỗi tạo job.' }, { status: 500 })

    return NextResponse.json({ jobId: job.id })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
