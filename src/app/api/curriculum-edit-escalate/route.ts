/**
 * Giáo viên gửi admin khi 2 AI báo sai nhưng vẫn muốn lưu.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const supabase = createClient()
    const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const {
      curriculumId,
      topic,
      subjectId,
      gradeLevelId,
      textbookSetId,
      textbookVolume,
      lessonNumber,
      lessonTypeId,
      numLessons,
      lessonDurationMinutes,
      goals,
      contentMarkdown,
      aiErrors,
    } = body

    if (!contentMarkdown || typeof contentMarkdown !== 'string') {
      return NextResponse.json({ error: 'Thiếu nội dung giáo trình.' }, { status: 400 })
    }

    const { data: row, error } = await supabase
      .from('curriculum_edit_reviews')
      .insert({
        user_id: authResult.user?.id ?? null,
        curriculum_id: curriculumId || null,
        topic: topic || 'Giáo trình',
        subject_id: subjectId || 'toan',
        grade_level_id: gradeLevelId || 'lop-6',
        textbook_set_id: textbookSetId || 'ket-noi-tri-thuc',
        textbook_volume: textbookVolume || null,
        lesson_number: lessonNumber ? parseInt(lessonNumber, 10) : null,
        lesson_type_id: lessonTypeId || 'hinh-thanh-kien-thuc',
        num_lessons: Math.min(10, Math.max(1, parseInt(numLessons, 10) || 3)),
        lesson_duration_minutes: Math.min(120, Math.max(15, parseInt(lessonDurationMinutes, 10) || 45)),
        goals: goals || null,
        content_markdown: contentMarkdown,
        ai_errors: Array.isArray(aiErrors) ? aiErrors : [],
      })
      .select('id')
      .single()

    if (error) {
      console.error('[curriculum-edit-escalate]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: row?.id })
  } catch (e) {
    console.error('[curriculum-edit-escalate]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Lỗi gửi admin.' },
      { status: 500 }
    )
  }
}
