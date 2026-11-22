import { adoptStudentCodeForAccount } from '@/lib/db/class-roster-pg'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { isStudentCode, normalizeStudentCode } from '@/lib/lop/class-roster'
import { isPgConfigured } from '@/lib/db/pool'
import { isValidStudentDobIso } from '@/lib/student-dob'
import {
  formatTeacherPublicName,
  parseTeacherGender,
  stripTeacherHonorific,
  type TeacherGender,
} from '@/lib/lop/teacher-public-name'

export type StudentIdentity = {
  givenName: string
  gender: TeacherGender | null
  birthDate: string
  studentCode: string
  complete: boolean
}

function normalizeBirthDate(raw: string | null | undefined): string {
  const text = String(raw ?? '').trim().slice(0, 10)
  return isValidStudentDobIso(text) ? text : ''
}

export async function fetchStudentIdentity(userId: string): Promise<StudentIdentity> {
  const empty: StudentIdentity = { givenName: '', gender: null, birthDate: '', studentCode: '', complete: false }
  if (!isPgConfigured()) return empty
  let row: {
    full_name: string | null
    gender: string | null
    birth_date: string | null
    student_code: string | null
  } | null = null
  let codeColumn = true
  try {
    row = await pgQueryOne(
      `select full_name, gender, birth_date::text as birth_date, student_code
       from public.profiles
       where id = $1::uuid
       limit 1`,
      [userId]
    )
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String((error as { code?: string }).code) : ''
    if (code !== '42703') return empty
    codeColumn = false
    row = await pgQueryOne(
      `select full_name, gender, birth_date::text as birth_date
       from public.profiles
       where id = $1::uuid
       limit 1`,
      [userId]
    )
  }
  const linked = await linkedStudentIdentity(userId)
  const stored: StudentIdentity = {
    givenName: stripTeacherHonorific(String(row?.full_name ?? '')).slice(0, 120) || linked.givenName,
    gender: parseTeacherGender(row?.gender) ?? linked.gender,
    birthDate: normalizeBirthDate(row?.birth_date) || linked.birthDate,
    studentCode:
      (codeColumn && isStudentCode(normalizeStudentCode(row?.student_code))
        ? normalizeStudentCode(row?.student_code)
        : '') || linked.studentCode,
    complete: false,
  }
  const hinted = await identityHints(userId)
  const givenName = stored.givenName || hinted.givenName
  const birthDate = stored.birthDate || hinted.birthDate
  const studentCode = stored.studentCode || hinted.studentCode
  const gender = stored.gender
  if (codeColumn) {
    await backfillAccountIdentity(userId, stored, { givenName, birthDate, studentCode })
  }
  return {
    givenName,
    gender,
    birthDate,
    studentCode,
    complete: givenName.length >= 2 && gender != null && birthDate.length > 0 && (!codeColumn || isStudentCode(studentCode)),
  }
}

async function linkedStudentIdentity(userId: string): Promise<StudentIdentity> {
  const empty: StudentIdentity = { givenName: '', gender: null, birthDate: '', studentCode: '', complete: false }
  try {
    const row = await pgQueryOne<{
      full_name: string | null
      gender: string | null
      birth_date: string | null
      student_code: string | null
    }>(
      `select p.full_name, p.gender, p.birth_date::text as birth_date, p.student_code
       from auth.users u
       join public.profiles p on p.id = u.id
       where u.raw_user_meta_data->>'linked_google_user_id' = $1::text
       limit 1`,
      [userId]
    )
    if (!row) return empty
    const studentCode = normalizeStudentCode(row.student_code)
    return {
      givenName: stripTeacherHonorific(String(row.full_name ?? '')).slice(0, 120),
      gender: parseTeacherGender(row.gender),
      birthDate: normalizeBirthDate(row.birth_date),
      studentCode: isStudentCode(studentCode) ? studentCode : '',
      complete: false,
    }
  } catch {
    return empty
  }
}

async function identityHints(userId: string): Promise<{ givenName: string; birthDate: string; studentCode: string }> {
  let givenName = ''
  let birthDate = ''
  let studentCode = ''
  try {
    const roster = await pgQueryOne<{
      student_code: string | null
      display_name: string | null
      birth_date: string | null
    }>(
      `select student_code, display_name, birth_date::text as birth_date
       from public.class_roster_entries
       where user_id = $1::uuid
       order by updated_at desc nulls last
       limit 1`,
      [userId]
    )
    const code = normalizeStudentCode(roster?.student_code)
    if (isStudentCode(code)) studentCode = code
    const name = stripTeacherHonorific(String(roster?.display_name ?? '')).slice(0, 120)
    if (name.length >= 2) givenName = name
    birthDate = normalizeBirthDate(roster?.birth_date)
  } catch {
    /* bảng danh sách chưa có */
  }
  try {
    const member = await pgQueryOne<{ member_display_name: string | null; birth_date: string | null }>(
      `select member_display_name, birth_date::text as birth_date
       from public.class_members
       where user_id = $1::uuid
         and nullif(btrim(coalesce(member_display_name, '')), '') is not null
       limit 1`,
      [userId]
    )
    const name = stripTeacherHonorific(String(member?.member_display_name ?? '')).slice(0, 120)
    if (!givenName && name.length >= 2) givenName = name
    if (!birthDate) birthDate = normalizeBirthDate(member?.birth_date)
  } catch {
    /* lớp chưa có cột ngày sinh */
  }
  if (!givenName) {
    try {
      const auth = await pgQueryOne<{ meta_name: string | null }>(
        `select nullif(trim(coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name')), '') as meta_name
         from auth.users
         where id = $1::uuid
         limit 1`,
        [userId]
      )
      const name = stripTeacherHonorific(String(auth?.meta_name ?? '')).slice(0, 120)
      if (name.length >= 2) givenName = name
    } catch {
      /* tên Google không đọc được */
    }
  }
  return { givenName, birthDate, studentCode }
}

async function backfillAccountIdentity(
  userId: string,
  stored: StudentIdentity,
  filled: { givenName: string; birthDate: string; studentCode: string }
): Promise<void> {
  const name = !stored.givenName && filled.givenName ? filled.givenName : null
  const birth = !stored.birthDate && filled.birthDate ? filled.birthDate : null
  let code = !stored.studentCode && filled.studentCode ? filled.studentCode : null
  if (!name && !birth && !code) return
  try {
    if (code) {
      const taken = await pgQueryOne<{ ok: number }>(
        `select 1 as ok from public.profiles where student_code = $1 and id <> $2::uuid limit 1`,
        [code, userId]
      )
      if (taken) code = null
    }
    if (!name && !birth && !code) return
    await pgQuery(
      `insert into public.profiles (id, full_name, birth_date, student_code, updated_at)
       values ($1::uuid, $2, $3::date, $4, now())
       on conflict (id) do update set
         full_name = case
           when char_length(btrim(coalesce(public.profiles.full_name, ''))) >= 2 then public.profiles.full_name
           else coalesce(excluded.full_name, public.profiles.full_name)
         end,
         birth_date = coalesce(public.profiles.birth_date, excluded.birth_date),
         student_code = case
           when nullif(btrim(coalesce(public.profiles.student_code, '')), '') is null
             then coalesce(excluded.student_code, public.profiles.student_code)
           else public.profiles.student_code
         end,
         updated_at = now()`,
      [userId, name, birth, code]
    )
  } catch (error) {
    console.error('[student-identity] backfill', error)
  }
}

/** Lưu họ tên, ngày sinh, giới tính. Mọi lớp của học sinh này đổi theo. */
export async function saveStudentIdentity(opts: {
  userId: string
  fullName: string
  gender: TeacherGender
  birthDate: string
  studentCode: string
}): Promise<
  { ok: true; givenName: string; birthDate: string; gender: TeacherGender; studentCode: string } | { ok: false; error: string }
> {
  if (!isPgConfigured()) return { ok: false, error: 'database_not_configured' }
  const givenName = stripTeacherHonorific(opts.fullName).slice(0, 120)
  if (givenName.length < 2) return { ok: false, error: 'name_required' }
  const birthDate = normalizeBirthDate(opts.birthDate)
  if (!birthDate) return { ok: false, error: 'birth_required' }
  const studentCode = normalizeStudentCode(opts.studentCode)
  if (!isStudentCode(studentCode)) return { ok: false, error: 'code_required' }
  const adopted = await adoptStudentCodeForAccount({
    accountUserId: opts.userId,
    studentCode,
    displayName: givenName,
    birthDateIso: birthDate,
    gender: opts.gender,
  })
  if (adopted === 'schema') return { ok: false, error: 'schema' }
  if (adopted !== 'ok') return { ok: false, error: 'database_not_configured' }
  const publicName = formatTeacherPublicName(givenName, opts.gender, 'vi')
  if (!publicName) return { ok: false, error: 'name_required' }
  try {
    await pgQuery(
      `update public.class_subjects set teacher_display_name = $2 where teacher_id = $1::uuid`,
      [opts.userId, publicName]
    )
    await pgQuery(
      `update public.classes set teacher_display_name = $2 where teacher_id = $1::uuid`,
      [opts.userId, publicName]
    )
    await pgQuery(
      `update public.teacher_school_settings set teacher_display_name = $2 where teacher_id = $1::uuid`,
      [opts.userId, publicName]
    )
    return { ok: true, givenName, birthDate, gender: opts.gender, studentCode }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
