import type { SupabaseClient } from '@supabase/supabase-js'

/** Thông báo khi đề thi gắn lớp nhưng HS chưa tham gia đúng quy trình (mã lớp + họ tên + ngày sinh). */
export const CLASS_ENROLLMENT_ERROR_VI =
  'Bạn chưa tham gia lớp của bài thi này hoặc chưa khai báo đủ họ tên và ngày sinh. Vào Lớp học → Tham gia lớp, nhập mã lớp cùng họ tên và ngày sinh của học sinh (không dùng tên mặc định từ tài khoản Google).'

/** Họ tên + ngày sinh trên class_members (đủ để làm đề gắn lớp / bỏ form nhập lại trên lam-bai). */
export async function getClassMemberExamIdentity(
  supabase: SupabaseClient,
  classId: string,
  userId: string
): Promise<{ displayName: string; birthDate: string } | null> {
  const { data: mem } = await supabase
    .from('class_members')
    .select('member_display_name, birth_date')
    .eq('class_id', classId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!mem) return null
  const displayName = String(mem.member_display_name ?? '').replace(/\s+/g, ' ').trim()
  if (displayName.length < 2) return null
  if (!mem.birth_date) return null
  const birthDate = String(mem.birth_date).slice(0, 10)
  return { displayName, birthDate }
}

export async function hasCompleteClassEnrollment(
  supabase: SupabaseClient,
  classId: string,
  userId: string
): Promise<boolean> {
  const row = await getClassMemberExamIdentity(supabase, classId, userId)
  return row != null
}
