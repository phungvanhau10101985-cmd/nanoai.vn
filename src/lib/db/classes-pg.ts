import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

export type ClassJoinPreviewPgRow = {
  id: string
  name: string
  subject_label: string | null
  teacher_display_name: string | null
  school_name: string | null
}

/** `null` = không PG hoặc lỗi — caller caller xử lý khi không có PG. */
export async function fetchClassTeacherIdFromPg(classId: string): Promise<string | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ teacher_id: string }>(
      `select teacher_id::text from public.classes where id = $1::uuid limit 1`,
      [classId]
    )
    return row?.teacher_id ?? null
  } catch (e) {
    console.error('[classes-pg] fetchClassTeacherIdFromPg', e)
    return null
  }
}

/**
 * Đổi tên lớp khi đúng `teacher_id`. Trả `true` nếu có dòng được cập nhật;
 * `null` khi không dùng PG hoặc lỗi — caller xử lý khi không có PG.
 */
export async function updateClassNameForTeacherPg(
  classId: string,
  teacherUserId: string,
  name: string
): Promise<boolean | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ id: string }>(
      `update public.classes
       set name = $3
       where id = $1::uuid and teacher_id = $2::uuid
       returning id::text as id`,
      [classId, teacherUserId, name]
    )
    return row != null
  } catch (e) {
    console.error('[classes-pg] updateClassNameForTeacherPg', e)
    return null
  }
}

/** Xem trước lớp theo mã tham gia. `null` = không PG, lỗi, hoặc không có lớp — caller caller xử lý khi không có PG. */
export async function fetchClassJoinPreviewByJoinCodeFromPg(code: string): Promise<ClassJoinPreviewPgRow | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `select c.id::text as id, c.name, c.subject_label, c.teacher_display_name, sch.name as school_name
       from public.classes c
       left join public.schools sch on sch.id = c.school_id
       where upper(trim(c.join_code)) = upper(trim($1))
       limit 1`,
      [code]
    )
    if (!row) return null
    return {
      id: String(row.id),
      name: String(row.name ?? ''),
      subject_label: row.subject_label != null ? String(row.subject_label) : null,
      teacher_display_name:
        row.teacher_display_name != null ? String(row.teacher_display_name) : null,
      school_name: row.school_name != null ? String(row.school_name) : null,
    }
  } catch (e) {
    console.error('[classes-pg] fetchClassJoinPreviewByJoinCodeFromPg', e)
    return null
  }
}

/** Danh sách lớp của GV — `/api/classes/mine` GET. */
export type ClassMineListRow = {
  id: string
  name: string
  join_code: string
  school_id: string | null
  grade_level_id: string | null
  subject_label: string | null
  teacher_display_name: string | null
  created_at: string
  school_name: string | null
}

export async function fetchClassesMineListForTeacherPg(teacherId: string): Promise<ClassMineListRow[] | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select c.id::text, c.name, c.join_code, c.school_id::text, c.grade_level_id, c.subject_label,
              c.teacher_display_name, c.created_at::text, sch.name as school_name
       from public.classes c
       left join public.schools sch on sch.id = c.school_id
       where c.teacher_id = $1::uuid
       order by c.created_at desc
       limit 200`,
      [teacherId]
    )
    return rows.map((r) => ({
      id: String(r.id),
      name: String(r.name ?? ''),
      join_code: String(r.join_code ?? ''),
      school_id: r.school_id != null ? String(r.school_id) : null,
      grade_level_id: r.grade_level_id != null ? String(r.grade_level_id) : null,
      subject_label: r.subject_label != null ? String(r.subject_label) : null,
      teacher_display_name: r.teacher_display_name != null ? String(r.teacher_display_name) : null,
      created_at: String(r.created_at ?? ''),
      school_name: r.school_name != null ? String(r.school_name) : null,
    }))
  } catch (e) {
    console.error('[classes-pg] fetchClassesMineListForTeacherPg', e)
    return null
  }
}

export async function fetchTeacherSchoolDefaultsMinePg(teacherId: string): Promise<{
  schoolId: string
  schoolName: string
  teacherDisplayName: string
  defaultSubjectLabel: string
} | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `select tss.school_id::text, tss.teacher_display_name, tss.default_subject_label, sch.name as school_name
       from public.teacher_school_settings tss
       left join public.schools sch on sch.id = tss.school_id
       where tss.teacher_id = $1::uuid
       limit 1`,
      [teacherId]
    )
    if (!row?.school_id) return null
    return {
      schoolId: String(row.school_id),
      schoolName: row.school_name != null ? String(row.school_name) : '',
      teacherDisplayName: String(row.teacher_display_name ?? '').trim(),
      defaultSubjectLabel: String(row.default_subject_label ?? '').trim(),
    }
  } catch (e) {
    console.error('[classes-pg] fetchTeacherSchoolDefaultsMinePg', e)
    return null
  }
}

export async function schoolExistsByIdPg(schoolId: string): Promise<boolean | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ ok: number }>(
      `select 1 as ok from public.schools where id = $1::uuid limit 1`,
      [schoolId]
    )
    return row != null
  } catch (e) {
    console.error('[classes-pg] schoolExistsByIdPg', e)
    return null
  }
}

export async function classExistsWithJoinCodePg(joinCode: string): Promise<boolean | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ ok: number }>(
      `select 1 as ok from public.classes where join_code = $1 limit 1`,
      [joinCode]
    )
    return row != null
  } catch (e) {
    console.error('[classes-pg] classExistsWithJoinCodePg', e)
    return null
  }
}

export async function fetchTeacherSchoolSettingsPrevMinePg(teacherId: string): Promise<{
  teacher_display_name: string | null
  default_subject_label: string | null
} | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{
      teacher_display_name: string | null
      default_subject_label: string | null
    }>(
      `select teacher_display_name, default_subject_label
       from public.teacher_school_settings
       where teacher_id = $1::uuid
       limit 1`,
      [teacherId]
    )
    return row
  } catch (e) {
    console.error('[classes-pg] fetchTeacherSchoolSettingsPrevMinePg', e)
    return null
  }
}

export async function insertClassMinePg(params: {
  teacherId: string
  name: string
  joinCode: string
  schoolId: string
  gradeLevelId: string | null
  subjectLabel: string | null
  teacherDisplayName: string | null
}): Promise<ClassMineListRow | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `with ins as (
         insert into public.classes (teacher_id, name, join_code, school_id, grade_level_id, subject_label, teacher_display_name)
         values (
           $1::uuid, $2, $3, $4::uuid,
           nullif(trim(coalesce($5::text, '')), ''),
           nullif(trim(coalesce($6::text, '')), ''),
           nullif(trim(coalesce($7::text, '')), '')
         )
         returning id
       )
       select c.id::text, c.name, c.join_code, c.school_id::text, c.grade_level_id, c.subject_label, c.teacher_display_name,
              c.created_at::text, sch.name as school_name
       from public.classes c
       left join public.schools sch on sch.id = c.school_id
       where c.id = (select id from ins)`,
      [
        params.teacherId,
        params.name,
        params.joinCode,
        params.schoolId,
        params.gradeLevelId ?? '',
        params.subjectLabel ?? '',
        params.teacherDisplayName ?? '',
      ]
    )
    if (!row) return null
    return {
      id: String(row.id),
      name: String(row.name ?? ''),
      join_code: String(row.join_code ?? ''),
      school_id: row.school_id != null ? String(row.school_id) : null,
      grade_level_id: row.grade_level_id != null ? String(row.grade_level_id) : null,
      subject_label: row.subject_label != null ? String(row.subject_label) : null,
      teacher_display_name: row.teacher_display_name != null ? String(row.teacher_display_name) : null,
      created_at: String(row.created_at ?? ''),
      school_name: row.school_name != null ? String(row.school_name) : null,
    }
  } catch (e) {
    console.error('[classes-pg] insertClassMinePg', e)
    return null
  }
}

export async function upsertTeacherSchoolSettingsMinePg(params: {
  teacherId: string
  schoolId: string
  teacherDisplayName: string | null
  defaultSubjectLabel: string | null
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    await pgQuery(
      `insert into public.teacher_school_settings (teacher_id, school_id, teacher_display_name, default_subject_label, updated_at)
       values ($1::uuid, $2::uuid, $3, $4, now())
       on conflict (teacher_id) do update set
         school_id = excluded.school_id,
         teacher_display_name = coalesce(excluded.teacher_display_name, teacher_school_settings.teacher_display_name),
         default_subject_label = coalesce(excluded.default_subject_label, teacher_school_settings.default_subject_label),
         updated_at = now()`,
      [
        params.teacherId,
        params.schoolId,
        params.teacherDisplayName,
        params.defaultSubjectLabel,
      ]
    )
    return true
  } catch (e) {
    console.error('[classes-pg] upsertTeacherSchoolSettingsMinePg', e)
    return false
  }
}

/** Xóa lớp khi đúng `teacher_id`. `null` = không PG hoặc lỗi DB. */
export async function deleteClassByOwnerPg(
  classId: string,
  teacherUserId: string
): Promise<'deleted' | 'not_found' | 'not_owner' | null> {
  if (!isPgConfigured()) return null
  try {
    const owner = await pgQueryOne<{ teacher_id: string }>(
      `select teacher_id::text from public.classes where id = $1::uuid limit 1`,
      [classId]
    )
    if (!owner) return 'not_found'
    if (owner.teacher_id !== teacherUserId) return 'not_owner'
    await pgQuery(`delete from public.classes where id = $1::uuid and teacher_id = $2::uuid`, [
      classId,
      teacherUserId,
    ])
    return 'deleted'
  } catch (e) {
    console.error('[classes-pg] deleteClassByOwnerPg', e)
    return null
  }
}

/**
 * Đủ họ tên + ngày sinh trên `class_members` (giống `getClassMemberExamIdentity` trước đây).
 * `true`/`false`; `null` = không PG hoặc lỗi DB.
 */
export async function hasCompleteClassMemberProfileForExamPg(
  classId: string,
  userId: string
): Promise<boolean | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ member_display_name: string | null; birth_date: unknown }>(
      `select member_display_name, birth_date
       from public.class_members
       where class_id = $1::uuid and user_id = $2::uuid
       limit 1`,
      [classId, userId]
    )
    if (!row) return false
    const displayName = String(row.member_display_name ?? '').replace(/\s+/g, ' ').trim()
    if (displayName.length < 2) return false
    if (row.birth_date == null) return false
    return true
  } catch (e) {
    console.error('[classes-pg] hasCompleteClassMemberProfileForExamPg', e)
    return null
  }
}

/** Giống `getClassMemberExamIdentity` (logic cũ). `null` = không có dòng hoặc chưa đủ thông tin / lỗi DB. */
export async function getClassMemberExamIdentityFromPg(
  classId: string,
  userId: string
): Promise<{ displayName: string; birthDate: string } | null> {
  if (!isPgConfigured()) return null
  try {
    const mem = await pgQueryOne<{ member_display_name: string | null; birth_date: unknown }>(
      `select member_display_name, birth_date
       from public.class_members
       where class_id = $1::uuid and user_id = $2::uuid
       limit 1`,
      [classId, userId]
    )
    if (!mem) return null
    const displayName = String(mem.member_display_name ?? '').replace(/\s+/g, ' ').trim()
    if (displayName.length < 2) return null
    if (mem.birth_date == null) return null
    const birthDate = String(mem.birth_date).slice(0, 10)
    return { displayName, birthDate }
  } catch (e) {
    console.error('[classes-pg] getClassMemberExamIdentityFromPg', e)
    return null
  }
}

/** Tên lớp — SEO / `generateMetadata`. */
export async function fetchClassNameByIdPg(classId: string): Promise<string | null> {
  if (!isPgConfigured()) return null
  try {
    const r = await pgQueryOne<{ name: string | null }>(
      `select name from public.classes where id = $1::uuid limit 1`,
      [classId]
    )
    return r?.name != null ? String(r.name) : null
  } catch (e) {
    console.error('[classes-pg] fetchClassNameByIdPg', e)
    return null
  }
}

/** Trang gán phiếu — đọc lớp (kiểm tra tồn tại). */
export async function fetchClassGateForGanPhieuPg(classId: string): Promise<{
  id: string
  name: string
  teacher_id: string
} | null> {
  if (!isPgConfigured()) return null
  try {
    const r = await pgQueryOne<{ id: string; name: string | null; teacher_id: string }>(
      `select id::text, name, teacher_id::text from public.classes where id = $1::uuid limit 1`,
      [classId]
    )
    if (!r) return null
    return { id: r.id, name: String(r.name ?? ''), teacher_id: r.teacher_id }
  } catch (e) {
    console.error('[classes-pg] fetchClassGateForGanPhieuPg', e)
    return null
  }
}

/** Phiên bài tập về nhà của GV trong lớp — trang gán phiếu. */
export async function fetchHomeworkExamSessionsForGanPhieuPg(
  classId: string,
  teacherId: string
): Promise<
  | Array<{
      id: string
      code: string
      title: string
      status: string
      created_at: string
    }>
  | null
> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<{
      id: string
      code: string | null
      title: string | null
      status: string | null
      created_at: unknown
      is_practice_homework: boolean | null
    }>(
      `select id::text, code, title, status::text, created_at, is_practice_homework
       from public.exam_sessions
       where class_id = $1::uuid and teacher_id = $2::uuid
       order by created_at desc`,
      [classId, teacherId]
    )
    return rows
      .filter((r) => Boolean(r.is_practice_homework))
      .map((r) => ({
        id: r.id,
        code: String(r.code ?? ''),
        title: String(r.title ?? '').trim(),
        status: String(r.status ?? 'active'),
        created_at:
          r.created_at instanceof Date
            ? r.created_at.toISOString()
            : String(r.created_at ?? ''),
      }))
  } catch (e) {
    console.error('[classes-pg] fetchHomeworkExamSessionsForGanPhieuPg', e)
    return null
  }
}

/** Lớp — tạo phiên thi. `not_found` = không có dòng; `null` = lỗi DB / chưa cấu PG. */
export async function fetchClassForExamSessionCreatePg(classId: string): Promise<
  | {
      id: string
      teacher_id: string
      name: string | null
      school_id: string | null
      grade_level_id: string | null
    }
  | 'not_found'
  | null
> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{
      id: string
      teacher_id: string
      name: string | null
      school_id: string | null
      grade_level_id: string | null
    }>(
      `select id::text, teacher_id::text, name, school_id::text, grade_level_id
       from public.classes where id = $1::uuid limit 1`,
      [classId]
    )
    if (!row) return 'not_found'
    return row
  } catch (e) {
    console.error('[classes-pg] fetchClassForExamSessionCreatePg', e)
    return null
  }
}

export async function updateClassSchoolAndGradeIfUnsetPg(
  classId: string,
  teacherUserId: string,
  schoolId: string,
  gradeLevelId: string | null
): Promise<boolean | null> {
  if (!isPgConfigured()) return null
  try {
    const r = await pgQueryOne<{ id: string }>(
      `update public.classes
       set school_id = $3::uuid, grade_level_id = $4
       where id = $1::uuid and teacher_id = $2::uuid
       returning id::text as id`,
      [classId, teacherUserId, schoolId, gradeLevelId]
    )
    return r != null
  } catch (e) {
    console.error('[classes-pg] updateClassSchoolAndGradeIfUnsetPg', e)
    return null
  }
}

export async function updateClassGradeLevelIfDifferentPg(
  classId: string,
  teacherUserId: string,
  gradeLevelId: string
): Promise<boolean | null> {
  if (!isPgConfigured()) return null
  try {
    const r = await pgQueryOne<{ id: string }>(
      `update public.classes
       set grade_level_id = $3
       where id = $1::uuid and teacher_id = $2::uuid
       returning id::text as id`,
      [classId, teacherUserId, gradeLevelId]
    )
    return r != null
  } catch (e) {
    console.error('[classes-pg] updateClassGradeLevelIfDifferentPg', e)
    return null
  }
}

/** Tên lớp + trường (theo `session.school_id` hoặc `classes.school_id`). */
export async function fetchClassAndSchoolDisplayNamesPg(
  classId: string,
  sessionSchoolId: string | null
): Promise<{ className: string | null; schoolName: string | null } | null> {
  if (!isPgConfigured()) return null
  try {
    const cls = await pgQueryOne<{ name: string | null; school_id: string | null }>(
      `select name, school_id::text from public.classes where id = $1::uuid limit 1`,
      [classId]
    )
    const className = cls?.name != null ? String(cls.name) : null
    const schoolId = String(sessionSchoolId ?? cls?.school_id ?? '').trim()
    let schoolName: string | null = null
    if (schoolId) {
      const school = await pgQueryOne<{ name: string | null }>(
        `select name from public.schools where id = $1::uuid limit 1`,
        [schoolId]
      )
      schoolName = school?.name != null ? String(school.name) : null
    }
    return { className, schoolName }
  } catch (e) {
    console.error('[classes-pg] fetchClassAndSchoolDisplayNamesPg', e)
    return null
  }
}

/** Lớp mà user là thành viên (không phải danh sách “lớp tôi dạy”). Trang `/lop`. */
export async function fetchClassesAsMemberForUserPg(userId: string): Promise<ClassMineListRow[] | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select c.id::text, c.name, c.join_code, c.school_id::text, c.grade_level_id, c.subject_label,
              c.teacher_display_name, c.created_at::text, sch.name as school_name
       from public.class_members m
       join public.classes c on c.id = m.class_id
       left join public.schools sch on sch.id = c.school_id
       where m.user_id = $1::uuid
       order by c.created_at desc
       limit 200`,
      [userId]
    )
    return rows.map((r) => ({
      id: String(r.id),
      name: String(r.name ?? ''),
      join_code: String(r.join_code ?? ''),
      school_id: r.school_id != null ? String(r.school_id) : null,
      grade_level_id: r.grade_level_id != null ? String(r.grade_level_id) : null,
      subject_label: r.subject_label != null ? String(r.subject_label) : null,
      teacher_display_name: r.teacher_display_name != null ? String(r.teacher_display_name) : null,
      created_at: String(r.created_at ?? ''),
      school_name: r.school_name != null ? String(r.school_name) : null,
    }))
  } catch (e) {
    console.error('[classes-pg] fetchClassesAsMemberForUserPg', e)
    return null
  }
}

export async function fetchClassIdByJoinCodePg(joinCode: string): Promise<string | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ id: string }>(
      `select id::text from public.classes where upper(trim(join_code)) = upper(trim($1)) limit 1`,
      [joinCode]
    )
    return row?.id ?? null
  } catch (e) {
    console.error('[classes-pg] fetchClassIdByJoinCodePg', e)
    return null
  }
}

export async function classMemberExistsPg(classId: string, memberUserId: string): Promise<boolean | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ ok: number }>(
      `select 1 as ok from public.class_members where class_id = $1::uuid and user_id = $2::uuid limit 1`,
      [classId, memberUserId]
    )
    return row != null
  } catch (e) {
    console.error('[classes-pg] classMemberExistsPg', e)
    return null
  }
}

/** Phiếu đã gán cho lớp — `/phieu-bai-tap/.../lam-bai`. `null` = không PG hoặc lỗi. */
export async function classWorksheetLinkExistsPg(
  classId: string,
  worksheetId: string
): Promise<boolean | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ ok: number }>(
      `select 1 as ok from public.class_worksheets
       where class_id = $1::uuid and worksheet_id = $2::uuid
       limit 1`,
      [classId, worksheetId]
    )
    return row != null
  } catch (e) {
    console.error('[classes-pg] classWorksheetLinkExistsPg', e)
    return null
  }
}

export async function insertClassMemberPg(params: {
  classId: string
  userId: string
  memberDisplayName: string
  birthDateIso: string
}): Promise<boolean | null> {
  if (!isPgConfigured()) return null
  try {
    await pgQuery(
      `insert into public.class_members (class_id, user_id, member_display_name, birth_date)
       values ($1::uuid, $2::uuid, $3, $4::date)`,
      [params.classId, params.userId, params.memberDisplayName, params.birthDateIso]
    )
    return true
  } catch (e) {
    console.error('[classes-pg] insertClassMemberPg', e)
    return null
  }
}

export async function removeClassMemberPg(
  classId: string,
  teacherUserId: string,
  memberUserId: string
): Promise<'ok' | 'not_teacher' | 'cannot_remove_owner' | 'not_found' | null> {
  if (!isPgConfigured()) return null
  try {
    const cls = await pgQueryOne<{ teacher_id: string }>(
      `select teacher_id::text from public.classes where id = $1::uuid limit 1`,
      [classId]
    )
    if (!cls) return 'not_found'
    if (cls.teacher_id !== teacherUserId) return 'not_teacher'
    if (memberUserId === cls.teacher_id) return 'cannot_remove_owner'
    const del = await pgQueryOne<{ user_id: string }>(
      `delete from public.class_members
       where class_id = $1::uuid and user_id = $2::uuid
       returning user_id::text`,
      [classId, memberUserId]
    )
    return del ? 'ok' : 'not_found'
  } catch (e) {
    console.error('[classes-pg] removeClassMemberPg', e)
    return null
  }
}

export async function updateClassMemberDisplayNameForTeacherPg(params: {
  classId: string
  teacherUserId: string
  memberUserId: string
  displayName: string
}): Promise<'ok' | 'not_teacher' | 'cannot_edit_owner' | 'member_not_found' | null> {
  if (!isPgConfigured()) return null
  try {
    const cls = await pgQueryOne<{ teacher_id: string }>(
      `select teacher_id::text from public.classes where id = $1::uuid limit 1`,
      [params.classId]
    )
    if (!cls) return 'not_teacher'
    if (cls.teacher_id !== params.teacherUserId) return 'not_teacher'
    if (params.memberUserId === cls.teacher_id) return 'cannot_edit_owner'
    const mem = await pgQueryOne<{ user_id: string }>(
      `select user_id::text from public.class_members
       where class_id = $1::uuid and user_id = $2::uuid limit 1`,
      [params.classId, params.memberUserId]
    )
    if (!mem) return 'member_not_found'
    const up = await pgQueryOne<{ user_id: string }>(
      `update public.class_members
       set member_display_name = $3
       where class_id = $1::uuid and user_id = $2::uuid
       returning user_id::text`,
      [params.classId, params.memberUserId, params.displayName]
    )
    return up ? 'ok' : null
  } catch (e) {
    console.error('[classes-pg] updateClassMemberDisplayNameForTeacherPg', e)
    return null
  }
}

export async function updateClassStudentFacingLabelsPg(params: {
  classId: string
  teacherUserId: string
  subjectLabel: string | null
  teacherDisplayName: string | null
}): Promise<boolean | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ id: string }>(
      `update public.classes
       set subject_label = $3, teacher_display_name = $4
       where id = $1::uuid and teacher_id = $2::uuid
       returning id::text as id`,
      [params.classId, params.teacherUserId, params.subjectLabel, params.teacherDisplayName]
    )
    return row != null
  } catch (e) {
    console.error('[classes-pg] updateClassStudentFacingLabelsPg', e)
    return null
  }
}

export async function fetchClassTeacherAndSchoolIdPg(
  classId: string
): Promise<{ teacher_id: string; school_id: string | null } | null> {
  if (!isPgConfigured()) return null
  try {
    return await pgQueryOne<{ teacher_id: string; school_id: string | null }>(
      `select teacher_id::text, school_id::text from public.classes where id = $1::uuid limit 1`,
      [classId]
    )
  } catch (e) {
    console.error('[classes-pg] fetchClassTeacherAndSchoolIdPg', e)
    return null
  }
}

export async function upsertClassWorksheetForTeacherPg(
  classId: string,
  worksheetId: string,
  teacherUserId: string
): Promise<'ok' | 'forbidden' | null> {
  if (!isPgConfigured()) return null
  try {
    const gate = await pgQueryOne<{ ok: number }>(
      `select 1 as ok from public.classes where id = $1::uuid and teacher_id = $2::uuid limit 1`,
      [classId, teacherUserId]
    )
    if (!gate) return 'forbidden'
    await pgQuery(
      `insert into public.class_worksheets (class_id, worksheet_id)
       values ($1::uuid, $2::uuid)
       on conflict (class_id, worksheet_id) do update set assigned_at = now()`,
      [classId, worksheetId]
    )
    return 'ok'
  } catch (e) {
    console.error('[classes-pg] upsertClassWorksheetForTeacherPg', e)
    return null
  }
}

export async function deleteClassWorksheetForTeacherPg(
  classId: string,
  worksheetId: string,
  teacherUserId: string
): Promise<'ok' | 'forbidden' | null> {
  if (!isPgConfigured()) return null
  try {
    const gate = await pgQueryOne<{ ok: number }>(
      `select 1 as ok from public.classes where id = $1::uuid and teacher_id = $2::uuid limit 1`,
      [classId, teacherUserId]
    )
    if (!gate) return 'forbidden'
    await pgQuery(
      `delete from public.class_worksheets where class_id = $1::uuid and worksheet_id = $2::uuid`,
      [classId, worksheetId]
    )
    return 'ok'
  } catch (e) {
    console.error('[classes-pg] deleteClassWorksheetForTeacherPg', e)
    return null
  }
}

export async function fetchClassMemberBriefForUserPg(
  classId: string,
  userId: string
): Promise<{
  member_display_name: string | null
  birth_date: unknown
} | null> {
  if (!isPgConfigured()) return null
  try {
    return await pgQueryOne<{
      member_display_name: string | null
      birth_date: unknown
    }>(
      `select member_display_name, birth_date from public.class_members
       where class_id = $1::uuid and user_id = $2::uuid limit 1`,
      [classId, userId]
    )
  } catch (e) {
    console.error('[classes-pg] fetchClassMemberBriefForUserPg', e)
    return null
  }
}

export async function updateClassMemberProfilePg(params: {
  classId: string
  userId: string
  memberDisplayName: string
  birthDateIso: string
}): Promise<boolean | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ user_id: string }>(
      `update public.class_members
       set member_display_name = $3, birth_date = $4::date
       where class_id = $1::uuid and user_id = $2::uuid
       returning user_id::text`,
      [params.classId, params.userId, params.memberDisplayName, params.birthDateIso]
    )
    return row != null
  } catch (e) {
    console.error('[classes-pg] updateClassMemberProfilePg', e)
    return null
  }
}
