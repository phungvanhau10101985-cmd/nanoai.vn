import { getUserOrBypass } from '@/lib/auth'
import { attachStudentToClassPg } from '@/lib/db/class-roster-pg'
import { fetchStudentIdentity } from '@/lib/db/student-identity-pg'
import { canTakeClassExam } from '@/lib/lop/lop-viewer'

/** Phiên đã có (Google hoặc mã định danh) thì vào lớp bằng thông tin đã lưu. */
export async function resumeClassEntry(classId: string, nextPath: string | null): Promise<string | null> {
  const destination = nextPath || `/lop/${classId}`
  const session = await getUserOrBypass()
  if (await canTakeClassExam(classId, session?.id ?? null)) return destination
  if (!session) return null
  const identity = await fetchStudentIdentity(session.id)
  if (!identity.complete || !identity.gender || !identity.studentCode) return null
  const attached = await attachStudentToClassPg({
    classId,
    userId: session.id,
    studentCode: identity.studentCode,
    displayName: identity.givenName,
    birthDateIso: identity.birthDate,
    gender: identity.gender,
  })
  return attached === 'ok' ? destination : null
}
