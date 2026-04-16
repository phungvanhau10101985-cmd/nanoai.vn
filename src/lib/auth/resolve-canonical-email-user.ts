import { pgQueryOne } from '@/lib/db/pg-query'

/**
 * JWT `sub` có thể lệch `auth.users` (reset DB, xóa user…); `profiles.id` FK vào `auth.users`.
 * Hàm gọi `nanoai_ensure_user_by_email`: trả id đúng theo email (tạo user nếu chưa có).
 */
export async function resolveCanonicalUserIdByEmail(email: string): Promise<string | null> {
  const e = email.trim()
  if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return null
  try {
    const row = await pgQueryOne<{ id: string }>(
      'select (public.nanoai_ensure_user_by_email($1::text))::text as id',
      [e]
    )
    return row?.id?.trim() ?? null
  } catch (err) {
    console.warn('[resolveCanonicalUserIdByEmail]', err)
    return null
  }
}
