import { randomBytes, randomInt } from 'node:crypto'
import type { PoolClient } from 'pg'
import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { fetchClassIdByJoinCodePg } from '@/lib/db/classes-pg'
import { readTutoringJoinBlock } from '@/lib/db/tutoring-package-pg'
import { entryCodesMatch, isStudentLoginCode, studentEntryEmail } from '@/lib/lop/class-entry'
import { normalizeClassJoinCode } from '@/lib/lop/join-code'
import { isStudentCode, normalizeStudentCode } from '@/lib/lop/class-roster'

const FAIL_LIMIT = 8
const LOCK_MINUTES = 15

function pgCode(error: unknown): string {
  return error && typeof error === 'object' && 'code' in error ? String((error as { code?: string }).code ?? '') : ''
}

function isSchemaError(error: unknown): boolean {
  const code = pgCode(error)
  return code === '42P01' || code === '42703'
}

export function makeStudentLoginCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

function makeEntryToken(): string {
  return randomBytes(18).toString('base64url')
}

export async function ensureClassEntryTokenPg(classId: string): Promise<string | 'schema' | null> {
  if (!isPgConfigured()) return null
  const pool = getPgPool()
  try {
    const current = await pool.query<{ student_entry_token: string | null }>(
      `select student_entry_token from public.classes where id = $1::uuid and dissolved_at is null limit 1`,
      [classId]
    )
    if (current.rowCount === 0) return null
    const existing = current.rows[0]?.student_entry_token
    if (existing) return existing
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const token = makeEntryToken()
      const saved = await pool.query<{ student_entry_token: string }>(
        `update public.classes
         set student_entry_token = $2
         where id = $1::uuid and student_entry_token is null
         returning student_entry_token`,
        [classId, token]
      )
      if (saved.rows[0]?.student_entry_token) return saved.rows[0].student_entry_token
      const again = await pool.query<{ student_entry_token: string | null }>(
        `select student_entry_token from public.classes where id = $1::uuid limit 1`,
        [classId]
      )
      if (again.rows[0]?.student_entry_token) return again.rows[0].student_entry_token
    }
    return null
  } catch (error) {
    if (isSchemaError(error)) return 'schema'
    console.error('[class-entry] token', error)
    return null
  }
}

export async function lookupClassByEntryTokenPg(
  token: string
): Promise<{ classId: string; className: string } | 'schema' | null> {
  const clean = token.trim()
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(clean) || !isPgConfigured()) return null
  try {
    const pool = getPgPool()
    const row = await pool.query<{ id: string; name: string | null }>(
      `select id::text, name
       from public.classes
       where student_entry_token = $1 and dissolved_at is null
       limit 1`,
      [clean]
    )
    const found = row.rows[0]
    if (!found) return null
    return { classId: found.id, className: String(found.name ?? '').trim() || 'Lớp' }
  } catch (error) {
    if (isSchemaError(error)) return 'schema'
    console.error('[class-entry] lookup', error)
    return null
  }
}

type RosterLoginRow = {
  student_code: string
  display_name: string
  birth_date: string
  user_id: string | null
  login_code: string | null
}

async function loadRosterRows(client: PoolClient, classId: string): Promise<RosterLoginRow[]> {
  const res = await client.query<RosterLoginRow>(
    `select student_code, display_name, birth_date::text as birth_date, user_id::text, login_code
     from public.class_roster_entries
     where class_id = $1::uuid
     order by student_code`,
    [classId]
  )
  return res.rows
}

async function teacherIds(client: PoolClient, classId: string): Promise<Set<string>> {
  const res = await client.query<{ user_id: string }>(
    `select teacher_id::text as user_id from public.classes where id = $1::uuid
     union
     select teacher_id::text from public.class_subjects where class_id = $1::uuid`,
    [classId]
  )
  return new Set(res.rows.map((row) => row.user_id))
}

async function attachRosterUser(
  client: PoolClient,
  opts: { classId: string; userId: string; studentCode: string; displayName: string; birthDate: string }
): Promise<'ok' | 'taken'> {
  const owner = await client.query<{ user_id: string | null }>(
    `select user_id::text as user_id
     from public.class_roster_entries
     where class_id = $1::uuid and student_code = $2
     limit 1`,
    [opts.classId, opts.studentCode]
  )
  const ownerId = owner.rows[0]?.user_id ?? null
  if (ownerId && ownerId !== opts.userId) return 'taken'
  await client.query(
    `delete from public.class_roster_entries
     where class_id = $1::uuid and user_id = $2::uuid and student_code <> $3`,
    [opts.classId, opts.userId, opts.studentCode]
  )
  await client.query(
    `update public.class_roster_entries
     set user_id = $3::uuid, updated_at = now()
     where class_id = $1::uuid and student_code = $2 and (user_id is null or user_id = $3::uuid)`,
    [opts.classId, opts.studentCode, opts.userId]
  )
  await client.query(
    `insert into public.class_members (class_id, user_id, member_display_name, birth_date)
     values ($1::uuid, $2::uuid, $3, $4::date)
     on conflict (class_id, user_id) do update set
       member_display_name = excluded.member_display_name,
       birth_date = excluded.birth_date`,
    [opts.classId, opts.userId, opts.displayName, opts.birthDate]
  )
  return 'ok'
}

async function profileIdForCode(client: PoolClient, studentCode: string): Promise<string | null> {
  const row = await client.query<{ id: string }>(
    `select id::text from public.profiles where student_code = $1 limit 1`,
    [studentCode]
  )
  return row.rows[0]?.id ?? null
}

async function ensureRosterAccount(
  client: PoolClient,
  opts: {
    classId: string
    studentCode: string
    displayName: string
    birthDate: string
    teachers: Set<string>
  }
): Promise<void> {
  const existing = await profileIdForCode(client, opts.studentCode)
  let userId = existing
  if (!userId) {
    const email = studentEntryEmail(opts.studentCode)
    const created = await client.query<{ id: string }>(
      `select (public.nanoai_ensure_user_by_email($1::text))::text as id`,
      [email]
    )
    userId = created.rows[0]?.id ?? null
    if (!userId) return
    await client.query(
      `update public.profiles
       set full_name = case
             when char_length(btrim(coalesce(full_name, ''))) >= 2 then full_name
             else $2
           end,
           birth_date = coalesce(birth_date, $3::date),
           student_code = $4,
           updated_at = now()
       where id = $1::uuid
         and (student_code is null or student_code = $4)`,
      [userId, opts.displayName, opts.birthDate, opts.studentCode]
    )
  }
  if (opts.teachers.has(userId)) return
  await attachRosterUser(client, {
    classId: opts.classId,
    userId,
    studentCode: opts.studentCode,
    displayName: opts.displayName,
    birthDate: opts.birthDate,
  })
}

/** Tạo mật khẩu và tài khoản cho học sinh đã có trong danh sách nhưng chưa có phiếu. */
export async function provisionRosterLoginsPg(classId: string): Promise<'ok' | 'schema' | null> {
  if (!isPgConfigured()) return null
  const pool = getPgPool()
  const client = await pool.connect()
  try {
    await client.query('begin')
    const teachers = await teacherIds(client, classId)
    const rows = await loadRosterRows(client, classId)
    for (const row of rows) {
      if (!isStudentLoginCode(row.login_code ?? '')) {
        await client.query(
          `update public.class_roster_entries
           set login_code = $3, updated_at = now()
           where class_id = $1::uuid and student_code = $2 and login_code is null`,
          [classId, row.student_code, makeStudentLoginCode()]
        )
      }
      if (row.user_id) continue
      await ensureRosterAccount(client, {
        classId,
        studentCode: row.student_code,
        displayName: row.display_name,
        birthDate: String(row.birth_date ?? '').slice(0, 10),
        teachers,
      })
    }
    await client.query('commit')
    return 'ok'
  } catch (error) {
    await client.query('rollback').catch(() => undefined)
    if (isSchemaError(error)) return 'schema'
    console.error('[class-entry] provision', error)
    return null
  } finally {
    client.release()
  }
}

export async function listRosterLoginCodesPg(
  classId: string
): Promise<Array<{ studentCode: string; userId: string | null; loginCode: string }> | 'schema' | null> {
  if (!isPgConfigured()) return null
  try {
    const pool = getPgPool()
    const res = await pool.query<{ student_code: string; user_id: string | null; login_code: string | null }>(
      `select student_code, user_id::text, login_code
       from public.class_roster_entries
       where class_id = $1::uuid and login_code is not null`,
      [classId]
    )
    return res.rows.flatMap((row) =>
      isStudentLoginCode(row.login_code ?? '')
        ? [{ studentCode: row.student_code, userId: row.user_id, loginCode: row.login_code as string }]
        : []
    )
  } catch (error) {
    if (isSchemaError(error)) return 'schema'
    console.error('[class-entry] list codes', error)
    return null
  }
}

export async function reissueRosterLoginCodePg(
  classId: string,
  studentCode: string
): Promise<{ loginCode: string } | 'missing' | 'schema' | null> {
  const code = normalizeStudentCode(studentCode)
  if (!isStudentCode(code) || !isPgConfigured()) return null
  try {
    const pool = getPgPool()
    const loginCode = makeStudentLoginCode()
    const res = await pool.query<{ login_code: string }>(
      `update public.class_roster_entries
       set login_code = $3, login_fail_count = 0, login_locked_until = null, updated_at = now()
       where class_id = $1::uuid and student_code = $2
       returning login_code`,
      [classId, code, loginCode]
    )
    if (!res.rows[0]) return 'missing'
    return { loginCode: res.rows[0].login_code }
  } catch (error) {
    if (isSchemaError(error)) return 'schema'
    console.error('[class-entry] reissue', error)
    return null
  }
}

export type EntryLoginResult =
  | { ok: true; classId: string; userId: string; email: string }
  | { ok: false; error: 'bad' | 'locked' | 'not_ready' | 'schema' }

async function loginRosterInClass(
  classId: string,
  studentCodeRaw: string,
  passwordRaw: string
): Promise<EntryLoginResult> {
  const studentCode = normalizeStudentCode(studentCodeRaw)
  const password = String(passwordRaw ?? '').replace(/\D/g, '').slice(0, 6)
  if (!isStudentCode(studentCode)) return { ok: false, error: 'bad' }

  const pool = getPgPool()
  const client = await pool.connect()
  try {
    await client.query('begin')
    const row = await client.query<{
      display_name: string
      birth_date: string
      user_id: string | null
      login_code: string | null
      login_fail_count: number
      login_locked_until: Date | null
    }>(
      `select display_name, birth_date::text as birth_date, user_id::text, login_code, login_fail_count, login_locked_until
       from public.class_roster_entries
       where class_id = $1::uuid and student_code = $2
       limit 1
       for update`,
      [classId, studentCode]
    )
    const entry = row.rows[0]
    if (!entry) {
      await client.query('rollback')
      return { ok: false, error: 'bad' }
    }
    if (entry.login_locked_until && entry.login_locked_until.getTime() > Date.now()) {
      await client.query('rollback')
      return { ok: false, error: 'locked' }
    }
    if (!isStudentLoginCode(entry.login_code ?? '')) {
      await client.query('rollback')
      return { ok: false, error: 'not_ready' }
    }
    if (!entryCodesMatch(entry.login_code ?? '', password)) {
      const fails = Number(entry.login_fail_count ?? 0) + 1
      await client.query(
        `update public.class_roster_entries
         set login_fail_count = $3,
             login_locked_until = case when $3 >= $4 then now() + ($5::int * interval '1 minute') else null end,
             updated_at = now()
         where class_id = $1::uuid and student_code = $2`,
        [classId, studentCode, fails, FAIL_LIMIT, LOCK_MINUTES]
      )
      await client.query('commit')
      return { ok: false, error: fails >= FAIL_LIMIT ? 'locked' : 'bad' }
    }

    const teachers = await teacherIds(client, classId)
    if (!entry.user_id) {
      await ensureRosterAccount(client, {
        classId,
        studentCode,
        displayName: entry.display_name,
        birthDate: String(entry.birth_date ?? '').slice(0, 10),
        teachers,
      })
    }
    const linked = await client.query<{ user_id: string | null }>(
      `select user_id::text as user_id
       from public.class_roster_entries
       where class_id = $1::uuid and student_code = $2
       limit 1`,
      [classId, studentCode]
    )
    const userId = linked.rows[0]?.user_id ?? null
    if (!userId) {
      await client.query('rollback')
      return { ok: false, error: 'not_ready' }
    }
    const account = await client.query<{ email: string | null }>(
      `select email from auth.users where id = $1::uuid limit 1`,
      [userId]
    )
    const email = String(account.rows[0]?.email ?? '').trim().toLowerCase()
    if (!email) {
      await client.query('rollback')
      return { ok: false, error: 'not_ready' }
    }
    await client.query(
      `update public.class_roster_entries
       set login_fail_count = 0, login_locked_until = null, updated_at = now()
       where class_id = $1::uuid and student_code = $2`,
      [classId, studentCode]
    )
    await client.query('commit')
    return { ok: true, classId, userId, email }
  } catch (error) {
    await client.query('rollback').catch(() => undefined)
    if (isSchemaError(error)) return { ok: false, error: 'schema' }
    console.error('[class-entry] login', error)
    return { ok: false, error: 'bad' }
  } finally {
    client.release()
  }
}

export async function loginRosterStudentPg(token: string, studentCodeRaw: string, passwordRaw: string): Promise<EntryLoginResult> {
  const found = await lookupClassByEntryTokenPg(token)
  if (found === 'schema') return { ok: false, error: 'schema' }
  if (!found) return { ok: false, error: 'bad' }
  return loginRosterInClass(found.classId, studentCodeRaw, passwordRaw)
}

/** Vào lớp từ nút học sinh: mã lớp trên bảng QR, mã định danh và mật khẩu. */
export async function loginRosterStudentByJoinCodePg(
  joinCodeRaw: string,
  studentCodeRaw: string,
  passwordRaw: string
): Promise<EntryLoginResult> {
  const joinCode = normalizeClassJoinCode(joinCodeRaw)
  if (joinCode.length < 4 || !isStudentCode(normalizeStudentCode(studentCodeRaw))) {
    return { ok: false, error: 'bad' }
  }
  const classId = await fetchClassIdByJoinCodePg(joinCode)
  if (!classId) return { ok: false, error: 'bad' }
  try {
    const block = await readTutoringJoinBlock(classId)
    if (block === 'closed' || block === 'dissolved') return { ok: false, error: 'bad' }
  } catch (error) {
    if (isSchemaError(error)) return { ok: false, error: 'schema' }
    console.error('[class-entry] join block', error)
    return { ok: false, error: 'bad' }
  }
  return loginRosterInClass(classId, studentCodeRaw, passwordRaw)
}
