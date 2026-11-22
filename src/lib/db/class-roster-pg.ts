import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import type { RosterImportRow } from '@/lib/lop/class-roster'
import { isStudentCode, normalizeStudentCode } from '@/lib/lop/class-roster'
import type { TeacherGender } from '@/lib/lop/teacher-public-name'

const GOOGLE_LINK_META = 'linked_google_user_id'

export type ClassRosterEntry = {
  studentCode: string
  displayName: string
  birthDate: string
  sortNo: number | null
  userId: string | null
}

function pgCode(error: unknown): string {
  return error && typeof error === 'object' && 'code' in error ? String((error as { code?: string }).code ?? '') : ''
}

function isSchemaError(error: unknown): boolean {
  const code = pgCode(error)
  return code === '42P01' || code === '42703'
}

export async function unlinkRosterOnLeavePg(classId: string, userId: string): Promise<void> {
  if (!isPgConfigured()) return
  try {
    const pool = getPgPool()
    await pool.query(
      `update public.class_roster_entries
       set user_id = null, updated_at = now()
       where class_id = $1::uuid and user_id = $2::uuid`,
      [classId, userId]
    )
  } catch (error) {
    if (!isSchemaError(error)) console.error('[class-roster] unlink', error)
  }
}

export async function listClassRosterPg(classId: string): Promise<ClassRosterEntry[] | 'schema' | null> {
  if (!isPgConfigured()) return null
  try {
    const pool = getPgPool()
    const res = await pool.query<{
      student_code: string
      display_name: string
      birth_date: string
      sort_no: number | null
      user_id: string | null
    }>(
      `select student_code, display_name, birth_date::text as birth_date, sort_no, user_id::text
       from public.class_roster_entries
       where class_id = $1::uuid
       order by sort_no asc nulls last, display_name asc`,
      [classId]
    )
    return res.rows.map((row) => ({
      studentCode: row.student_code,
      displayName: row.display_name,
      birthDate: String(row.birth_date ?? '').slice(0, 10),
      sortNo: row.sort_no,
      userId: row.user_id,
    }))
  } catch (error) {
    if (isSchemaError(error)) return 'schema'
    console.error('[class-roster] list', error)
    return null
  }
}

export async function importClassRosterPg(
  classId: string,
  rows: RosterImportRow[]
): Promise<{ inserted: number; updated: number } | 'schema' | null> {
  if (!isPgConfigured()) return null
  const pool = getPgPool()
  const client = await pool.connect()
  try {
    await client.query('begin')
    const existing = await client.query<{ student_code: string }>(
      `select student_code from public.class_roster_entries where class_id = $1::uuid`,
      [classId]
    )
    const had = new Set(existing.rows.map((row) => row.student_code))
    let inserted = 0
    let updated = 0
    for (const row of rows) {
      await client.query(
        `insert into public.class_roster_entries
           (class_id, student_code, display_name, birth_date, sort_no, updated_at)
         values ($1::uuid, $2, $3, $4::date, $5, now())
         on conflict (class_id, student_code) do update set
           display_name = excluded.display_name,
           birth_date = excluded.birth_date,
           sort_no = coalesce(excluded.sort_no, class_roster_entries.sort_no),
           updated_at = now()`,
        [classId, row.studentCode, row.name, row.birthDate, row.sortNo]
      )
      if (had.has(row.studentCode)) updated += 1
      else inserted += 1
    }
    const codes = rows.map((row) => row.studentCode)
    await client.query(
      `update public.class_roster_entries r
       set user_id = p.id, updated_at = now()
       from public.profiles p
       join public.class_members m on m.user_id = p.id
       where r.class_id = $1::uuid
         and m.class_id = r.class_id
         and r.user_id is null
         and p.student_code = r.student_code
         and r.student_code = any($2::text[])
         and not exists (
           select 1 from public.class_roster_entries other
           where other.class_id = r.class_id and other.user_id = p.id
         )`,
      [classId, codes]
    )
    await client.query(
      `update public.class_members m
       set member_display_name = r.display_name, birth_date = r.birth_date
       from public.class_roster_entries r
       where r.class_id = m.class_id
         and r.user_id = m.user_id
         and r.class_id = $1::uuid
         and r.student_code = any($2::text[])`,
      [classId, codes]
    )
    await client.query('commit')
    return { inserted, updated }
  } catch (error) {
    await client.query('rollback').catch(() => undefined)
    if (isSchemaError(error)) return 'schema'
    console.error('[class-roster] import', error)
    return null
  } finally {
    client.release()
  }
}

/** Gắn mã định danh của tài khoản vào một lớp. Cùng mã thì cập nhật, không thêm học sinh mới. */
export async function attachStudentToClassPg(opts: {
  classId: string
  userId: string
  studentCode: string
  displayName: string
  birthDateIso: string
  gender?: TeacherGender | null
}): Promise<'ok' | 'code_taken' | 'schema' | null> {
  return adoptStudentCodeForAccount({
    accountUserId: opts.userId,
    studentCode: opts.studentCode,
    displayName: opts.displayName,
    birthDateIso: opts.birthDateIso,
    gender: opts.gender ?? null,
    classId: opts.classId,
  })
}

/**
 * Mã đã có thì ghi vào đúng hồ sơ đó và gắn tài khoản Gmail đang đăng nhập.
 * Chưa có thì tạo trên tài khoản Gmail rồi thêm vào lớp. Không báo trùng.
 */
export async function adoptStudentCodeForAccount(opts: {
  accountUserId: string
  studentCode: string
  displayName: string
  birthDateIso: string
  gender?: TeacherGender | null
  classId?: string | null
}): Promise<'ok' | 'schema' | null> {
  const studentCode = normalizeStudentCode(opts.studentCode)
  if (!isStudentCode(studentCode) || !isPgConfigured()) return null
  const pool = getPgPool()
  const client = await pool.connect()
  try {
    await client.query('begin')
    const owner = await client.query<{ id: string }>(
      `select id::text as id from public.profiles where student_code = $1 limit 1`,
      [studentCode]
    )
    const canonical = owner.rows[0]?.id ?? opts.accountUserId
    await client.query(
      `insert into public.profiles (id, full_name, gender, birth_date, student_code, updated_at)
       values ($1::uuid, $2, $3, $4::date, $5, now())
       on conflict (id) do update set
         full_name = excluded.full_name,
         gender = coalesce(excluded.gender, public.profiles.gender),
         birth_date = coalesce(excluded.birth_date, public.profiles.birth_date),
         student_code = excluded.student_code,
         updated_at = now()`,
      [canonical, opts.displayName, opts.gender ?? null, opts.birthDateIso, studentCode]
    )
    if (canonical !== opts.accountUserId) {
      await client.query(
        `update auth.users
         set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
           || jsonb_build_object($2::text, $3::text)
         where id = $1::uuid`,
        [canonical, GOOGLE_LINK_META, opts.accountUserId]
      )
    }
    const roster = await client.query<{ class_id: string; user_id: string | null }>(
      `select class_id::text, user_id::text
       from public.class_roster_entries
       where student_code = $1`,
      [studentCode]
    )
    for (const row of roster.rows) {
      if (row.user_id && row.user_id !== canonical) {
        await client.query(
          `delete from public.class_members m
           where m.class_id = $1::uuid
             and m.user_id = $2::uuid
             and not exists (
               select 1 from public.classes c
               where c.id = m.class_id and c.teacher_id = m.user_id
             )
             and not exists (
               select 1 from public.class_subjects s
               where s.class_id = m.class_id and s.teacher_id = m.user_id
             )`,
          [row.class_id, row.user_id]
        )
      }
    }
    await client.query(
      `update public.class_roster_entries
       set user_id = $2::uuid,
           display_name = $3,
           birth_date = $4::date,
           updated_at = now()
       where student_code = $1`,
      [studentCode, canonical, opts.displayName, opts.birthDateIso]
    )
    const classIds = new Set(roster.rows.map((row) => row.class_id))
    if (opts.classId) classIds.add(opts.classId)
    for (const classId of classIds) {
      await client.query(
        `insert into public.class_roster_entries
           (class_id, student_code, display_name, birth_date, user_id, updated_at)
         values ($1::uuid, $2, $3, $4::date, $5::uuid, now())
         on conflict (class_id, student_code) do update set
           display_name = excluded.display_name,
           birth_date = excluded.birth_date,
           user_id = excluded.user_id,
           updated_at = now()`,
        [classId, studentCode, opts.displayName, opts.birthDateIso, canonical]
      )
      await client.query(
        `insert into public.class_members (class_id, user_id, member_display_name, birth_date)
         values ($1::uuid, $2::uuid, $3, $4::date)
         on conflict (class_id, user_id) do update set
           member_display_name = excluded.member_display_name,
           birth_date = excluded.birth_date`,
        [classId, canonical, opts.displayName, opts.birthDateIso]
      )
      if (canonical !== opts.accountUserId) {
        await client.query(
          `delete from public.class_members m
           where m.class_id = $1::uuid
             and m.user_id = $2::uuid
             and not exists (
               select 1 from public.classes c
               where c.id = m.class_id and c.teacher_id = m.user_id
             )
             and not exists (
               select 1 from public.class_subjects s
               where s.class_id = m.class_id and s.teacher_id = m.user_id
             )`,
          [classId, opts.accountUserId]
        )
      }
    }
    await client.query('commit')
    return 'ok'
  } catch (error) {
    await client.query('rollback').catch(() => undefined)
    if (isSchemaError(error)) return 'schema'
    console.error('[class-roster] adopt', error)
    return null
  } finally {
    client.release()
  }
}

/** Sau khi học sinh sửa hồ sơ, đồng bộ mọi lớp đang tham gia theo mã định danh. */
export async function syncStudentCodeAcrossClassesPg(opts: {
  userId: string
  studentCode: string
  displayName: string
  birthDateIso: string
}): Promise<'ok' | 'code_taken' | 'schema' | null> {
  return adoptStudentCodeForAccount({
    accountUserId: opts.userId,
    studentCode: opts.studentCode,
    displayName: opts.displayName,
    birthDateIso: opts.birthDateIso,
  })
}

