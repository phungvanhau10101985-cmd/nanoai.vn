import type { GuestProfileGender } from '@/lib/db/messaging-guest-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export type LearnerProfileRow = {
  full_name: string | null
  english_coach_job: string | null
  english_coach_city: string | null
  english_coach_age: number | null
  english_coach_gender: string | null
}

export async function fetchLearnerProfileFields(userId: string): Promise<LearnerProfileRow | null> {
  if (!isPgConfigured()) return null
  return pgQueryOne<LearnerProfileRow>(
    `select full_name, english_coach_job, english_coach_city, english_coach_age, english_coach_gender
     from public.profiles where id = $1::uuid limit 1`,
    [userId]
  )
}

export async function updateLearnerProfileFields(
  userId: string,
  input: {
    full_name: string
    english_coach_job: string | null
    english_coach_city: string | null
    english_coach_age: number
    english_coach_gender: string
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isPgConfigured()) return { ok: false, error: 'database_not_configured' }
  try {
    const res = await pgQuery<{ id: string }>(
      `update public.profiles set
        full_name = $2,
        english_coach_job = $3,
        english_coach_city = $4,
        english_coach_age = $5,
        english_coach_gender = $6,
        updated_at = now()
      where id = $1::uuid
      returning id`,
      [
        userId,
        input.full_name,
        input.english_coach_job,
        input.english_coach_city,
        input.english_coach_age,
        input.english_coach_gender,
      ]
    )
    if (!res.length) return { ok: false, error: 'profile_not_found' }
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }
}

export async function fetchProfileGender(userId: string): Promise<string | null> {
  if (!isPgConfigured()) return null
  const row = await pgQueryOne<{ gender: string | null }>(
    'select gender from public.profiles where id = $1::uuid limit 1',
    [userId]
  )
  return row?.gender ?? null
}

export async function updateProfileGender(
  userId: string,
  gender: 'male' | 'female'
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isPgConfigured()) return { ok: false, error: 'database_not_configured' }
  try {
    const res = await pgQuery<{ id: string }>(
      `update public.profiles set gender = $2, updated_at = now() where id = $1::uuid returning id`,
      [userId, gender]
    )
    if (!res.length) return { ok: false, error: 'profile_not_found' }
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }
}

/** Ngày sinh + giới tính trên hệ thống NanoAI (không theo shop) — `profiles.id` = `auth.users.id`. */
export async function fetchNanoaiChatProfileFromPg(
  userId: string
): Promise<{ birthDate: string | null; gender: GuestProfileGender | null } | null> {
  if (!isPgConfigured()) return null
  const uid = userId.trim()
  if (!uid || !UUID_RE.test(uid)) return null
  try {
    const row = await pgQueryOne<{ birth_date: string | null; gender: string | null }>(
      `select birth_date::text as birth_date, gender
       from public.profiles
       where id = $1::uuid
       limit 1`,
      [uid]
    )
    if (!row) return null
    const g = row.gender?.trim().toLowerCase()
    const gender: GuestProfileGender | null = g === 'male' || g === 'female' ? g : null
    return {
      birthDate: row.birth_date?.trim() || null,
      gender,
    }
  } catch (e) {
    console.warn('[profiles-repo] fetchNanoaiChatProfileFromPg', e)
    return null
  }
}

export async function updateNanoaiChatProfilePg(
  userId: string,
  fields: { birthDateIso: string; gender: GuestProfileGender }
): Promise<boolean> {
  if (!isPgConfigured()) return false
  const uid = userId.trim()
  if (!uid || !UUID_RE.test(uid)) return false
  const d = fields.birthDateIso.trim()
  if (!ISO_DATE_RE.test(d)) return false
  const y = Number.parseInt(d.slice(0, 4), 10)
  if (!Number.isFinite(y) || y < 1900 || y > 2100) return false
  const todayIso = new Date().toISOString().slice(0, 10)
  if (d > todayIso) return false
  try {
    const row = await pgQueryOne<{ id: string }>(
      `insert into public.profiles (id, birth_date, gender, updated_at)
       values ($1::uuid, $2::date, $3::text, now())
       on conflict (id) do update set
         birth_date = excluded.birth_date,
         gender = excluded.gender,
         updated_at = now()
       returning id::text`,
      [uid, d, fields.gender]
    )
    if (row != null) {
      await pgQuery(
        `insert into public.credits (user_id, balance)
         values ($1::uuid, 0)
         on conflict (user_id) do nothing`,
        [uid]
      )
    }
    return row != null
  } catch (e) {
    console.warn('[profiles-repo] updateNanoaiChatProfilePg', e)
    return false
  }
}
