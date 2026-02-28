import type { User } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const FORCE_REAL_LOGIN_COOKIE = 'force_real_login'

/** Kiểm tra xem có đang localhost không */
function isLocalhostEnv(): boolean {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || ''
  return baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')
}

/**
 * Kiểm tra xem có cần đăng nhập hay không.
 * - Local (localhost, 127.0.0.1): không cần đăng nhập, test thoải mái (trừ khi user đã chọn "đăng nhập thật")
 * - Production (tên miền thật): bắt buộc đăng nhập
 */
export function isAuthRequired(): boolean {
  // In production runtime (including local production test via `next start`),
  // always require real authentication and disable local bypass completely.
  if (process.env.NODE_ENV === 'production') return true
  if (process.env.AUTH_BYPASS_LOCAL === 'true') return false
  if (!isLocalhostEnv()) return true
  const cookieStore = cookies()
  const force = cookieStore.get(FORCE_REAL_LOGIN_COOKIE)
  if (force?.value === '1') return true
  return false
}

/** Tạo user giả cho môi trường local khi bypass auth */
function getDevUser(): User {
  const devUserId = process.env.AUTH_DEV_USER_ID || '00000000-0000-0000-0000-000000000001'
  return {
    id: devUserId,
    app_metadata: {},
    user_metadata: { gender: 'male' },
    aud: 'authenticated',
    created_at: new Date().toISOString(),
    email: 'dev@local.test',
  } as User
}

/**
 * Lấy user hiện tại hoặc user giả khi chạy local (bypass auth).
 * Dùng cho pages và components.
 */
export async function getUserOrBypass(
  getUser: () => Promise<{ data: { user: User | null } }>
): Promise<User | null> {
  const { data: { user } } = await getUser()
  if (user) return user
  if (!isAuthRequired()) return getDevUser()
  return null
}

export { FORCE_REAL_LOGIN_COOKIE }

/**
 * Lấy user cho server actions.
 * Trả về { user } khi có user (thật hoặc dev), { error } khi cần đăng nhập nhưng chưa có.
 */
export async function getUserForAction(
  getUser: () => Promise<{ data: { user: User | null } }>,
  errorMessage = 'Vui lòng đăng nhập.'
): Promise<{ user: User } | { error: string }> {
  const { data: { user } } = await getUser()
  if (user) return { user }
  if (!isAuthRequired()) return { user: getDevUser() }
  return { error: errorMessage }
}
