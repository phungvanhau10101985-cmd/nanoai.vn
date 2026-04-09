import {
  getClassMemberExamIdentityFromPg,
  hasCompleteClassMemberProfileForExamPg,
} from '@/lib/db/classes-pg'

/** Thông báo khi đề thi gắn lớp nhưng HS chưa tham gia đúng quy trình (mã lớp + họ tên + ngày sinh). */
export const CLASS_ENROLLMENT_ERROR_VI =
  'Bạn chưa tham gia lớp của bài thi này hoặc chưa khai báo đủ họ tên và ngày sinh. Vào Lớp học → Tham gia lớp, nhập mã lớp cùng họ tên và ngày sinh của học sinh (không dùng tên mặc định từ tài khoản Google).'

/** Họ tên + ngày sinh trên class_members (đủ để làm đề gắn lớp / bỏ form nhập lại trên lam-bai). */
export async function getClassMemberExamIdentity(
  classId: string,
  userId: string
): Promise<{ displayName: string; birthDate: string } | null> {
  return getClassMemberExamIdentityFromPg(classId, userId)
}

export async function hasCompleteClassEnrollment(classId: string, userId: string): Promise<boolean> {
  const v = await hasCompleteClassMemberProfileForExamPg(classId, userId)
  return v === true
}
