'use server'

import { revalidatePath } from 'next/cache'
import { getUserOrBypass } from '@/lib/auth'
import {
  insertClassTeacherCurriculumPg,
  teacherCanSaveCurriculumPg,
} from '@/lib/db/class-teacher-curricula-pg'
import { loadClassDetailPayload } from '@/lib/lop/load-class-detail-payload'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function saveCurriculumToClass(input: {
  classId: string
  subjectId: string
  curriculumId: string
}): Promise<{ ok: true } | { ok: false }> {
  const classId = input.classId.trim()
  const subjectId = input.subjectId.trim()
  const curriculumId = input.curriculumId.trim()
  if (!UUID_RE.test(classId) || !UUID_RE.test(curriculumId) || !subjectId || subjectId.length > 80) {
    return { ok: false }
  }
  const user = await getUserOrBypass()
  if (!user) return { ok: false }
  const payload = await loadClassDetailPayload(classId, user.id)
  if (!payload?.isTeacher) return { ok: false }
  const allowed = await teacherCanSaveCurriculumPg(user.id, curriculumId)
  if (!allowed) return { ok: false }
  await insertClassTeacherCurriculumPg({
    classId,
    teacherId: user.id,
    subjectId,
    curriculumId,
  })
  revalidatePath(`/lop/${classId}/giao-trinh`)
  return { ok: true }
}
