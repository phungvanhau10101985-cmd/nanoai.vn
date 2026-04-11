import { isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'

function isPgUndefinedTable(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && String((e as { code?: unknown }).code) === '42P01'
}

/**
 * Đọc credits + role từ Postgres khi có DATABASE_URL — không qua HTTP API hosted cũ.
 * Trả về null khi không có PG hoặc lỗi nghiêm trọng (caller xử lý).
 * DB chưa migrate (thiếu `public.credits` / `public.profiles`) → coi như 0 credit, không admin, không ném lỗi.
 */
export async function readUserDashboardFromPg(
  userId: string
): Promise<{ credits: number; isAdmin: boolean } | null> {
  if (!isPgConfigured()) return null
  let credits = 0
  try {
    const creditRow = await pgQueryOne<{ balance: unknown }>(
      `select balance from public.credits where user_id = $1::uuid limit 1`,
      [userId]
    )
    const bal = creditRow?.balance
    credits = bal != null && Number.isFinite(Number(bal)) ? Number(bal) : 0
  } catch (e) {
    if (isPgUndefinedTable(e)) {
      credits = 0
    } else {
      console.warn('[readUserDashboardFromPg] credits query failed', e)
      return null
    }
  }

  let isAdmin = false
  try {
    const roleRow = await pgQueryOne<{ role: unknown }>(
      'select role from public.profiles where id = $1::uuid limit 1',
      [userId]
    )
    isAdmin = roleRow?.role === 'admin'
  } catch (e) {
    if (isPgUndefinedTable(e)) {
      isAdmin = false
    } else {
      console.warn('[readUserDashboardFromPg] profiles query failed', e)
      return null
    }
  }

  return { credits, isAdmin }
}

/**
 * Role trong `public.profiles` — chỉ Postgres.
 * Không có `DATABASE_URL`, lỗi truy vấn, hoặc không có dòng → `null`.
 */
export async function readProfileRoleFromPg(userId: string): Promise<string | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ role: unknown }>(
      'select role from public.profiles where id = $1::uuid limit 1',
      [userId]
    )
    if (!row) return null
    return row.role != null ? String(row.role) : null
  } catch (e) {
    if (isPgUndefinedTable(e)) {
      return null
    }
    console.warn('[readProfileRoleFromPg] failed', e)
    return null
  }
}

/** Giữ tên cũ — cùng logic với {@link readProfileRoleFromPg} (chỉ PG). */
export async function getProfileRoleWithFallback(userId: string): Promise<string | null> {
  return readProfileRoleFromPg(userId)
}
