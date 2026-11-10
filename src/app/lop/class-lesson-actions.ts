'use server'

import { revalidatePath } from 'next/cache'
import { getUserOrBypass } from '@/lib/auth'
import { teacherCanSaveCurriculumPg } from '@/lib/db/class-teacher-curricula-pg'
import { attachTaughtLessonPg, listTeachClassesForSubjectPg, type TeachClassOption } from '@/lib/db/class-taught-lessons-pg'
import { tutoringClassFeatureBlock } from '@/lib/db/tutoring-package-pg'

export async function listClassesForTeaching(subjectId: string): Promise<TeachClassOption[]> {
  const user = await getUserOrBypass()
  if (!user) return []
  return listTeachClassesForSubjectPg(user.id, subjectId)
}

export async function attachLessonToClass(input: {
  classId: string
  subjectId: string
  curriculumId: string
  lessonNo: number
}): Promise<{ ok: true } | { ok: false }> {
  const user = await getUserOrBypass()
  if (!user) return { ok: false }
  const allowed = await teacherCanSaveCurriculumPg(user.id, input.curriculumId)
  if (!allowed) return { ok: false }
  if ((await tutoringClassFeatureBlock(input.classId)) !== 'open') return { ok: false }
  const saved = await attachTaughtLessonPg({
    classId: input.classId,
    teacherId: user.id,
    subjectId: input.subjectId,
    curriculumId: input.curriculumId,
    lessonNo: input.lessonNo,
  })
  if (!saved.ok) return { ok: false }
  revalidatePath(`/lop/${input.classId}`)
  revalidatePath(`/lop/${input.classId}/on-bai`)
  return { ok: true }
}
