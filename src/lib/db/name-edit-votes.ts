import type { PoolClient } from 'pg'
import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { foldSubjectLabel, listedClassSubjects, subjectIdFromFreeLabel } from '@/lib/lop/class-subject'
import { CLASS_SUBJECT_NAME_VOTE_THRESHOLD, resolveSchoolNameVote } from '@/lib/school-name'

export type NameEditChoice = 'original' | 'edited'

export type NameEditResult =
  | { ok: true; canonicalName: string; resolved: NameEditChoice | null }
  | { ok: false; error: string }

function foldClassName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().toLowerCase()
}

function voteStoreError(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e)
  if (/does not exist/i.test(message)) {
    return 'Chưa có bảng bình chọn tên. Hãy chạy migration rồi thử lại.'
  }
  return message
}

function tidyLabel(raw: string): string {
  const name = raw.replace(/\s+/g, ' ').trim()
  if (!name) return ''
  return name.charAt(0).toLocaleUpperCase('vi-VN') + name.slice(1)
}

export async function proposeClassNameEdit(input: {
  classId: string
  teacherId: string
  editedName: string
}): Promise<NameEditResult> {
  if (!isPgConfigured()) return { ok: false, error: 'Chưa cấu hình cơ sở dữ liệu.' }
  const editedName = input.editedName.replace(/\s+/g, ' ').trim()
  const editedNormalized = foldClassName(editedName)
  if (editedNormalized.length < 2) return { ok: false, error: 'Tên lớp quá ngắn.' }

  const pool = getPgPool()
  const client = await pool.connect()
  try {
    await client.query('begin')
    const school = await client.query<{ id: string; name: string; school_id: string | null }>(
      `select id::text, name, school_id::text
       from public.classes
       where id = $1::uuid
       for update`,
      [input.classId]
    )
    const row = school.rows[0]
    if (!row) {
      await client.query('rollback')
      return { ok: false, error: 'Không tìm thấy lớp.' }
    }
    if (editedNormalized === foldClassName(row.name)) {
      await client.query(`delete from public.class_name_edits where class_id = $1::uuid`, [input.classId])
      await client.query('commit')
      return { ok: true, canonicalName: row.name, resolved: null }
    }
    if (row.school_id) {
      const clash = await client.query<{ id: string }>(
        `select id::text from public.classes
         where school_id = $1::uuid
           and id <> $2::uuid
           and lower(btrim(regexp_replace(name, '\\s+', ' ', 'g'))) = $3
         limit 1`,
        [row.school_id, input.classId, editedNormalized]
      )
      if (clash.rows[0]) {
        await client.query('rollback')
        return { ok: false, error: 'Trường này đã có lớp trùng tên.' }
      }
    }
    await client.query(
      `insert into public.class_name_edits
         (class_id, original_name, edited_name, edited_normalized, updated_by, updated_at)
       values ($1::uuid, $2, $3, $4, $5::uuid, now())
       on conflict (class_id) do update set
         original_name = excluded.original_name,
         edited_name = excluded.edited_name,
         edited_normalized = excluded.edited_normalized,
         updated_by = excluded.updated_by,
         updated_at = now()`,
      [input.classId, row.name, editedName, editedNormalized, input.teacherId]
    )
    await client.query(`delete from public.class_name_edit_votes where class_id = $1::uuid`, [input.classId])
    await client.query(
      `insert into public.class_name_edit_votes (class_id, teacher_id, choice, updated_at)
       values ($1::uuid, $2::uuid, 'edited', now())`,
      [input.classId, input.teacherId]
    )
    await client.query('commit')
    return { ok: true, canonicalName: row.name, resolved: null }
  } catch (e) {
    await client.query('rollback').catch(() => {})
    return { ok: false, error: voteStoreError(e) }
  } finally {
    client.release()
  }
}

export async function voteClassName(input: {
  classId: string
  teacherId: string
  choice: NameEditChoice
}): Promise<NameEditResult> {
  if (!isPgConfigured()) return { ok: false, error: 'Chưa cấu hình cơ sở dữ liệu.' }
  const pool = getPgPool()
  const client = await pool.connect()
  try {
    await client.query('begin')
    const found = await client.query<{ id: string; name: string; school_id: string | null }>(
      `select id::text, name, school_id::text
       from public.classes
       where id = $1::uuid
       for update`,
      [input.classId]
    )
    const row = found.rows[0]
    if (!row) {
      await client.query('rollback')
      return { ok: false, error: 'Không tìm thấy lớp.' }
    }
    const edit = await client.query<{ edited_name: string; edited_normalized: string }>(
      `select edited_name, edited_normalized
       from public.class_name_edits
       where class_id = $1::uuid
       for update`,
      [input.classId]
    )
    const pending = edit.rows[0]
    if (!pending) {
      await client.query('commit')
      return { ok: true, canonicalName: row.name, resolved: null }
    }
    await client.query(
      `insert into public.class_name_edit_votes (class_id, teacher_id, choice, updated_at)
       values ($1::uuid, $2::uuid, $3, now())
       on conflict (class_id, teacher_id) do update set
         choice = excluded.choice,
         updated_at = now()`,
      [input.classId, input.teacherId, input.choice]
    )
    const counts = await client.query<{ original_votes: number; edited_votes: number }>(
      `select
         count(*) filter (where choice = 'original')::int as original_votes,
         count(*) filter (where choice = 'edited')::int as edited_votes
       from public.class_name_edit_votes
       where class_id = $1::uuid`,
      [input.classId]
    )
    const resolved = resolveSchoolNameVote(
      Number(counts.rows[0]?.original_votes ?? 0),
      Number(counts.rows[0]?.edited_votes ?? 0),
      input.choice,
      CLASS_SUBJECT_NAME_VOTE_THRESHOLD
    )
    if (resolved === 'edited') {
      if (row.school_id) {
        const clash = await client.query<{ id: string }>(
          `select id::text from public.classes
           where school_id = $1::uuid
             and id <> $2::uuid
             and lower(btrim(regexp_replace(name, '\\s+', ' ', 'g'))) = $3
           limit 1`,
          [row.school_id, input.classId, pending.edited_normalized]
        )
        if (clash.rows[0]) {
          await client.query('rollback')
          return { ok: false, error: 'Trường này đã có lớp trùng tên.' }
        }
      }
      await client.query(`update public.classes set name = $2 where id = $1::uuid`, [
        input.classId,
        pending.edited_name,
      ])
      await client.query(`delete from public.class_name_edits where class_id = $1::uuid`, [input.classId])
      await client.query('commit')
      return { ok: true, canonicalName: pending.edited_name, resolved: 'edited' }
    }
    if (resolved === 'original') {
      await client.query(`delete from public.class_name_edits where class_id = $1::uuid`, [input.classId])
      await client.query('commit')
      return { ok: true, canonicalName: row.name, resolved: 'original' }
    }
    const chosenName = input.choice === 'edited' ? pending.edited_name : row.name
    await client.query('commit')
    return { ok: true, canonicalName: chosenName, resolved: null }
  } catch (e) {
    await client.query('rollback').catch(() => {})
    return { ok: false, error: voteStoreError(e) }
  } finally {
    client.release()
  }
}

async function subjectLabelTaken(client: PoolClient, subjectId: string, normalized: string): Promise<boolean> {
  const listed = listedClassSubjects().some(
    (item) => item.id !== subjectId && foldSubjectLabel(item.labelVi) === normalized
  )
  if (listed) return true
  const custom = await client.query(
    `select id, label from public.teaching_subjects where id <> $1 and label is not null limit 400`,
    [subjectId]
  )
  const rows = (custom.rows ?? []) as Array<{ id: string; label?: string }>
  if (rows.some((row) => foldSubjectLabel(String(row.label ?? '')) === normalized)) return true
  const overrides = await client.query(
    `select subject_id, label from public.subject_name_overrides where subject_id <> $1`,
    [subjectId]
  )
  const overrideRows = (overrides.rows ?? []) as Array<{ label?: string }>
  return overrideRows.some((row) => foldSubjectLabel(String(row.label ?? '')) === normalized)
}

export async function proposeSubjectNameEdit(input: {
  subjectId: string
  teacherId: string
  editedName: string
  originalName: string
}): Promise<NameEditResult> {
  if (!isPgConfigured()) return { ok: false, error: 'Chưa cấu hình cơ sở dữ liệu.' }
  const subjectId = input.subjectId.trim()
  const editedName = tidyLabel(input.editedName)
  const originalName = input.originalName.replace(/\s+/g, ' ').trim()
  const editedNormalized = foldSubjectLabel(editedName)
  if (!subjectId || editedNormalized.length < 2) return { ok: false, error: 'Tên môn quá ngắn.' }
  if (editedNormalized === 'khac' || editedNormalized === 'other') {
    return { ok: false, error: 'Không dùng tên Khác.' }
  }
  const mapped = subjectIdFromFreeLabel(editedName)
  if (mapped !== 'khac' && mapped !== subjectId) {
    return { ok: false, error: 'Tên này đã là một môn có sẵn.' }
  }

  const pool = getPgPool()
  const client = await pool.connect()
  try {
    await client.query('begin')
    if (editedNormalized === foldSubjectLabel(originalName)) {
      await client.query(`delete from public.subject_name_edits where subject_id = $1`, [subjectId])
      await client.query('commit')
      return { ok: true, canonicalName: originalName, resolved: null }
    }
    if (await subjectLabelTaken(client, subjectId, editedNormalized)) {
      await client.query('rollback')
      return { ok: false, error: 'Tên môn này đã có.' }
    }
    await client.query(
      `insert into public.subject_name_edits
         (subject_id, original_name, edited_name, edited_normalized, updated_by, updated_at)
       values ($1, $2, $3, $4, $5::uuid, now())
       on conflict (subject_id) do update set
         original_name = excluded.original_name,
         edited_name = excluded.edited_name,
         edited_normalized = excluded.edited_normalized,
         updated_by = excluded.updated_by,
         updated_at = now()`,
      [subjectId, originalName, editedName, editedNormalized, input.teacherId]
    )
    await client.query(`delete from public.subject_name_edit_votes where subject_id = $1`, [subjectId])
    await client.query(
      `insert into public.subject_name_edit_votes (subject_id, teacher_id, choice, updated_at)
       values ($1, $2::uuid, 'edited', now())`,
      [subjectId, input.teacherId]
    )
    await client.query('commit')
    return { ok: true, canonicalName: originalName, resolved: null }
  } catch (e) {
    await client.query('rollback').catch(() => {})
    return { ok: false, error: voteStoreError(e) }
  } finally {
    client.release()
  }
}

export async function voteSubjectName(input: {
  subjectId: string
  teacherId: string
  choice: NameEditChoice
}): Promise<NameEditResult> {
  if (!isPgConfigured()) return { ok: false, error: 'Chưa cấu hình cơ sở dữ liệu.' }
  const pool = getPgPool()
  const client = await pool.connect()
  try {
    await client.query('begin')
    const edit = await client.query<{ original_name: string; edited_name: string; edited_normalized: string }>(
      `select original_name, edited_name, edited_normalized
       from public.subject_name_edits
       where subject_id = $1
       for update`,
      [input.subjectId]
    )
    const pending = edit.rows[0]
    if (!pending) {
      await client.query('commit')
      return { ok: true, canonicalName: '', resolved: null }
    }
    await client.query(
      `insert into public.subject_name_edit_votes (subject_id, teacher_id, choice, updated_at)
       values ($1, $2::uuid, $3, now())
       on conflict (subject_id, teacher_id) do update set
         choice = excluded.choice,
         updated_at = now()`,
      [input.subjectId, input.teacherId, input.choice]
    )
    const counts = await client.query<{ original_votes: number; edited_votes: number }>(
      `select
         count(*) filter (where choice = 'original')::int as original_votes,
         count(*) filter (where choice = 'edited')::int as edited_votes
       from public.subject_name_edit_votes
       where subject_id = $1`,
      [input.subjectId]
    )
    const resolved = resolveSchoolNameVote(
      Number(counts.rows[0]?.original_votes ?? 0),
      Number(counts.rows[0]?.edited_votes ?? 0),
      input.choice,
      CLASS_SUBJECT_NAME_VOTE_THRESHOLD
    )
    if (resolved === 'edited') {
      if (await subjectLabelTaken(client, input.subjectId, pending.edited_normalized)) {
        await client.query('rollback')
        return { ok: false, error: 'Tên môn này đã có.' }
      }
      await client.query(
        `insert into public.subject_name_overrides (subject_id, label, updated_at)
         values ($1, $2, now())
         on conflict (subject_id) do update set label = excluded.label, updated_at = now()`,
        [input.subjectId, pending.edited_name]
      )
      await client.query(`update public.teaching_subjects set label = $2 where id = $1`, [
        input.subjectId,
        pending.edited_name,
      ])
      await client.query(`update public.class_subjects set subject_label = $2 where subject_id = $1`, [
        input.subjectId,
        pending.edited_name,
      ])
      await client.query(
        `update public.classes
         set subject_label = $2
         where lower(btrim(coalesce(subject_label, ''))) = lower(btrim($1))`,
        [pending.original_name, pending.edited_name]
      )
      await client.query(
        `update public.teacher_school_settings
         set default_subject_label = $2
         where lower(btrim(coalesce(default_subject_label, ''))) = lower(btrim($1))`,
        [pending.original_name, pending.edited_name]
      )
      await client.query(`delete from public.subject_name_edits where subject_id = $1`, [input.subjectId])
      await client.query('commit')
      return { ok: true, canonicalName: pending.edited_name, resolved: 'edited' }
    }
    if (resolved === 'original') {
      await client.query(`delete from public.subject_name_edits where subject_id = $1`, [input.subjectId])
      await client.query('commit')
      return { ok: true, canonicalName: pending.original_name, resolved: 'original' }
    }
    const chosenName = input.choice === 'edited' ? pending.edited_name : pending.original_name
    await client.query('commit')
    return { ok: true, canonicalName: chosenName, resolved: null }
  } catch (e) {
    await client.query('rollback').catch(() => {})
    return { ok: false, error: voteStoreError(e) }
  } finally {
    client.release()
  }
}

export async function fetchSubjectNameExtrasPg(): Promise<{
  overrides: Map<string, string>
  edits: Map<string, { originalName: string; editedName: string }>
}> {
  const overrides = new Map<string, string>()
  const edits = new Map<string, { originalName: string; editedName: string }>()
  if (!isPgConfigured()) return { overrides, edits }
  const pool = getPgPool()
  try {
    const overrideRows = await pool.query<{ subject_id: string; label: string }>(
      `select subject_id, label from public.subject_name_overrides`
    )
    for (const row of overrideRows.rows) {
      const label = String(row.label ?? '').trim()
      if (row.subject_id && label) overrides.set(String(row.subject_id), label)
    }
  } catch {
    /* bảng chưa có thì dùng tên gốc */
  }
  try {
    const editRows = await pool.query<{ subject_id: string; original_name: string; edited_name: string }>(
      `select subject_id, original_name, edited_name from public.subject_name_edits`
    )
    for (const row of editRows.rows) {
      const editedName = String(row.edited_name ?? '').trim()
      if (!row.subject_id || !editedName) continue
      edits.set(String(row.subject_id), {
        originalName: String(row.original_name ?? '').trim(),
        editedName,
      })
    }
  } catch {
    /* bảng chưa có */
  }
  return { overrides, edits }
}
