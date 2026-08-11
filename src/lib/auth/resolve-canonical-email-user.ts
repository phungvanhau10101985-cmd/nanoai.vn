import { pgQueryOne } from '@/lib/db/pg-query'
import {
  markNewUserSignupSource,
  type SignupSourceContext,
} from '@/lib/auth/signup-source'

/**
 * JWT `sub` có thể lệch `auth.users` (reset DB, xóa user…); `profiles.id` FK vào `auth.users`.
 * Hàm gọi `nanoai_ensure_user_by_email`: trả id đúng theo email (tạo user nếu chưa có).
 * Nếu tạo mới và có `signup`, ghi `profiles.signup_source` (first-write-wins).
 */
export async function resolveCanonicalUserIdByEmail(
  email: string,
  signup?: SignupSourceContext | null
): Promise<string | null> {
  const e = email.trim()
  if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return null
  try {
    const existing = await pgQueryOne<{ id: string }>(
      `select u.id::text as id
       from auth.users u
       where lower(coalesce(u.email, '')) = lower($1)
       limit 1`,
      [e]
    )
    const isNewUser = !existing?.id

    const row = await pgQueryOne<{ id: string }>(
      'select (public.nanoai_ensure_user_by_email($1::text))::text as id',
      [e]
    )
    const id = row?.id?.trim() ?? null
    if (id && signup) {
      await markNewUserSignupSource({
        userId: id,
        isNewUser,
        source: signup.source,
        partnerId: signup.partnerId,
        partnerSlug: signup.partnerSlug,
      })
    }
    return id
  } catch (err) {
    console.warn('[resolveCanonicalUserIdByEmail]', err)
    return null
  }
}
