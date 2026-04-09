import { isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'

/** Email đăng ký trong `auth.users` (schema Auth) — chỉ khi kết nối Postgres trực tiếp. */
export async function getAuthUserEmailFromPg(userId: string): Promise<string | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ email: string | null }>(
      'select email from auth.users where id = $1::uuid limit 1',
      [userId]
    )
    const em = row?.email?.trim()
    return em || null
  } catch (e) {
    console.warn('[auth-user-email-pg] skip (no auth.users?):', e instanceof Error ? e.message : e)
    return null
  }
}
