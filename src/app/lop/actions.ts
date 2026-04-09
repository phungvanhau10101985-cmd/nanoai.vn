'use server'

import { getUserForAction } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { isPgConfigured } from '@/lib/db/pool'
import {
  classExistsWithJoinCodePg,
  classMemberExistsPg,
  deleteClassWorksheetForTeacherPg,
  fetchClassIdByJoinCodePg,
  fetchClassMemberBriefForUserPg,
  fetchClassTeacherAndSchoolIdPg,
  fetchTeacherSchoolSettingsPrevMinePg,
  insertClassMemberPg,
  insertClassMinePg,
  removeClassMemberPg,
  schoolExistsByIdPg,
  updateClassMemberDisplayNameForTeacherPg,
  updateClassMemberProfilePg,
  updateClassStudentFacingLabelsPg,
  upsertClassWorksheetForTeacherPg,
  upsertTeacherSchoolSettingsMinePg,
} from '@/lib/db/classes-pg'
import { fetchExamSessionForClassJoinByCodePg } from '@/lib/db/exam-session-pg'
import { isValidStudentDobIso } from '@/lib/student-dob'

function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

function normalizeFacingLabel(raw: string, maxLen: number): string {
  const s = raw.replace(/\s+/g, ' ').trim()
  if (!s) return ''
  return s.length > maxLen ? s.slice(0, maxLen) : s
}

const DB_ERR = 'Chưa cấu hình cơ sở dữ liệu hoặc lỗi kết nối.'

export async function createClass(formData: FormData) {
  const result = await getUserForAction()
  if ('error' in result) return { error: result.error }
  const { user } = result
  if (!isPgConfigured()) return { error: DB_ERR }

  const name = formData.get('name')?.toString()?.trim()
  if (!name) return { error: 'Vui lòng nhập tên lớp.' }

  const schoolId = formData.get('schoolId')?.toString()?.trim()
  if (!schoolId) return { error: 'Vui lòng chọn trường trước khi tạo lớp.' }

  const schoolOk = await schoolExistsByIdPg(schoolId)
  if (schoolOk === null) return { error: DB_ERR }
  if (!schoolOk) return { error: 'Không tìm thấy trường đã chọn.' }

  const subjectLabel = normalizeFacingLabel(formData.get('subjectLabel')?.toString() ?? '', 120)
  const teacherDisplayName = normalizeFacingLabel(formData.get('teacherDisplayName')?.toString() ?? '', 120)

  let joinCode = generateJoinCode()
  let attempts = 0
  while (attempts < 10) {
    const taken = await classExistsWithJoinCodePg(joinCode)
    if (taken === null) return { error: DB_ERR }
    if (!taken) break
    joinCode = generateJoinCode()
    attempts++
  }

  const inserted = await insertClassMinePg({
    teacherId: user.id,
    name,
    joinCode,
    schoolId,
    gradeLevelId: null,
    subjectLabel: subjectLabel || null,
    teacherDisplayName: teacherDisplayName || null,
  })
  if (!inserted) return { error: 'Không tạo được lớp.' }

  const prevSetting = await fetchTeacherSchoolSettingsPrevMinePg(user.id)
  await upsertTeacherSchoolSettingsMinePg({
    teacherId: user.id,
    schoolId,
    teacherDisplayName: teacherDisplayName || prevSetting?.teacher_display_name || null,
    defaultSubjectLabel: subjectLabel || prevSetting?.default_subject_label || null,
  })

  revalidatePath('/lop')
  return { success: true, classId: inserted.id, joinCode }
}

export async function updateClassStudentFacingInfo(input: {
  classId: string
  subjectLabel: string
  teacherDisplayName: string
  saveAsDefaults?: boolean
}) {
  const result = await getUserForAction()
  if ('error' in result) return { error: result.error }
  const { user } = result
  if (!isPgConfigured()) return { error: DB_ERR }

  const cid = input.classId?.trim()
  if (!cid) return { error: 'Thiếu thông tin.' }

  const subjectLabel = normalizeFacingLabel(input.subjectLabel ?? '', 120)
  const teacherDisplayName = normalizeFacingLabel(input.teacherDisplayName ?? '', 120)

  const cls = await fetchClassTeacherAndSchoolIdPg(cid)
  if (!cls) return { error: DB_ERR }
  if (cls.teacher_id !== user.id) return { error: 'Bạn không có quyền.' }

  const ok = await updateClassStudentFacingLabelsPg({
    classId: cid,
    teacherUserId: user.id,
    subjectLabel: subjectLabel || null,
    teacherDisplayName: teacherDisplayName || null,
  })
  if (ok !== true) return { error: 'Không cập nhật được.' }

  if (input.saveAsDefaults && cls.school_id) {
    const prevSetting = await fetchTeacherSchoolSettingsPrevMinePg(user.id)
    await upsertTeacherSchoolSettingsMinePg({
      teacherId: user.id,
      schoolId: String(cls.school_id),
      teacherDisplayName: teacherDisplayName || prevSetting?.teacher_display_name || null,
      defaultSubjectLabel: subjectLabel || prevSetting?.default_subject_label || null,
    })
  }

  revalidatePath('/lop')
  revalidatePath(`/lop/${cid}`)
  revalidatePath('/tao-bai-thi')
  revalidatePath('/tao-bai-tap-ve-nha')
  return { success: true }
}

export async function joinClass(input: { joinCode: string; studentDisplayName: string; birthDate: string }) {
  const result = await getUserForAction()
  if ('error' in result) return { error: result.error }
  const { user } = result
  if (!isPgConfigured()) return { error: DB_ERR }

  const code = input.joinCode?.trim().toUpperCase()
  if (!code) return { error: 'Vui lòng nhập mã tham gia.' }

  const displayName = input.studentDisplayName?.replace(/\s+/g, ' ').trim() ?? ''
  if (displayName.length < 2) return { error: 'Họ tên quá ngắn (ít nhất 2 ký tự).' }
  if (displayName.length > 120) return { error: 'Họ tên quá dài.' }

  const birthRaw = input.birthDate?.trim() ?? ''
  if (!birthRaw) return { error: 'Vui lòng chọn ngày sinh.' }
  if (!isValidStudentDobIso(birthRaw)) return { error: 'Ngày sinh không hợp lệ.' }

  const classId = await fetchClassIdByJoinCodePg(code)
  if (!classId) return { error: 'Mã không hợp lệ.' }

  const exists = await classMemberExistsPg(classId, user.id)
  if (exists === null) return { error: DB_ERR }
  if (exists) return { error: 'Bạn đã trong lớp này.' }

  const ins = await insertClassMemberPg({
    classId,
    userId: user.id,
    memberDisplayName: displayName,
    birthDateIso: birthRaw,
  })
  if (ins !== true) return { error: 'Không thể tham gia lớp.' }

  revalidatePath('/lop')
  revalidatePath(`/lop/${classId}`)
  return { success: true, classId }
}

export async function removeClassMember(classId: string, memberUserId: string) {
  const result = await getUserForAction()
  if ('error' in result) return { error: result.error }
  const { user } = result
  if (!isPgConfigured()) return { error: DB_ERR }

  const cid = classId?.trim()
  const mid = memberUserId?.trim()
  if (!cid || !mid) return { error: 'Thiếu thông tin.' }

  const res = await removeClassMemberPg(cid, user.id, mid)
  if (res === null) return { error: DB_ERR }
  if (res === 'not_teacher') return { error: 'Bạn không có quyền xóa thành viên.' }
  if (res === 'cannot_remove_owner') return { error: 'Không thể xóa chủ lớp khỏi danh sách này.' }
  if (res === 'not_found') return { error: 'Không tìm thấy thành viên.' }

  revalidatePath('/lop')
  revalidatePath(`/lop/${cid}`)
  return { success: true }
}

/** GV đổi tên hiển thị học sinh trong lớp (`member_display_name`), không sửa profile OAuth. */
export async function updateStudentDisplayNameInClass(
  classId: string,
  memberUserId: string,
  displayName: string
) {
  const result = await getUserForAction()
  if ('error' in result) return { error: result.error }
  const { user } = result
  if (!isPgConfigured()) return { error: DB_ERR }

  const cid = classId?.trim()
  const mid = memberUserId?.trim()
  if (!cid || !mid) return { error: 'Thiếu thông tin.' }

  const name = displayName?.replace(/\s+/g, ' ').trim() ?? ''
  if (name.length < 2) return { error: 'Họ tên quá ngắn (ít nhất 2 ký tự).' }
  if (name.length > 120) return { error: 'Họ tên quá dài.' }

  const res = await updateClassMemberDisplayNameForTeacherPg({
    classId: cid,
    teacherUserId: user.id,
    memberUserId: mid,
    displayName: name,
  })
  if (res === null) return { error: DB_ERR }
  if (res === 'not_teacher') return { error: 'Bạn không có quyền.' }
  if (res === 'cannot_edit_owner') return { error: 'Không thể đổi tên chủ lớp tại đây.' }
  if (res === 'member_not_found') return { error: 'Không tìm thấy học sinh trong lớp.' }

  revalidatePath('/lop')
  revalidatePath(`/lop/${cid}`)
  return { success: true }
}

export async function assignWorksheetToClass(classId: string, worksheetId: string) {
  const result = await getUserForAction()
  if ('error' in result) return { error: result.error }
  if (!isPgConfigured()) return { error: DB_ERR }

  const res = await upsertClassWorksheetForTeacherPg(classId, worksheetId, result.user.id)
  if (res === null) return { error: DB_ERR }
  if (res === 'forbidden') return { error: 'Không có quyền.' }

  revalidatePath(`/lop/${classId}`)
  revalidatePath(`/lop/${classId}/phieu-bai-tap`)
  return { success: true }
}

export async function removeWorksheetFromClass(classId: string, worksheetId: string) {
  const result = await getUserForAction()
  if ('error' in result) return { error: result.error }
  if (!isPgConfigured()) return { error: DB_ERR }

  const res = await deleteClassWorksheetForTeacherPg(classId, worksheetId, result.user.id)
  if (res === null) return { error: DB_ERR }
  if (res === 'forbidden') return { error: 'Không có quyền.' }

  revalidatePath(`/lop/${classId}`)
  revalidatePath(`/lop/${classId}/phieu-bai-tap`)
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
  const result = await getUserForAction()
  if ('error' in result) return { error: result.error }
  const { user } = result
  if (!isPgConfigured()) return { error: DB_ERR }

  const examCode = input.examCode?.trim().toUpperCase()
  if (!examCode || examCode.length < 4) return { error: 'Mã bài thi không hợp lệ.' }

  const displayName = input.studentDisplayName?.replace(/\s+/g, ' ').trim() ?? ''
  if (displayName.length < 2) return { error: 'Họ tên quá ngắn (ít nhất 2 ký tự).' }
  if (displayName.length > 120) return { error: 'Họ tên quá dài.' }

  const birthRaw = input.birthDate?.trim() ?? ''
  if (!birthRaw) return { error: 'Vui lòng chọn ngày sinh.' }
  if (!isValidStudentDobIso(birthRaw)) return { error: 'Ngày sinh không hợp lệ.' }

  const session = await fetchExamSessionForClassJoinByCodePg(examCode)
  if (!session || session.status !== 'active') {
    return { error: 'Không tìm thấy bài thi hoặc bài thi đã đóng.' }
  }
  const classId = session.class_id ? String(session.class_id) : ''
  if (!classId) return { error: 'Đề thi này không gắn lớp.' }

  const existing = await fetchClassMemberBriefForUserPg(classId, user.id)

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
    const upd = await updateClassMemberProfilePg({
      classId,
      userId: user.id,
      memberDisplayName: displayName,
      birthDateIso: birthRaw,
    })
    if (upd !== true) return { error: 'Không cập nhật được thông tin lớp.' }
  } else {
    const ins = await insertClassMemberPg({
      classId,
      userId: user.id,
      memberDisplayName: displayName,
      birthDateIso: birthRaw,
    })
    if (ins !== true) return { error: 'Không thể tham gia lớp.' }
  }

  revalidatePath('/lop')
  revalidatePath(`/lop/${classId}`)
  revalidatePath(`/lam-bai/${input.examCode.trim()}`)
  return { success: true, classId }
}
