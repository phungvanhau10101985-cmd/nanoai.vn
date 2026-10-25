import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { resolveSchoolNameVote } from '@/lib/school-name'

export type SchoolRow = {
  id: string
  name: string
  normalized_name: string
  search_tokens: string
}

export type SchoolWithEditRow = SchoolRow & {
  edited_name: string | null
  edited_normalized: string | null
}

export async function searchSchoolsWithEdits(qRaw: string, normalizedRaw: string): Promise<SchoolWithEditRow[]> {
  if (!isPgConfigured()) return []
  const safeQ = qRaw.replace(/[%_]/g, '')
  const safeNorm = normalizedRaw.replace(/[%_]/g, '')
  return pgQuery<SchoolWithEditRow>(
    `select s.id::text, s.name, s.normalized_name, coalesce(s.search_tokens, '') as search_tokens,
            e.edited_name, e.edited_normalized
     from public.schools s
     left join public.school_name_edits e on e.school_id = s.id
     where s.name ilike $1
        or s.normalized_name ilike $2
        or s.search_tokens ilike $2
        or coalesce(e.edited_name, '') ilike $1
        or coalesce(e.edited_normalized, '') ilike $2
     order by s.name asc
     limit 80`,
    [`%${safeQ}%`, `%${safeNorm}%`]
  )
}

export async function searchSchoolsForTeacher(qRaw: string, normalizedRaw: string): Promise<SchoolRow[]> {
  if (!isPgConfigured()) {
    console.warn('[searchSchoolsForTeacher] DATABASE_URL not set')
    return []
  }
  const safeQ = qRaw.replace(/[%_]/g, '')
  const safeNorm = normalizedRaw.replace(/[%_]/g, '')
  return pgQuery<SchoolRow>(
    `select id::text, name, normalized_name, coalesce(search_tokens, '') as search_tokens
     from public.schools
     where name ilike $1
        or normalized_name ilike $2
        or search_tokens ilike $2
     order by name asc
     limit 80`,
    [`%${safeQ}%`, `%${safeNorm}%`]
  )
}

/** Gắn thêm từ khóa giáo viên đã gõ để lần sau tìm trong DB, không hỏi DeepSeek. */
export async function appendSchoolSearchTokens(schoolId: string, extraRaw: string): Promise<void> {
  if (!isPgConfigured()) return
  const extra = extraRaw.replace(/\s+/g, ' ').trim()
  if (!extra) return
  await getPgPool().query(
    `update public.schools
     set search_tokens = trim(both from concat_ws(' ', nullif(btrim(coalesce(search_tokens, '')), ''), $2))
     where id = $1::uuid
       and position($2 in ' ' || coalesce(search_tokens, '') || ' ') = 0`,
    [schoolId, extra]
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

export async function proposeSchoolNameEdit(input: {
  schoolId: string
  teacherId: string
  editedName: string
  editedNormalized: string
}): Promise<{ ok: true; canonicalName: string } | { ok: false; error: string }> {
  if (!isPgConfigured()) return { ok: false, error: 'database_not_configured' }
  const pool = getPgPool()
  const client = await pool.connect()
  try {
    await client.query('begin')
    const school = await client.query<{ id: string; name: string; normalized_name: string }>(
      `select id::text, name, normalized_name
       from public.schools
       where id = $1::uuid
       for update`,
      [input.schoolId]
    )
    const row = school.rows[0]
    if (!row) {
      await client.query('rollback')
      return { ok: false, error: 'Không tìm thấy trường đã chọn.' }
    }
    if (input.editedNormalized === row.normalized_name) {
      await client.query(`delete from public.school_name_edits where school_id = $1::uuid`, [input.schoolId])
      await client.query('commit')
      return { ok: true, canonicalName: row.name }
    }
    const clash = await client.query<{ id: string }>(
      `select id::text from public.schools
       where normalized_name = $1 and id <> $2::uuid
       limit 1`,
      [input.editedNormalized, input.schoolId]
    )
    if (clash.rows[0]) {
      await client.query('rollback')
      return { ok: false, error: 'Tên trường này đã có.' }
    }
    await client.query(
      `insert into public.school_name_edits
         (school_id, original_name, edited_name, edited_normalized, updated_by, updated_at)
       values ($1::uuid, $2, $3, $4, $5::uuid, now())
       on conflict (school_id) do update set
         original_name = excluded.original_name,
         edited_name = excluded.edited_name,
         edited_normalized = excluded.edited_normalized,
         updated_by = excluded.updated_by,
         updated_at = now()`,
      [input.schoolId, row.name, input.editedName, input.editedNormalized, input.teacherId]
    )
    await client.query(`delete from public.school_name_edit_votes where school_id = $1::uuid`, [input.schoolId])
    await client.query(
      `insert into public.school_name_edit_votes (school_id, teacher_id, choice, updated_at)
       values ($1::uuid, $2::uuid, 'edited', now())`,
      [input.schoolId, input.teacherId]
    )
    await client.query('commit')
    return { ok: true, canonicalName: row.name }
  } catch (e) {
    await client.query('rollback').catch(() => {})
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  } finally {
    client.release()
  }
}

export async function voteSchoolName(input: {
  schoolId: string
  teacherId: string
  choice: 'original' | 'edited'
}): Promise<{ ok: true; canonicalName: string; resolved: 'original' | 'edited' | null } | { ok: false; error: string }> {
  if (!isPgConfigured()) return { ok: false, error: 'database_not_configured' }
  const pool = getPgPool()
  const client = await pool.connect()
  try {
    await client.query('begin')
    const school = await client.query<{ id: string; name: string; normalized_name: string }>(
      `select id::text, name, normalized_name
       from public.schools
       where id = $1::uuid
       for update`,
      [input.schoolId]
    )
    const row = school.rows[0]
    if (!row) {
      await client.query('rollback')
      return { ok: false, error: 'Không tìm thấy trường đã chọn.' }
    }
    const edit = await client.query<{ edited_name: string; edited_normalized: string }>(
      `select edited_name, edited_normalized
       from public.school_name_edits
       where school_id = $1::uuid
       for update`,
      [input.schoolId]
    )
    const pending = edit.rows[0]
    if (!pending) {
      await client.query('commit')
      return { ok: true, canonicalName: row.name, resolved: null }
    }
    await client.query(
      `insert into public.school_name_edit_votes (school_id, teacher_id, choice, updated_at)
       values ($1::uuid, $2::uuid, $3, now())
       on conflict (school_id, teacher_id) do update set
         choice = excluded.choice,
         updated_at = now()`,
      [input.schoolId, input.teacherId, input.choice]
    )
    const counts = await client.query<{ original_votes: number; edited_votes: number }>(
      `select
         count(*) filter (where choice = 'original')::int as original_votes,
         count(*) filter (where choice = 'edited')::int as edited_votes
       from public.school_name_edit_votes
       where school_id = $1::uuid`,
      [input.schoolId]
    )
    const originalVotes = Number(counts.rows[0]?.original_votes ?? 0)
    const editedVotes = Number(counts.rows[0]?.edited_votes ?? 0)
    const resolved = resolveSchoolNameVote(originalVotes, editedVotes, input.choice)
    if (resolved === 'edited') {
      const clash = await client.query<{ id: string }>(
        `select id::text from public.schools
         where normalized_name = $1 and id <> $2::uuid
         limit 1`,
        [pending.edited_normalized, input.schoolId]
      )
      if (clash.rows[0]) {
        await client.query('rollback')
        return { ok: false, error: 'Tên trường này đã có.' }
      }
      await client.query(
        `update public.schools
         set name = $2, normalized_name = $3, search_tokens = $3
         where id = $1::uuid`,
        [input.schoolId, pending.edited_name, pending.edited_normalized]
      )
      await client.query(`delete from public.school_name_edits where school_id = $1::uuid`, [input.schoolId])
      await client.query('commit')
      return { ok: true, canonicalName: pending.edited_name, resolved: 'edited' }
    }
    if (resolved === 'original') {
      await client.query(`delete from public.school_name_edits where school_id = $1::uuid`, [input.schoolId])
      await client.query('commit')
      return { ok: true, canonicalName: row.name, resolved: 'original' }
    }
    const chosenName = input.choice === 'edited' ? pending.edited_name : row.name
    await client.query('commit')
    return { ok: true, canonicalName: chosenName, resolved: null }
  } catch (e) {
    await client.query('rollback').catch(() => {})
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  } finally {
    client.release()
  }
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
