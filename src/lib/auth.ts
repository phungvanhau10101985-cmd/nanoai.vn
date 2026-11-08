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
import {
  buildGuestTrialEmail,
  canGuestUseCreditTrial,
  clearGuestTrialUserIdCookie,
  getOrCreateGuestTrialId,
  setGuestTrialUserIdCookie,
} from '@/lib/guest-credit-trial'

const FORCE_REAL_LOGIN_COOKIE = 'force_real_login'

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

function httpDisplayAvatar(raw: string | null | undefined): string | null {
  const url = String(raw ?? '').trim()
  if (!/^https?:\/\//i.test(url) || url.length > 2000) return null
  return url
}

/** Tên + ảnh hồ sơ (Google ghi vào profiles) để menu tài khoản hiện đúng tên. */
async function attachAccountDisplayFromPg(user: AppUser): Promise<AppUser> {
  if (!isPgConfigured() || !isValidUuidString(user.id)) return user
  try {
    const row = await pgQueryOne<{
      full_name: string | null
      avatar_url: string | null
      meta_name: string | null
      meta_picture: string | null
    }>(
      `select nullif(trim(p.full_name), '') as full_name,
              nullif(trim(p.avatar_url), '') as avatar_url,
              nullif(trim(coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name')), '') as meta_name,
              nullif(trim(coalesce(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture')), '') as meta_picture
       from auth.users u
       left join public.profiles p on p.id = u.id
       where u.id = $1::uuid
       limit 1`,
      [user.id]
    )
    if (!row) return user
    const fullName = String(row.full_name || row.meta_name || '').trim()
    const avatar = httpDisplayAvatar(row.avatar_url) || httpDisplayAvatar(row.meta_picture)
    if (!fullName && !avatar) return user
    const meta = { ...(user.user_metadata ?? {}) }
    if (fullName) {
      meta.full_name = fullName
      meta.name = fullName
    }
    if (avatar) meta.avatar_url = avatar
    return { ...user, user_metadata: meta }
  } catch {
    return user
  }
}

/** Crawler và bot mua sắm phải thấy cùng HTML với khách chưa đăng nhập. */
function isSearchEngineCrawler(): boolean {
  try {
    const h = headers()
    const ua = (h.get('user-agent') || '').toLowerCase()
    return /googlebot|adsbot-google|storebot-google|google-inspectiontool|mediapartners-google|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebookexternalhit|twitterbot|linkedinbot|embedly|pinterest|whatsapp|telegrambot/i.test(ua)
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

/** Phiên email thật. Có cookie đăng nhập thì dùng tài khoản đó, kể cả trên localhost. */
async function readRealEmailUser(): Promise<AppUser | null> {
  const emailUser = await getEmailSessionUser()
  if (!emailUser || !isValidUuidString(emailUser.id)) return null
  return attachAccountDisplayFromPg(await canonicalizeUserByEmail(emailUser))
}

/**
 * Lấy user hiện tại (JWT email) hoặc user giả khi bypass local.
 * Đã đăng nhập tài khoản thật thì giữ tài khoản đó. Dev chỉ là fallback khi chưa có phiên.
 * Crawler không nhận user giả: trang tính năng render bản công khai giống khách chưa đăng nhập.
 */
export async function getUserOrBypass(): Promise<AppUser | null> {
  if (isSearchEngineCrawler()) return null
  const signedIn = await readRealEmailUser()
  if (signedIn) return signedIn
  if (!isAuthRequired()) return canonicalizeUserByEmail(getDevUser())
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
  const signedIn = await readRealEmailUser()
  if (signedIn) return { user: signedIn }
  if (!isAuthRequired()) return { user: await canonicalizeUserByEmail(getDevUser()) }
  const user = await getWalletSessionUser()
  if (user) return { user }
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
  const signedIn = await readRealEmailUser()
  if (signedIn) return { user: signedIn }
  if (!isAuthRequired()) return { user: await canonicalizeUserByEmail(getDevUser()) }
  const user = await getWalletSessionUser()
  if (user) return { user }
  if (!(await canGuestUseCreditTrial())) {
    clearGuestTrialUserIdCookie()
    return { error: errorMessage }
  }
  const guestUser = await resolveGuestTrialUser()
  if (!guestUser) return { error: 'Không thể khởi tạo tài khoản dùng thử. Vui lòng đăng nhập.' }
  return { user: guestUser }
}
