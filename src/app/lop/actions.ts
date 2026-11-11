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
  insertClassSubjectPg,
  leaveClassAsStudentPg,
  schoolExistsByIdPg,
  updateClassMemberDisplayNameForTeacherPg,
  updateClassMemberProfilePg,
  updateClassStudentFacingLabelsPg,
  upsertClassWorksheetForTeacherPg,
  upsertTeacherSchoolSettingsMinePg,
} from '@/lib/db/classes-pg'
import { fetchExamSessionForClassJoinByCodePg } from '@/lib/db/exam-session-pg'
import { fetchStudentIdentity } from '@/lib/db/student-identity-pg'
import { fetchTeacherIdentity } from '@/lib/db/teacher-identity-pg'
import { getServerDictionary } from '@/lib/i18n/server'
import { isValidStudentDobIso } from '@/lib/student-dob'
import { parseBillingDay, parseDueDays, parseTuitionAmount, readTutoringTuitionFields } from '@/lib/lop/class-tuition'
import { resolveStoredTeachingSubject } from '@/lib/lop/normalize-teaching-subject'
import {
  beginTutoringTrial,
  readTutoringJoinBlock,
  readTutoringPackage,
  tutoringClassFeatureBlock,
  tutoringCreateGate,
  tutoringTeacherGrace,
} from '@/lib/db/tutoring-package-pg'
import { setClassTuitionPaymentPg, updateTutoringTuitionSettingsPg } from '@/lib/db/class-tuition-pg'

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

  const { t } = getServerDictionary()
  const classKind = formData.get('classKind')?.toString() === 'tutoring' ? 'tutoring' : 'school'
  const schoolId = classKind === 'school' ? formData.get('schoolId')?.toString()?.trim() ?? '' : ''
  const tuition =
    classKind === 'tutoring'
      ? readTutoringTuitionFields({
          amount: formData.get('tuitionMonthlyVnd')?.toString() ?? '',
          days: formData.get('tuitionDueAfterDays')?.toString() ?? '',
          billingDay: formData.get('tuitionBillingDay')?.toString() ?? '',
          bankBin: formData.get('tuitionBankBin')?.toString() ?? '',
          bankName: formData.get('tuitionBankName')?.toString() ?? '',
          accountNo: formData.get('tuitionAccountNo')?.toString() ?? '',
          accountName: formData.get('tuitionAccountName')?.toString() ?? '',
        })
      : null
  if (classKind === 'school') {
    if (!schoolId) return { error: t.classes.createClassSchoolRequired }
    const schoolOk = await schoolExistsByIdPg(schoolId)
    if (schoolOk === null) return { error: DB_ERR }
    if (!schoolOk) return { error: t.classes.createClassSchoolNotFound }
  } else if (!tuition) {
    if (parseTuitionAmount(formData.get('tuitionMonthlyVnd')?.toString() ?? '') == null) {
      return { error: t.classes.tutoringAmountInvalid }
    }
    if (parseDueDays(formData.get('tuitionDueAfterDays')?.toString() ?? '') == null) {
      return { error: t.classes.tutoringDaysInvalid }
    }
    if (parseBillingDay(formData.get('tuitionBillingDay')?.toString() ?? '') == null) {
      return { error: t.classes.tutoringBillingDayInvalid }
    }
    return { error: t.classes.tutoringBankInvalid }
  }

  const subject = classKind === 'tutoring' ? await resolveStoredTeachingSubject(formData.get('subjectId')?.toString() ?? '') : null
  if (classKind === 'tutoring' && !subject) return { error: t.classes.enterClassSubjectRequired }

  let startTutoringTrial = false
  if (classKind === 'tutoring') {
    const gate = await tutoringCreateGate(user.id)
    if (gate === 'grace') return { error: t.classes.tutoringGraceCreateBlocked }
    if (gate === 'slots') {
      const pack = await readTutoringPackage(user.id)
      return { error: t.classes.tutoringSlotsFull.replaceAll('{slots}', String(pack?.slots ?? 0)) }
    }
    if (gate === 'buy') return { error: t.classes.tutoringPackageRequired }
    startTutoringTrial = gate === 'trial'
  }

  const subjectLabel = normalizeFacingLabel(formData.get('subjectLabel')?.toString() ?? '', 120)
  const identity = await fetchTeacherIdentity(user.id, 'vi')
  if (!identity.publicName) return { error: t.classes.teacherIdentityRequired, code: 'profile_required' as const }
  const teacherDisplayName = identity.publicName

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
    schoolId: classKind === 'school' ? schoolId : null,
    gradeLevelId: null,
    subjectLabel: subject?.label || subjectLabel || null,
    teacherDisplayName: teacherDisplayName || null,
    classKind,
    tuitionMonthlyVnd: tuition?.monthlyVnd ?? null,
    tuitionDueAfterDays: tuition?.dueAfterDays ?? null,
    tuitionBillingDay: tuition?.billingDay ?? null,
    tuitionBankBin: tuition?.bankBin ?? null,
    tuitionBankName: tuition?.bankName ?? null,
    tuitionAccountNo: tuition?.accountNo ?? null,
    tuitionAccountName: tuition?.accountName ?? null,
  })
  if (inserted.status === 'name_taken') {
    if (subject) {
      const attached = await insertClassSubjectPg({
        classId: inserted.existing.id,
        teacherId: user.id,
        subjectId: subject.id,
        subjectLabel: subject.label,
        teacherDisplayName: teacherDisplayName || null,
      })
      if (attached === null) return { error: t.classes.enterClassFailed }
    }
    return {
      code: 'class_exists' as const,
      error: 'class_exists',
      existing: {
        classId: inserted.existing.id,
        name: inserted.existing.name,
        joinCode: inserted.existing.join_code,
        schoolName: inserted.existing.school_name,
      },
    }
  }
  if (inserted.status !== 'created') return { error: 'Không tạo được lớp.' }
  if (subject) {
    const attached = await insertClassSubjectPg({
      classId: inserted.row.id,
      teacherId: user.id,
      subjectId: subject.id,
      subjectLabel: subject.label,
      teacherDisplayName: teacherDisplayName || null,
    })
    if (attached === null) return { error: t.classes.enterClassFailed }
  }
  if (startTutoringTrial) await beginTutoringTrial(user.id)

  if (classKind === 'school' && schoolId) {
    const prevSetting = await fetchTeacherSchoolSettingsPrevMinePg(user.id)
    await upsertTeacherSchoolSettingsMinePg({
      teacherId: user.id,
      schoolId,
      teacherDisplayName: teacherDisplayName || prevSetting?.teacher_display_name || null,
      defaultSubjectLabel: subjectLabel || prevSetting?.default_subject_label || null,
    })
  }

  revalidatePath('/lop')
  return { success: true, classId: inserted.row.id, joinCode }
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
  const { t } = getServerDictionary()
  const identity = await fetchTeacherIdentity(user.id, 'vi')
  if (!identity.publicName) return { error: t.classes.teacherIdentityRequired }
  const teacherDisplayName = identity.publicName

  const cls = await fetchClassTeacherAndSchoolIdPg(cid)
  if (!cls) return { error: DB_ERR }
  if (cls.teacher_id !== user.id) return { error: 'Bạn không có quyền.' }
  if ((await tutoringClassFeatureBlock(cid)) === 'grace') return { error: t.classes.tutoringGraceCreateBlocked }

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

export async function updateClassTuitionSettings(input: {
  classId: string
  monthlyVnd: number
  dueAfterDays: number
  billingDay: number
  bankBin: string
  bankName: string
  accountNo: string
  accountName: string
}) {
  const result = await getUserForAction()
  if ('error' in result) return { error: result.error }
  const { user } = result
  if (!isPgConfigured()) return { error: DB_ERR }
  const { t } = getServerDictionary()
  const cid = input.classId?.trim()
  if (!cid) return { error: t.classes.tutoringSettingsFailed }
  const grace = await tutoringTeacherGrace(user.id)
  if (grace.phase === 'grace' || grace.phase === 'lapsed') return { error: t.classes.tutoringGraceCreateBlocked }
  if (parseTuitionAmount(String(input.monthlyVnd ?? '')) == null) return { error: t.classes.tutoringAmountInvalid }
  if (parseDueDays(String(input.dueAfterDays ?? '')) == null) return { error: t.classes.tutoringDaysInvalid }
  if (parseBillingDay(String(input.billingDay ?? '')) == null) return { error: t.classes.tutoringBillingDayInvalid }
  const tuition = readTutoringTuitionFields({
    amount: String(input.monthlyVnd ?? ''),
    days: String(input.dueAfterDays ?? ''),
    billingDay: String(input.billingDay ?? ''),
    bankBin: input.bankBin ?? '',
    bankName: input.bankName ?? '',
    accountNo: input.accountNo ?? '',
    accountName: input.accountName ?? '',
  })
  if (!tuition) return { error: t.classes.tutoringBankInvalid }
  const saved = await updateTutoringTuitionSettingsPg({ classId: cid, teacherId: user.id, tuition })
  if (saved === 'not_owner') return { error: t.classes.tutoringSettingsFailed }
  if (saved !== 'ok') return { error: t.classes.tutoringSettingsFailed }
  revalidatePath('/lop')
  revalidatePath(`/lop/${cid}`)
  revalidatePath(`/lop/${cid}/hoc-sinh`)
  return { success: true }
}

export async function setClassTuitionPayment(input: {
  classId: string
  memberUserId: string
  period: string
  confirmed: boolean
}) {
  const result = await getUserForAction()
  if ('error' in result) return { error: result.error }
  const { user } = result
  if (!isPgConfigured()) return { error: DB_ERR }
  const { t } = getServerDictionary()
  const cid = input.classId?.trim()
  const memberUserId = input.memberUserId?.trim()
  if (!cid || !memberUserId) return { error: t.classes.tutoringConfirmFailed }
  const paymentGrace = await tutoringTeacherGrace(user.id)
  if (paymentGrace.phase === 'grace' || paymentGrace.phase === 'lapsed') {
    return { error: t.classes.tutoringGraceCreateBlocked }
  }
  const saved = await setClassTuitionPaymentPg({
    classId: cid,
    teacherId: user.id,
    memberUserId,
    period: input.period,
    confirmed: input.confirmed,
  })
  if (saved !== 'ok') return { error: t.classes.tutoringConfirmFailed }
  revalidatePath(`/lop/${cid}`)
  revalidatePath(`/lop/${cid}/hoc-sinh`)
  return { success: true }
}

export async function joinClass(input: { joinCode: string }) {
  const result = await getUserForAction()
  if ('error' in result) return { error: result.error }
  const { user } = result
  if (!isPgConfigured()) return { error: DB_ERR }
  const { t } = getServerDictionary()

  const code = input.joinCode?.trim().toUpperCase()
  if (!code) return { error: 'Vui lòng nhập mã tham gia.' }

  const identity = await fetchStudentIdentity(user.id)
  if (!identity.complete || !identity.gender) {
    return { error: t.classes.studentIdentityRequired, code: 'profile_required' as const }
  }

  const classId = await fetchClassIdByJoinCodePg(code)
  if (!classId) return { error: 'Mã không hợp lệ.' }
  const joinBlock = await readTutoringJoinBlock(classId)
  if (joinBlock === 'dissolved') return { error: t.classes.tutoringClassDissolved }
  if (joinBlock === 'closed') return { error: t.classes.tutoringJoinClosed }

  const exists = await classMemberExistsPg(classId, user.id)
  if (exists === null) return { error: DB_ERR }
  if (exists) return { error: 'Bạn đã trong lớp này.' }

  const ins = await insertClassMemberPg({
    classId,
    userId: user.id,
    memberDisplayName: identity.givenName,
    birthDateIso: identity.birthDate,
  })
  if (ins !== true) return { error: 'Không thể tham gia lớp.' }

  revalidatePath('/lop')
  revalidatePath(`/lop/${classId}`)
  return { success: true, classId }
}

export async function removeClassMember(classId: string, memberUserId: string) {
  void classId
  void memberUserId
  const { t } = getServerDictionary()
  return { error: t.classes.leaveClassTeachersCannotRemove }
}

export async function leaveClass(classId: string) {
  const result = await getUserForAction()
  if ('error' in result) return { error: result.error }
  const { user } = result
  if (!isPgConfigured()) return { error: DB_ERR }
  const { t } = getServerDictionary()

  const cid = classId?.trim()
  if (!cid) return { error: t.classes.leaveClassFailed }

  const res = await leaveClassAsStudentPg(cid, user.id)
  if (res === null) return { error: DB_ERR }
  if (res !== 'ok') return { error: t.classes.leaveClassFailed }

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
  const { t } = getServerDictionary()
  if ((await tutoringClassFeatureBlock(cid)) === 'grace') return { error: t.classes.tutoringGraceCreateBlocked }

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

  const { t } = getServerDictionary()
  if ((await tutoringClassFeatureBlock(classId)) === 'grace') return { error: t.classes.tutoringGraceCreateBlocked }
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
  const { t } = getServerDictionary()
  if ((await tutoringClassFeatureBlock(classId)) === 'grace') return { error: t.classes.tutoringGraceCreateBlocked }

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
export async function joinClassForActiveExam(input: { examCode: string }) {
  const result = await getUserForAction()
  if ('error' in result) return { error: result.error }
  const { user } = result
  if (!isPgConfigured()) return { error: DB_ERR }
  const { t } = getServerDictionary()

  const examCode = input.examCode?.trim().toUpperCase()
  if (!examCode || examCode.length < 4) return { error: 'Mã bài thi không hợp lệ.' }

  const identity = await fetchStudentIdentity(user.id)

  const session = await fetchExamSessionForClassJoinByCodePg(examCode)
  if (!session || session.status !== 'active') {
    return { error: 'Không tìm thấy bài thi hoặc bài thi đã đóng.' }
  }
  const classId = session.class_id ? String(session.class_id) : ''
  if (!classId) return { error: 'Đề thi này không gắn lớp.' }

  const existing = await fetchClassMemberBriefForUserPg(classId, user.id)
  const existingName = String(existing?.member_display_name ?? '').replace(/\s+/g, ' ').trim()
  const existingBirth = existing?.birth_date != null ? String(existing.birth_date).slice(0, 10) : ''
  const alreadyComplete = existingName.length >= 2 && isValidStudentDobIso(existingBirth)

  if (!identity.complete || !identity.gender) {
    if (alreadyComplete) {
      revalidatePath('/lop')
      revalidatePath(`/lop/${classId}`)
      revalidatePath(`/lam-bai/${input.examCode.trim()}`)
      return { success: true as const, classId, studentName: existingName, birthDate: existingBirth }
    }
    return { error: t.classes.studentIdentityRequired, code: 'profile_required' as const }
  }

  if (existing) {
    const upd = await updateClassMemberProfilePg({
      classId,
      userId: user.id,
      memberDisplayName: identity.givenName,
      birthDateIso: identity.birthDate,
    })
    if (upd !== true) return { error: 'Không cập nhật được thông tin lớp.' }
  } else {
    const ins = await insertClassMemberPg({
      classId,
      userId: user.id,
      memberDisplayName: identity.givenName,
      birthDateIso: identity.birthDate,
    })
    if (ins !== true) return { error: 'Không thể tham gia lớp.' }
  }

  revalidatePath('/lop')
  revalidatePath(`/lop/${classId}`)
  revalidatePath(`/lam-bai/${input.examCode.trim()}`)
  return { success: true as const, classId, studentName: identity.givenName, birthDate: identity.birthDate }
}
