import type { AppUser } from '@/lib/auth/app-user'
import { cookies, headers } from 'next/headers'
import { getEmailSessionUser } from '@/lib/auth/email-session-user'
import {
  MESSAGING_GUEST_ACCOUNT_COOKIE,
  MESSAGING_GUEST_ACCOUNT_COOKIE_LEGACY,
  MESSAGING_GUEST_ACCOUNT_HEADER,
} from '@/lib/messaging/guest-account-session'
import { isValidUuidString } from '@/lib/validate-uuid'
import { isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'
import { readLoginNextFromHeaders } from '@/lib/auth/app-request-headers'
import { sanitizeLoginNext } from '@/lib/auth/sanitize-login-next'
import {
  buildGuestTrialEmail,
  canGuestUseCreditTrial,
  getGuestTrialIdFromCookie,
  getGuestTrialUserIdFromCookie,
  isGuestTrialUser,
  getOrCreateGuestTrialId,
  setGuestTrialUserIdCookie,
} from '@/lib/guest-credit-trial'

const FORCE_REAL_LOGIN_COOKIE = 'force_real_login'
const CREDIT_TRIAL_ROUTE_PREFIXES = [
  '/thu-do-online',
  '/lam-net-anh',
  '/xoa-nen-png',
  '/xoa-vat-the',
  '/lam-dep-anh',
  '/mo-rong-khung-hinh',
  '/phuc-dung-anh',
  '/tao-anh-3d',
  '/tao-anh-chain-dung',
  '/tao-anh-the',
  '/tao-anh-tu-chu',
  '/tao-banner',
  '/tao-giao-trinh',
  '/tao-infographic-tu-sach',
  '/tao-mo-hinh-3d-tu-anh',
  '/tao-nhan-gian',
  '/tao-nhan-gioi-thieu-san-pham',
  '/tao-tem-niem-phong-bao-hanh',
  '/tao-video-tu-anh',
  '/thay-nen-san-pham',
  '/thiet-ke-bao-bi',
  '/thiet-ke-con-dau',
  '/thiet-ke-logo',
  '/thiet-ke-noi-ngoai-that',
  '/che-anh',
  '/dich-anh-tai-lieu',
  '/du-anh-tu-phac-thao',
  '/flow-nhac-video-veo',
  '/ghep-anh',
  '/hoan-doi-khuon-mat',
  '/ke-chuyen-bang-hinh-anh',
  '/xay-nha-tu-dat-nen',
  '/ghi-am-bao-cao-cuoc-hop',
] as const

function getRequestPathForAuth(): string {
  try {
    const h = headers()
    const fromHeader = readLoginNextFromHeaders((name) => h.get(name))
    if (fromHeader) return sanitizeLoginNext(fromHeader)
    const raw = h.get('next-url')?.trim() || h.get('x-pathname')?.trim() || '/'
    return sanitizeLoginNext(raw)
  } catch {
    return '/'
  }
}

function isCreditTrialRoute(pathname: string): boolean {
  const p = sanitizeLoginNext(pathname || '/')
  return CREDIT_TRIAL_ROUTE_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`))
}

async function resolveExistingGuestTrialUserFromCookies(): Promise<AppUser | null> {
  const userId = getGuestTrialUserIdFromCookie()
  if (!userId || !isValidUuidString(userId)) return null
  if (!(await isGuestTrialUser(userId))) return null
  const trialId = getGuestTrialIdFromCookie()
  const email = trialId ? buildGuestTrialEmail(trialId) : 'guest-trial@guest.nanoai.local'
  return {
    id: userId,
    email,
    aud: 'authenticated',
    app_metadata: {},
    user_metadata: { guest_trial: true },
    created_at: new Date().toISOString(),
  }
}

async function canonicalizeUserByEmail(user: AppUser): Promise<AppUser> {
  const email = String(user.email ?? '').trim().toLowerCase()
  if (!email || !isPgConfigured()) return user
  try {
    const direct = await pgQueryOne<{ id: string }>(
      `select id::text
       from auth.users
       where lower(coalesce(email, '')) = $1
       order by created_at asc
       limit 1`,
      [email]
    )
    if (direct?.id && isValidUuidString(direct.id) && direct.id !== user.id) {
      return { ...user, id: direct.id }
    }
  } catch {
    // Some DB roles may not allow direct read from auth.users.
  }
  try {
    const row = await pgQueryOne<{ id: string }>(
      `select (public.nanoai_ensure_user_by_email($1::text))::text as id`,
      [email]
    )
    if (row?.id && isValidUuidString(row.id) && row.id !== user.id) {
      return { ...user, id: row.id }
    }
  } catch {
    // Keep current session user when canonical lookup is unavailable on this environment.
  }
  return user
}

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
    return canonicalizeUserByEmail(emailUser)
  }
  if (!isAuthRequired()) return getDevUser()
  if (isSearchEngineCrawler()) return getDevUser()
  if (isCreditTrialRoute(getRequestPathForAuth())) {
    if (await canGuestUseCreditTrial()) {
      const guest = await resolveGuestTrialUser()
      if (guest) return guest
    } else {
      // Keep existing guest session visible after consuming the last trial credits.
      // Blocking generation is handled by getUserForCreditAction on the next request.
      const existingGuest = await resolveExistingGuestTrialUserFromCookies()
      if (existingGuest) return existingGuest
    }
  }
  return null
}

export { FORCE_REAL_LOGIN_COOKIE }

function readGuestAccountIdForWalletFromRequest(): string | null {
  try {
    const raw =
      headers().get(MESSAGING_GUEST_ACCOUNT_HEADER)?.trim()
      ?? cookies().get(MESSAGING_GUEST_ACCOUNT_COOKIE)?.value?.trim()
      ?? cookies().get(MESSAGING_GUEST_ACCOUNT_COOKIE_LEGACY)?.value?.trim()
      ?? ''
    return isValidUuidString(raw) ? raw : null
  } catch {
    return null
  }
}

/** Guest chat đã OTP: map messaging_guest_accounts → cùng user ví với JWT email (nanoai_ensure_user_by_email). */
async function resolveWalletUserFromVerifiedGuestAccount(guestAccountId: string): Promise<AppUser | null> {
  if (!isValidUuidString(guestAccountId) || !isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ email_normalized: string }>(
      `select email_normalized from public.messaging_guest_accounts where id = $1::uuid limit 1`,
      [guestAccountId]
    )
    const email = String(row?.email_normalized ?? '').trim().toLowerCase()
    if (!email) return null
    const idRow = await pgQueryOne<{ id: string }>(
      `select (public.nanoai_ensure_user_by_email($1::text))::text as id`,
      [email]
    )
    const id = String(idRow?.id ?? '').trim()
    if (!isValidUuidString(id)) return null
    return {
      id,
      email,
      aud: 'authenticated',
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
    }
  } catch {
    return null
  }
}

/**
 * Phiên ví (/api/account/*, /api/auth/me): JWT email cookie hoặc guest account đã xác thực (cookie/header).
 * Không gồm dev bypass — dùng getUserForAction cho bypass local.
 */
export async function getWalletSessionUser(): Promise<AppUser | null> {
  const emailUser = await getEmailSessionUser()
  if (emailUser) {
    if (!isValidUuidString(emailUser.id)) return null
    return await canonicalizeUserByEmail(emailUser)
  }
  const guestId = readGuestAccountIdForWalletFromRequest()
  if (guestId) {
    const g = await resolveWalletUserFromVerifiedGuestAccount(guestId)
    if (g) return await canonicalizeUserByEmail(g)
  }
  return null
}

/**
 * Lấy user cho server actions / API (JWT email, guest account đã OTP, hoặc dev bypass).
 */
export async function getUserForAction(
  errorMessage = 'Vui lòng đăng nhập.'
): Promise<{ user: AppUser } | { error: string }> {
  const user = await getWalletSessionUser()
  if (user) return { user }
  if (!isAuthRequired()) return { user: getDevUser() }
  return { error: errorMessage }
}

async function resolveGuestTrialUser(): Promise<AppUser | null> {
  if (!isPgConfigured()) return null
  try {
    const guestTrialId = getOrCreateGuestTrialId()
    const email = buildGuestTrialEmail(guestTrialId)
    const row = await pgQueryOne<{ id: string }>(
      `select (public.nanoai_ensure_user_by_email($1::text))::text as id`,
      [email]
    )
    const id = String(row?.id ?? '').trim()
    if (!isValidUuidString(id)) return null
    setGuestTrialUserIdCookie(id)
    return {
      id,
      email,
      aud: 'authenticated',
      app_metadata: {},
      user_metadata: { guest_trial: true },
      created_at: new Date().toISOString(),
    }
  } catch {
    return null
  }
}

/**
 * Dành cho các tính năng tiêu tốn credit:
 * - Đã đăng nhập: dùng user thật.
 * - Chưa đăng nhập: cho dùng thử tối đa 3 credits theo trình duyệt.
 * - Hết ngân sách trial: yêu cầu đăng nhập.
 */
export async function getUserForCreditAction(
  errorMessage = 'Bạn đã dùng hết 3 credits dùng thử. Vui lòng đăng nhập để tiếp tục.'
): Promise<{ user: AppUser } | { error: string }> {
  const user = await getWalletSessionUser()
  if (user) return { user }
  if (!isAuthRequired()) return { user: getDevUser() }
  if (!(await canGuestUseCreditTrial())) return { error: errorMessage }
  const guestUser = await resolveGuestTrialUser()
  if (!guestUser) return { error: 'Không thể khởi tạo tài khoản dùng thử. Vui lòng đăng nhập.' }
  return { user: guestUser }
}
