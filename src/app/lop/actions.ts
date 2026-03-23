'use server'

import { createClient as createServiceRoleClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { isValidStudentDobIso } from '@/lib/student-dob'

function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export async function createClass(formData: FormData) {
  const supabase = createClient()
  const result = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in result) return { error: result.error }
  const { user } = result

  const name = formData.get('name')?.toString()?.trim()
  if (!name) return { error: 'Vui lòng nhập tên lớp.' }

  const schoolId = formData.get('schoolId')?.toString()?.trim()
  if (!schoolId) return { error: 'Vui lòng chọn trường trước khi tạo lớp.' }

  const { data: schoolRow } = await supabase.from('schools').select('id').eq('id', schoolId).maybeSingle()
  if (!schoolRow) return { error: 'Không tìm thấy trường đã chọn.' }

  let joinCode = generateJoinCode()
  let attempts = 0
  while (attempts < 10) {
    const { data: existing } = await supabase
      .from('classes')
      .select('id')
      .eq('join_code', joinCode)
      .maybeSingle()
    if (!existing) break
    joinCode = generateJoinCode()
    attempts++
  }

  const { data, error } = await supabase
    .from('classes')
    .insert({ teacher_id: user.id, name, join_code: joinCode, school_id: schoolId })
    .select('id')
    .single()

  if (error) return { error: error.message }

  await supabase.from('teacher_school_settings').upsert(
    { teacher_id: user.id, school_id: schoolId },
    { onConflict: 'teacher_id' }
  )

  revalidatePath('/lop')
  return { success: true, classId: data.id, joinCode }
}

export async function joinClass(input: { joinCode: string; studentDisplayName: string; birthDate: string }) {
  const supabase = createClient()
  const result = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in result) return { error: result.error }
  const { user } = result

  const code = input.joinCode?.trim().toUpperCase()
  if (!code) return { error: 'Vui lòng nhập mã tham gia.' }

  const displayName = input.studentDisplayName?.replace(/\s+/g, ' ').trim() ?? ''
  if (displayName.length < 2) return { error: 'Họ tên quá ngắn (ít nhất 2 ký tự).' }
  if (displayName.length > 120) return { error: 'Họ tên quá dài.' }

  const birthRaw = input.birthDate?.trim() ?? ''
  if (!birthRaw) return { error: 'Vui lòng chọn ngày sinh.' }
  if (!isValidStudentDobIso(birthRaw)) return { error: 'Ngày sinh không hợp lệ.' }

  const { data: cls, error: clsErr } = await supabase
    .from('classes')
    .select('id')
    .eq('join_code', code)
    .single()

  if (clsErr || !cls) return { error: 'Mã không hợp lệ.' }

  const { data: existing } = await supabase
    .from('class_members')
    .select('id')
    .eq('class_id', cls.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) return { error: 'Bạn đã trong lớp này.' }

  const { error: insertErr } = await supabase.from('class_members').insert({
    class_id: cls.id,
    user_id: user.id,
    member_display_name: displayName,
    birth_date: birthRaw,
  })

  if (insertErr) return { error: insertErr.message }
  revalidatePath('/lop')
  revalidatePath(`/lop/${cls.id}`)
  return { success: true, classId: cls.id }
}

export async function removeClassMember(classId: string, memberUserId: string) {
  const supabase = createClient()
  const result = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in result) return { error: result.error }
  const { user } = result

  const cid = classId?.trim()
  const mid = memberUserId?.trim()
  if (!cid || !mid) return { error: 'Thiếu thông tin.' }

  const { data: cls } = await supabase.from('classes').select('teacher_id').eq('id', cid).maybeSingle()
  if (!cls || cls.teacher_id !== user.id) return { error: 'Bạn không có quyền xóa thành viên.' }
  if (mid === cls.teacher_id) return { error: 'Không thể xóa chủ lớp khỏi danh sách này.' }

  const { error } = await supabase.from('class_members').delete().eq('class_id', cid).eq('user_id', mid)
  if (error) return { error: error.message }
  revalidatePath('/lop')
  revalidatePath(`/lop/${cid}`)
  return { success: true }
}

export async function leaveClass(classId: string) {
  const supabase = createClient()
  const result = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in result) return { error: result.error }
  const { user } = result

  const cid = classId?.trim()
  if (!cid) return { error: 'Thiếu thông tin.' }

  const { data: cls } = await supabase.from('classes').select('teacher_id').eq('id', cid).maybeSingle()
  if (!cls) return { error: 'Không tìm thấy lớp.' }
  if (cls.teacher_id === user.id) return { error: 'Giáo viên chủ lớp không thể rời lớp bằng cách này.' }

  const { data: row } = await supabase
    .from('class_members')
    .select('user_id')
    .eq('class_id', cid)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!row) return { error: 'Bạn không có trong lớp này.' }

  const { error } = await supabase.from('class_members').delete().eq('class_id', cid).eq('user_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/lop')
  revalidatePath(`/lop/${cid}`)
  return { success: true }
}

export async function assignWorksheetToClass(classId: string, worksheetId: string) {
  const supabase = createClient()
  const result = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in result) return { error: result.error }

  const { data: cls, error: clsErr } = await supabase
    .from('classes')
    .select('id, teacher_id')
    .eq('id', classId)
    .single()

  if (clsErr || !cls || cls.teacher_id !== result.user.id) return { error: 'Không có quyền.' }

  const { error } = await supabase.from('class_worksheets').upsert(
    { class_id: classId, worksheet_id: worksheetId },
    { onConflict: 'class_id,worksheet_id' }
  )
  if (error) return { error: error.message }
  revalidatePath(`/lop/${classId}`)
  return { success: true }
}

export async function removeWorksheetFromClass(classId: string, worksheetId: string) {
  const supabase = createClient()
  const result = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in result) return { error: result.error }

  const { data: cls } = await supabase
    .from('classes')
    .select('teacher_id')
    .eq('id', classId)
    .single()

  if (!cls || cls.teacher_id !== result.user.id) return { error: 'Không có quyền.' }

  const { error } = await supabase
    .from('class_worksheets')
    .delete()
    .eq('class_id', classId)
    .eq('worksheet_id', worksheetId)
  if (error) return { error: error.message }
  revalidatePath(`/lop/${classId}`)
  return { success: true }
}

/**
 * HS mở link đề thi gắn lớp: tham gia lớp bằng họ tên + ngày sinh (mã phiên thi hợp lệ thay cho mã lớp).
 */
export async function joinClassForActiveExam(input: {
  examCode: string
  studentDisplayName: string
  birthDate: string
}) {
  const supabase = createClient()
  const result = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in result) return { error: result.error }
  const { user } = result

  const examCode = input.examCode?.trim().toUpperCase()
  if (!examCode || examCode.length < 4) return { error: 'Mã bài thi không hợp lệ.' }

  const displayName = input.studentDisplayName?.replace(/\s+/g, ' ').trim() ?? ''
  if (displayName.length < 2) return { error: 'Họ tên quá ngắn (ít nhất 2 ký tự).' }
  if (displayName.length > 120) return { error: 'Họ tên quá dài.' }

  const birthRaw = input.birthDate?.trim() ?? ''
  if (!birthRaw) return { error: 'Vui lòng chọn ngày sinh.' }
  if (!isValidStudentDobIso(birthRaw)) return { error: 'Ngày sinh không hợp lệ.' }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !serviceKey?.trim()) {
    return { error: 'Máy chủ chưa cấu hình đầy đủ.' }
  }

  const admin = createServiceRoleClient(url, serviceKey, { auth: { persistSession: false } })
  const { data: session, error: sessErr } = await admin
    .from('exam_sessions')
    .select('id, class_id, status')
    .eq('code', examCode)
    .maybeSingle()

  if (sessErr || !session || session.status !== 'active') {
    return { error: 'Không tìm thấy bài thi hoặc bài thi đã đóng.' }
  }
  const classId = session.class_id ? String(session.class_id) : ''
  if (!classId) return { error: 'Đề thi này không gắn lớp.' }

  const { data: existing } = await supabase
    .from('class_members')
    .select('id, member_display_name, birth_date')
    .eq('class_id', classId)
    .eq('user_id', user.id)
    .maybeSingle()

  const alreadyComplete =
    existing &&
    String(existing.member_display_name ?? '').trim().length > 0 &&
    existing.birth_date != null
  if (alreadyComplete) {
    revalidatePath('/lop')
    revalidatePath(`/lop/${classId}`)
    revalidatePath(`/lam-bai/${input.examCode.trim()}`)
    return { success: true, classId }
  }

  if (existing) {
    const { error: updErr } = await supabase
      .from('class_members')
      .update({ member_display_name: displayName, birth_date: birthRaw })
      .eq('class_id', classId)
      .eq('user_id', user.id)
    if (updErr) return { error: updErr.message }
  } else {
    const { error: insertErr } = await supabase.from('class_members').insert({
      class_id: classId,
      user_id: user.id,
      member_display_name: displayName,
      birth_date: birthRaw,
    })
    if (insertErr) return { error: insertErr.message }
  }

  revalidatePath('/lop')
  revalidatePath(`/lop/${classId}`)
  revalidatePath(`/lam-bai/${input.examCode.trim()}`)
  return { success: true, classId }
}
