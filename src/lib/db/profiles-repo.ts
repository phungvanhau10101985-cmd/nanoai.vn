import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

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
