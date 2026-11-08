import type { WebLocale } from '@/lib/i18n/config'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { isPgConfigured } from '@/lib/db/pool'
import {
  formatTeacherPublicName,
  parseTeacherGender,
  stripTeacherHonorific,
  type TeacherGender,
} from '@/lib/lop/teacher-public-name'

export type TeacherIdentity = {
  givenName: string
  gender: TeacherGender | null
  publicName: string | null
}

export async function fetchTeacherIdentity(userId: string, locale: WebLocale = 'vi'): Promise<TeacherIdentity> {
  const empty: TeacherIdentity = { givenName: '', gender: null, publicName: null }
  if (!isPgConfigured()) return empty
  const row = await pgQueryOne<{ full_name: string | null; gender: string | null }>(
    `select full_name, gender from public.profiles where id = $1::uuid limit 1`,
    [userId]
  )
  const givenName = stripTeacherHonorific(String(row?.full_name ?? ''))
  const gender = parseTeacherGender(row?.gender)
  return {
    givenName,
    gender,
    publicName: formatTeacherPublicName(givenName, gender, locale),
  }
}

export async function fetchTeacherPublicNames(
  userIds: string[],
  locale: WebLocale = 'vi'
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const ids = [...new Set(userIds.map((id) => id.trim()).filter(Boolean))]
  if (!isPgConfigured() || ids.length === 0) return map
  const rows = await pgQuery<{ id: string; full_name: string | null; gender: string | null }>(
    `select id::text, full_name, gender
     from public.profiles
     where id = any($1::uuid[])`,
    [ids]
  )
  for (const row of rows) {
    const publicName = formatTeacherPublicName(row.full_name, row.gender, locale)
    if (publicName) map.set(row.id, publicName)
  }
  return map
}

/** Lưu họ tên + giới tính, rồi đổi tên hiển thị trên mọi lớp của giáo viên này. */
export async function saveTeacherIdentity(opts: {
  userId: string
  fullName: string
  gender: TeacherGender
  locale?: WebLocale
}): Promise<{ ok: true; publicName: string } | { ok: false; error: string }> {
  if (!isPgConfigured()) return { ok: false, error: 'database_not_configured' }
  const givenName = stripTeacherHonorific(opts.fullName).slice(0, 80)
  if (!givenName) return { ok: false, error: 'name_required' }
  const publicName = formatTeacherPublicName(givenName, opts.gender, 'vi')
  if (!publicName) return { ok: false, error: 'name_required' }
  try {
    await pgQuery(
      `insert into public.profiles (id, full_name, gender, updated_at)
       values ($1::uuid, $2, $3, now())
       on conflict (id) do update set
         full_name = excluded.full_name,
         gender = excluded.gender,
         updated_at = now()`,
      [opts.userId, givenName, opts.gender]
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
    await pgQuery(
      `update public.class_members set member_display_name = $2 where user_id = $1::uuid`,
      [opts.userId, givenName]
    )
    const localized = formatTeacherPublicName(givenName, opts.gender, opts.locale ?? 'vi') ?? publicName
    return { ok: true, publicName: localized }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
