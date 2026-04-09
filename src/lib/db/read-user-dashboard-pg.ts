import { isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'

/**
 * Đọc credits + role từ Postgres khi có DATABASE_URL — không qua HTTP API hosted cũ.
 * Trả về null khi không có PG hoặc lỗi (caller xử lý).
 */
export async function readUserDashboardFromPg(
  userId: string
): Promise<{ credits: number; isAdmin: boolean } | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ balance: unknown; role: unknown }>(
      `select
        (select balance from public.credits where user_id = $1::uuid limit 1) as balance,
        (select role from public.profiles where id = $1::uuid limit 1) as role`,
      [userId]
    )
    if (!row) return { credits: 0, isAdmin: false }
    const bal = row.balance
    const credits =
      bal != null && Number.isFinite(Number(bal)) ? Number(bal) : 0
    const isAdmin = row.role === 'admin'
    return { credits, isAdmin }
  } catch (e) {
    console.warn('[readUserDashboardFromPg] failed', e)
    return null
  }
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
    console.warn('[readProfileRoleFromPg] failed', e)
    return null
  }
}

/** Giữ tên cũ — cùng logic với {@link readProfileRoleFromPg} (chỉ PG). */
export async function getProfileRoleWithFallback(userId: string): Promise<string | null> {
  return readProfileRoleFromPg(userId)
}
