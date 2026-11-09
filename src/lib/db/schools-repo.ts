import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { resolveSchoolNameVote, schoolIdentityKey } from '@/lib/school-name'

export type SchoolRow = {
  id: string
  name: string
  normalized_name: string
  search_tokens: string
}

export type SchoolWithEditRow = SchoolRow & {
  identity_key: string | null
  edited_name: string | null
  edited_normalized: string | null
}

export async function searchSchoolsWithEdits(
  qRaw: string,
  normalizedRaw: string,
  identityKey = ''
): Promise<SchoolWithEditRow[]> {
  if (!isPgConfigured()) return []
  const safeQ = qRaw.replace(/[%_]/g, '')
  const safeNorm = normalizedRaw.replace(/[%_]/g, '')
  const safeKey = identityKey.trim()
  return pgQuery<SchoolWithEditRow>(
    `select s.id::text, s.name, s.normalized_name, coalesce(s.search_tokens, '') as search_tokens,
            s.identity_key, e.edited_name, e.edited_normalized
     from public.schools s
     left join public.school_name_edits e on e.school_id = s.id
     where s.name ilike $1
        or s.normalized_name ilike $2
        or s.search_tokens ilike $2
        or coalesce(e.edited_name, '') ilike $1
        or coalesce(e.edited_normalized, '') ilike $2
        or ($3 <> '' and s.identity_key = $3)
     order by s.name asc
     limit 80`,
    [`%${safeQ}%`, `%${safeNorm}%`, safeKey]
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
  identityKey?: string
}): Promise<{ id: string; name: string } | null> {
  if (!isPgConfigured()) return null
  const pool = getPgPool()
  const identityKey = input.identityKey?.trim() || schoolIdentityKey(input.name)
  const res = await pool.query<{ id: string; name: string }>(
    `insert into public.schools (name, normalized_name, search_tokens, created_by, identity_key)
     values ($1, $2, $3, $4::uuid, nullif($5, ''))
     returning id::text, name`,
    [input.name, input.normalizedName, input.searchTokens, input.createdBy, identityKey]
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
    const currentKey = schoolIdentityKey(row.name)
    const nextKey = schoolIdentityKey(input.editedName)
    if (currentKey && nextKey && currentKey === nextKey) {
      await client.query('rollback')
      const renamed = await renameSchoolKeepingIdentity({
        schoolId: input.schoolId,
        name: input.editedName,
        normalizedName: input.editedNormalized,
        identityKey: currentKey,
      })
      return renamed
    }
    if (input.editedNormalized === row.normalized_name) {
      await client.query(`delete from public.school_name_edits where school_id = $1::uuid`, [input.schoolId])
      await client.query('commit')
      return { ok: true, canonicalName: row.name }
    }
    const nextIdentity = schoolIdentityKey(input.editedName)
    const clash = await client.query<{ id: string }>(
      `select id::text from public.schools
       where id <> $2::uuid
         and (
           normalized_name = $1
           or ($3 <> '' and identity_key = $3)
         )
       limit 1`,
      [input.editedNormalized, input.schoolId, nextIdentity]
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
      const nextIdentity = schoolIdentityKey(pending.edited_name)
      const clash = await client.query<{ id: string }>(
        `select id::text from public.schools
         where id <> $2::uuid
           and (
             normalized_name = $1
             or ($3 <> '' and identity_key = $3)
           )
         limit 1`,
        [pending.edited_normalized, input.schoolId, nextIdentity]
      )
      if (clash.rows[0]) {
        await client.query('rollback')
        return { ok: false, error: 'Tên trường này đã có.' }
      }
      await client.query(
        `update public.schools
         set name = $2,
             normalized_name = $3,
             search_tokens = trim(both from concat_ws(' ', nullif(btrim(coalesce(search_tokens, '')), ''), $3)),
             identity_key = nullif($4, '')
         where id = $1::uuid`,
        [input.schoolId, pending.edited_name, pending.edited_normalized, nextIdentity]
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

type LockedSchool = {
  id: string
  name: string
  normalized_name: string
  search_tokens: string
  created_at: string
}

export async function findSchoolIdsByIdentity(key: string): Promise<string[]> {
  if (!isPgConfigured() || !key) return []
  const bar = key.indexOf('|')
  const proper = (bar >= 0 ? key.slice(bar + 1) : '').replace(/[%_]/g, '').trim()
  const rows = await pgQuery<{ id: string; name: string; identity_key: string | null }>(
    `select id::text, name, identity_key
     from public.schools
     where identity_key = $1
        or ($2 <> '' and normalized_name ilike '%' || $2 || '%')`,
    [key, proper.length >= 4 ? proper : '']
  )
  return rows
    .filter((row) => (row.identity_key || schoolIdentityKey(row.name)) === key)
    .map((row) => row.id)
}

/** Gộp các dòng cùng khóa. Giữ dòng được trỏ nhiều nhất, rồi dòng tạo trước. */
export async function mergeSchoolIds(
  key: string,
  ids: string[],
  preferredId?: string
): Promise<{ id: string; name: string } | null> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))]
  if (!isPgConfigured() || !key || unique.length === 0) return null
  const pool = getPgPool()
  const client = await pool.connect()
  try {
    await client.query('begin')
    const locked = await client.query<LockedSchool>(
      `select id::text, name, normalized_name, coalesce(search_tokens, '') as search_tokens, created_at::text
       from public.schools
       where id = any($1::uuid[])
       for update`,
      [unique]
    )
    const rows = locked.rows
    if (rows.length === 0) {
      await client.query('rollback')
      return null
    }
    const counts = await client.query<{ school_id: string; refs: number }>(
      `select school_id::text, count(*)::int as refs
       from (
         select school_id from public.classes where school_id = any($1::uuid[])
         union all
         select school_id from public.exam_sessions where school_id = any($1::uuid[])
         union all
         select school_id from public.exam_attempts where school_id = any($1::uuid[])
         union all
         select school_id from public.teacher_school_settings where school_id = any($1::uuid[])
       ) linked
       group by school_id`,
      [rows.map((row) => row.id)]
    )
    const countMap = new Map(counts.rows.map((row) => [row.school_id, Number(row.refs)]))
    let survivor = rows[0]
    if (preferredId && rows.some((row) => row.id === preferredId)) {
      survivor = rows.find((row) => row.id === preferredId) ?? rows[0]
    } else {
      const ranked = rows.slice().sort((a, b) => {
        const diff = (countMap.get(b.id) ?? 0) - (countMap.get(a.id) ?? 0)
        if (diff !== 0) return diff
        if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1
        return a.id < b.id ? -1 : 1
      })
      survivor = ranked[0] ?? rows[0]
    }
    const extraTokens: string[] = []
    for (const row of rows) {
      if (row.id === survivor.id) continue
      if (row.normalized_name) extraTokens.push(row.normalized_name)
      if (row.search_tokens) extraTokens.push(row.search_tokens)
      await client.query(`update public.classes set school_id = $2::uuid where school_id = $1::uuid`, [row.id, survivor.id])
      await client.query(`update public.exam_sessions set school_id = $2::uuid where school_id = $1::uuid`, [
        row.id,
        survivor.id,
      ])
      await client.query(`update public.exam_attempts set school_id = $2::uuid where school_id = $1::uuid`, [
        row.id,
        survivor.id,
      ])
      await client.query(
        `update public.teacher_school_settings set school_id = $2::uuid, updated_at = now() where school_id = $1::uuid`,
        [row.id, survivor.id]
      )
      await client.query(`delete from public.schools where id = $1::uuid`, [row.id])
    }
    const updated = await client.query<{ id: string; name: string }>(
      `update public.schools
       set identity_key = $2,
           search_tokens = trim(both from concat_ws(' ', nullif(btrim(coalesce(search_tokens, '')), ''), nullif($3, '')))
       where id = $1::uuid
       returning id::text, name`,
      [survivor.id, key, extraTokens.join(' ')]
    )
    const edit = await client.query<{ edited_name: string }>(
      `select edited_name from public.school_name_edits where school_id = $1::uuid`,
      [survivor.id]
    )
    if (edit.rows[0]?.edited_name && schoolIdentityKey(edit.rows[0].edited_name) === key) {
      await client.query(`delete from public.school_name_edits where school_id = $1::uuid`, [survivor.id])
    }
    await client.query('commit')
    return updated.rows[0] ?? { id: survivor.id, name: survivor.name }
  } catch (e) {
    await client.query('rollback').catch(() => {})
    throw e
  } finally {
    client.release()
  }
}

export async function ensureOneSchoolForIdentity(key: string): Promise<{ id: string; name: string } | null> {
  if (!key) return null
  const ids = await findSchoolIdsByIdentity(key)
  if (ids.length === 0) return null
  if (ids.length === 1) {
    const row = await pgQueryOne<{ id: string; name: string }>(
      `update public.schools
       set identity_key = $2
       where id = $1::uuid and identity_key is distinct from $2
       returning id::text, name`,
      [ids[0], key]
    )
    if (row) return row
    return fetchSchoolByIdPg(ids[0])
  }
  return mergeSchoolIds(key, ids)
}

export async function renameSchoolKeepingIdentity(input: {
  schoolId: string
  name: string
  normalizedName: string
  identityKey: string
}): Promise<{ ok: true; canonicalName: string } | { ok: false; error: string }> {
  try {
    const ids = await findSchoolIdsByIdentity(input.identityKey)
    if (!ids.includes(input.schoolId)) ids.push(input.schoolId)
    const merged = await mergeSchoolIds(input.identityKey, ids, input.schoolId)
    const schoolId = merged?.id ?? input.schoolId
    await getPgPool().query(
      `update public.schools
       set name = $2,
           normalized_name = $3,
           identity_key = $4,
           search_tokens = trim(both from concat_ws(' ', nullif(btrim(coalesce(search_tokens, '')), ''), normalized_name, $3))
       where id = $1::uuid`,
      [schoolId, input.name, input.normalizedName, input.identityKey]
    )
    await getPgPool().query(`delete from public.school_name_edits where school_id = $1::uuid`, [schoolId])
    return { ok: true, canonicalName: input.name }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (message.toLowerCase().includes('duplicate') || message.includes('schools_normalized_name')) {
      return { ok: false, error: 'Tên trường này đã có.' }
    }
    return { ok: false, error: message }
  }
}

export async function deleteSchoolEditIfSameIdentity(schoolId: string, key: string): Promise<void> {
  if (!isPgConfigured() || !schoolId || !key) return
  const row = await pgQueryOne<{ edited_name: string }>(
    `select edited_name from public.school_name_edits where school_id = $1::uuid`,
    [schoolId]
  )
  if (!row?.edited_name || schoolIdentityKey(row.edited_name) !== key) return
  await pgQuery(`delete from public.school_name_edits where school_id = $1::uuid`, [schoolId])
}

export async function mergeAllSchoolIdentities(): Promise<{ groups: number; removed: number }> {
  const rows = await pgQuery<{ id: string; name: string }>(`select id::text, name from public.schools`)
  const groups = new Map<string, string[]>()
  for (const row of rows) {
    const key = schoolIdentityKey(row.name)
    if (!key) continue
    const list = groups.get(key) ?? []
    list.push(row.id)
    groups.set(key, list)
  }
  let removed = 0
  for (const [key, ids] of groups) {
    if (ids.length > 1) {
      await mergeSchoolIds(key, ids)
      removed += ids.length - 1
    } else {
      await pgQuery(
        `update public.schools set identity_key = $2 where id = $1::uuid and identity_key is distinct from $2`,
        [ids[0], key]
      )
    }
  }
  await pgQuery(
    `create unique index if not exists uq_schools_identity_key
     on public.schools (identity_key)
     where identity_key is not null and identity_key <> ''`
  )
  return { groups: groups.size, removed }
}
