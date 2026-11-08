import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
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
  complete: boolean
}

function normalizeBirthDate(raw: string | null | undefined): string {
  const text = String(raw ?? '').trim().slice(0, 10)
  return isValidStudentDobIso(text) ? text : ''
}

export async function fetchStudentIdentity(userId: string): Promise<StudentIdentity> {
  const empty: StudentIdentity = { givenName: '', gender: null, birthDate: '', complete: false }
  if (!isPgConfigured()) return empty
  const row = await pgQueryOne<{ full_name: string | null; gender: string | null; birth_date: string | null }>(
    `select full_name, gender, birth_date::text as birth_date
     from public.profiles
     where id = $1::uuid
     limit 1`,
    [userId]
  )
  const givenName = stripTeacherHonorific(String(row?.full_name ?? '')).slice(0, 120)
  const gender = parseTeacherGender(row?.gender)
  const birthDate = normalizeBirthDate(row?.birth_date)
  return {
    givenName,
    gender,
    birthDate,
    complete: givenName.length >= 2 && gender != null && birthDate.length > 0,
  }
}

/** Lưu họ tên, ngày sinh, giới tính. Mọi lớp của học sinh này đổi theo. */
export async function saveStudentIdentity(opts: {
  userId: string
  fullName: string
  gender: TeacherGender
  birthDate: string
}): Promise<{ ok: true; givenName: string; birthDate: string; gender: TeacherGender } | { ok: false; error: string }> {
  if (!isPgConfigured()) return { ok: false, error: 'database_not_configured' }
  const givenName = stripTeacherHonorific(opts.fullName).slice(0, 120)
  if (givenName.length < 2) return { ok: false, error: 'name_required' }
  const birthDate = normalizeBirthDate(opts.birthDate)
  if (!birthDate) return { ok: false, error: 'birth_required' }
  const publicName = formatTeacherPublicName(givenName, opts.gender, 'vi')
  if (!publicName) return { ok: false, error: 'name_required' }
  try {
    await pgQuery(
      `insert into public.profiles (id, full_name, gender, birth_date, updated_at)
       values ($1::uuid, $2, $3, $4::date, now())
       on conflict (id) do update set
         full_name = excluded.full_name,
         gender = excluded.gender,
         birth_date = excluded.birth_date,
         updated_at = now()`,
      [opts.userId, givenName, opts.gender, birthDate]
    )
    await pgQuery(
      `update public.class_members
       set member_display_name = $2, birth_date = $3::date
       where user_id = $1::uuid`,
      [opts.userId, givenName, birthDate]
    )
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
    return { ok: true, givenName, birthDate, gender: opts.gender }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
