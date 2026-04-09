import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

export type SchoolRow = {
  id: string
  name: string
  normalized_name: string
  search_tokens: string
}

export async function searchSchoolsForTeacher(qRaw: string, firstTokenRaw: string): Promise<SchoolRow[]> {
  if (!isPgConfigured()) {
    console.warn('[searchSchoolsForTeacher] DATABASE_URL not set')
    return []
  }
  const safeQ = qRaw.replace(/[%_]/g, '')
  const safeTok = firstTokenRaw.replace(/[%_]/g, '')
  const p1 = `%${safeQ}%`
  const p2 = `%${safeTok}%`
  return pgQuery<SchoolRow>(
    `select id::text, name, normalized_name, coalesce(search_tokens, '') as search_tokens
     from public.schools
     where name ilike $1 or search_tokens ilike $2
     order by name asc
     limit 80`,
    [p1, p2]
  )
}

export async function findSchoolByNormalizedName(normalized: string): Promise<{ id: string; name: string } | null> {
  if (!isPgConfigured()) return null
  const rows = await pgQuery<{ id: string; name: string }>(
    `select id::text, name from public.schools where normalized_name = $1 limit 1`,
    [normalized]
  )
  return rows[0] ?? null
}

/** Theo `id` — dùng khi tạo phiên thi / gắn trường. */
export async function fetchSchoolByIdPg(id: string): Promise<{ id: string; name: string } | null> {
  if (!isPgConfigured()) return null
  try {
    return await pgQueryOne<{ id: string; name: string }>(
      `select id::text, name from public.schools where id = $1::uuid limit 1`,
      [id]
    )
  } catch (e) {
    console.error('[schools-repo] fetchSchoolByIdPg', e)
    return null
  }
}

export async function insertSchool(input: {
  name: string
  normalizedName: string
  searchTokens: string
  createdBy: string
}): Promise<{ id: string; name: string } | null> {
  if (!isPgConfigured()) return null
  const pool = getPgPool()
  const res = await pool.query<{ id: string; name: string }>(
    `insert into public.schools (name, normalized_name, search_tokens, created_by)
     values ($1, $2, $3, $4::uuid)
     returning id::text, name`,
    [input.name, input.normalizedName, input.searchTokens, input.createdBy]
  )
  const row = res.rows[0]
  return row ? { id: row.id, name: row.name } : null
}

export async function upsertTeacherDefaultSchool(teacherId: string, schoolId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isPgConfigured()) {
    return { ok: false, error: 'database_not_configured' }
  }
  try {
    const pool = getPgPool()
    await pool.query(
      `insert into public.teacher_school_settings (teacher_id, school_id, updated_at)
       values ($1::uuid, $2::uuid, now())
       on conflict (teacher_id) do update set
         school_id = excluded.school_id,
         updated_at = now()`,
      [teacherId, schoolId]
    )
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
