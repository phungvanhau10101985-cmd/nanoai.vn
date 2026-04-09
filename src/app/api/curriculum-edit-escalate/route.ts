/**
 * Giáo viên gửi admin khi 2 AI báo sai nhưng vẫn muốn lưu.
 */

import { NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import { insertCurriculumEditReviewPg } from '@/lib/db/curriculum-edit-reviews-pg'
import { parseCurriculumLessonNumber } from '@/app/tao-giao-trinh/lib/curriculum-input-normalize'

export async function POST(req: Request) {
  try {
    const authResult = await getUserForAction()
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: 401 })
    }

    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 })
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

    const ins = await insertCurriculumEditReviewPg({
      userId: authResult.user?.id ?? null,
      curriculumId: curriculumId || null,
      topic: topic || 'Giáo trình',
      subjectId: subjectId || 'toan',
      gradeLevelId: gradeLevelId || 'lop-6',
      textbookSetId: textbookSetId || 'ket-noi-tri-thuc',
      textbookVolume: textbookVolume || null,
      lessonNumber: parseCurriculumLessonNumber(lessonNumber) ?? null,
      lessonTypeId: lessonTypeId || 'hinh-thanh-kien-thuc',
      numLessons: Math.min(10, Math.max(1, parseInt(String(numLessons), 10) || 3)),
      lessonDurationMinutes: Math.min(120, Math.max(15, parseInt(String(lessonDurationMinutes), 10) || 45)),
      goals: goals || null,
      contentMarkdown,
      aiErrors: Array.isArray(aiErrors) ? aiErrors : [],
    })

    if (!ins.ok) {
      console.error('[curriculum-edit-escalate]', ins.message)
      return NextResponse.json({ error: ins.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: ins.id })
  } catch (e) {
    console.error('[curriculum-edit-escalate]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Lỗi gửi admin.' },
      { status: 500 }
    )
  }
}
