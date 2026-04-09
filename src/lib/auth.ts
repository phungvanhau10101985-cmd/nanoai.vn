import type { AppUser } from '@/lib/auth/app-user'
import { cookies, headers } from 'next/headers'
import { getEmailSessionUser } from '@/lib/auth/email-session-user'
import { isValidUuidString } from '@/lib/validate-uuid'

const FORCE_REAL_LOGIN_COOKIE = 'force_real_login'

/** Kiểm tra request có phải từ crawler tìm kiếm (Google, Bing...) – để render trang cho SEO thay vì redirect login */
function isSearchEngineCrawler(): boolean {
  try {
    const h = headers()
    const ua = (h.get('user-agent') || '').toLowerCase()
    return /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebookexternalhit|twitterbot|linkedinbot|embedly|pinterest|whatsapp|telegrambot/i.test(ua)
  } catch {
    return false
  }
}

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
function getDevUser(): AppUser {
  const fromEnv = process.env.AUTH_DEV_USER_ID?.trim()
  const devUserId =
    fromEnv && isValidUuidString(fromEnv)
      ? fromEnv
      : '00000000-0000-0000-0000-000000000001'
  return {
    id: devUserId,
    app_metadata: {},
    user_metadata: { gender: 'male' },
    aud: 'authenticated',
    created_at: new Date().toISOString(),
    email: 'dev@local.test',
  }
}

/**
 * Lấy user hiện tại (JWT email) hoặc user giả khi bypass local / crawler.
 */
export async function getUserOrBypass(): Promise<AppUser | null> {
  const emailUser = await getEmailSessionUser()
  if (emailUser) {
    if (!isValidUuidString(emailUser.id)) return null
    return emailUser
  }
  if (!isAuthRequired()) return getDevUser()
  if (isSearchEngineCrawler()) return getDevUser()
  return null
}

export { FORCE_REAL_LOGIN_COOKIE }

/**
 * Lấy user cho server actions / API (JWT email hoặc dev bypass).
 */
export async function getUserForAction(
  errorMessage = 'Vui lòng đăng nhập.'
): Promise<{ user: AppUser } | { error: string }> {
  const emailUser = await getEmailSessionUser()
  if (emailUser) {
    if (!isValidUuidString(emailUser.id)) return { error: errorMessage }
    return { user: emailUser }
  }
  if (!isAuthRequired()) return { user: getDevUser() }
  return { error: errorMessage }
}
