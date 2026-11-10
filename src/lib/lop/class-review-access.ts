import { redirect } from 'next/navigation'
import { loadClassDetailPayload } from '@/lib/lop/load-class-detail-payload'

export async function loadClassReviewAccess(
  classId: string,
  userId: string,
  subjectId: string,
  teacherId: string
) {
  const payload = await loadClassDetailPayload(classId, userId)
  if (!payload) return null
  if (
    !payload.isTeacher &&
    payload.tuition?.students.some((student) => student.userId === userId && student.locked)
  ) {
    redirect(`/lop/${classId}`)
  }
  const subject = payload.classSubjects.find(
    (row) => row.subjectId === subjectId && row.teacherId === teacherId
  )
  if (!subject) return null
  const inClass = payload.members.some((member) => member.userId === userId) || userId === teacherId
  if (!inClass) return null
  return { payload, subject }
}
