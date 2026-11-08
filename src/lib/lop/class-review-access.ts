import { loadClassDetailPayload } from '@/lib/lop/load-class-detail-payload'

export async function loadClassReviewAccess(
  classId: string,
  userId: string,
  subjectId: string,
  teacherId: string
) {
  const payload = await loadClassDetailPayload(classId, userId)
  if (!payload) return null
  const subject = payload.classSubjects.find(
    (row) => row.subjectId === subjectId && row.teacherId === teacherId
  )
  if (!subject) return null
  const inClass = payload.members.some((member) => member.userId === userId) || userId === teacherId
  if (!inClass) return null
  return { payload, subject }
}
