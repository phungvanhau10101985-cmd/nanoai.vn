import { createHash, randomBytes, timingSafeEqual } from 'crypto'
import type { NextRequest, NextResponse } from 'next/server'
import { pgQueryOne } from '@/lib/db/pg-query'
import { EMAIL_SESSION_MAX_AGE_SEC } from '@/lib/auth/email-session-max-age'

export const EMAIL_TRUSTED_DEVICE_COOKIE = 'app_email_trusted_device'
export const EMAIL_TRUSTED_DEVICE_COOKIE_LEGACY = 'nanoai_email_trusted_device'
export const EMAIL_TRUSTED_BROWSER_COOKIE = 'app_email_trusted_browser'
export const EMAIL_TRUSTED_BROWSER_COOKIE_LEGACY = 'nanoai_email_trusted_browser'

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function normalizeBrowserId(raw: string | null | undefined): string | null {
  const s = String(raw || '').trim().toLowerCase()
  if (!s) return null
  if (!/^[a-z0-9_-]{16,128}$/.test(s)) return null
  return s
}

function resolveTrustedDeviceMaxAgeSec(): number {
  const raw = process.env.EMAIL_TRUSTED_DEVICE_MAX_AGE_DAYS?.trim()
  if (!raw) return EMAIL_SESSION_MAX_AGE_SEC
  const days = parseInt(raw, 10)
  const clamped = Number.isFinite(days) ? Math.min(3650, Math.max(1, days)) : EMAIL_SESSION_MAX_AGE_SEC / 86400
  return clamped * 24 * 60 * 60
}

function sha256hex(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function getIpHashFromRequest(req: NextRequest) {
  const ipRaw = (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim()
  if (!ipRaw) return null
  return sha256hex(`ip:${ipRaw}`)
}

function getUserAgentHashFromRequest(req: NextRequest) {
  const ua = req.headers.get('user-agent')?.trim()
  if (!ua) return null
  return sha256hex(`ua:${ua}`)
}

function parseTrustedDeviceCookie(value: string | undefined | null): { id: string; secret: string } | null {
  const s = String(value || '').trim()
  if (!s) return null
  const dot = s.indexOf('.')
  if (dot <= 0 || dot >= s.length - 1) return null
  const id = s.slice(0, dot).trim()
  const secret = s.slice(dot + 1).trim()
  if (!/^[0-9a-fA-F-]{36}$/.test(id)) return null
  if (!/^[0-9a-fA-F]{64}$/.test(secret)) return null
  return { id, secret: secret.toLowerCase() }
}

function safeEqHex(a: string, b: string) {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))
}

export function getTrustedDeviceCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production'
  return {
    path: '/',
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
    maxAge: resolveTrustedDeviceMaxAgeSec(),
  }
}

function readTrustedCookie(req: NextRequest) {
  return (
    req.cookies.get(EMAIL_TRUSTED_DEVICE_COOKIE)?.value ||
    req.cookies.get(EMAIL_TRUSTED_DEVICE_COOKIE_LEGACY)?.value ||
    null
  )
}

function readTrustedBrowserId(req: NextRequest): string | null {
  const value =
    req.cookies.get(EMAIL_TRUSTED_BROWSER_COOKIE)?.value ||
    req.cookies.get(EMAIL_TRUSTED_BROWSER_COOKIE_LEGACY)?.value ||
    ''
  return normalizeBrowserId(value)
}

function setTrustedBrowserIdCookies(response: NextResponse, browserId: string) {
  const opts = getTrustedDeviceCookieOptions()
  response.cookies.set(EMAIL_TRUSTED_BROWSER_COOKIE, browserId, opts)
  response.cookies.set(EMAIL_TRUSTED_BROWSER_COOKIE_LEGACY, browserId, opts)
}

function resolveTrustedBrowserId(
  req: NextRequest,
  response?: NextResponse,
  browserIdHint?: string | null
): string {
  const hinted = normalizeBrowserId(browserIdHint)
  if (hinted) {
    if (response) setTrustedBrowserIdCookies(response, hinted)
    return hinted
  }
  const existing = readTrustedBrowserId(req)
  if (existing) {
    if (response) setTrustedBrowserIdCookies(response, existing)
    return existing
  }
  const created = randomBytes(24).toString('hex')
  if (response) setTrustedBrowserIdCookies(response, created)
  return created
}

export function clearTrustedDeviceCookies(response: NextResponse) {
  const clear = { path: '/', maxAge: 0 }
  response.cookies.set(EMAIL_TRUSTED_DEVICE_COOKIE, '', clear)
  response.cookies.set(EMAIL_TRUSTED_DEVICE_COOKIE_LEGACY, '', clear)
}

function setTrustedDeviceCookies(response: NextResponse, cookieValue: string) {
  const opts = getTrustedDeviceCookieOptions()
  response.cookies.set(EMAIL_TRUSTED_DEVICE_COOKIE, cookieValue, opts)
  response.cookies.set(EMAIL_TRUSTED_DEVICE_COOKIE_LEGACY, cookieValue, opts)
}

export async function issueTrustedDeviceForUser(
  response: NextResponse,
  req: NextRequest,
  userId: string,
  email: string,
  browserIdHint?: string | null
) {
  const browserId = resolveTrustedBrowserId(req, response, browserIdHint)
  const deviceSecret = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + resolveTrustedDeviceMaxAgeSec() * 1000).toISOString()
  const normalized = normalizeEmail(email)
  const row = await pgQueryOne<{ id: string }>(
    `insert into public.nanoai_email_trusted_devices (
      user_id,
      email_normalized,
      token_hash,
      browser_id_hash,
      expires_at,
      created_ip_hash,
      user_agent_hash,
      last_used_at
    ) values ($1::uuid, $2, $3, $4, $5::timestamptz, $6, $7, now())
    returning id::text as id`,
    [
      userId,
      normalized,
      sha256hex(`trusted:${deviceSecret}`),
      sha256hex(`browser:${browserId}`),
      expiresAt,
      getIpHashFromRequest(req),
      getUserAgentHashFromRequest(req),
    ]
  )
  if (!row?.id) return
  setTrustedDeviceCookies(response, `${row.id}.${deviceSecret}`)
}

type TrustedDeviceMatch = {
  userId: string
  email: string
  source: 'cookie'
}

async function resolveTrustedDeviceRowFromCookie(
  cookie: { id: string; secret: string },
  email?: string | null
): Promise<TrustedDeviceMatch | null> {
  const row = await pgQueryOne<{
    id: string
    user_id: string
    email_normalized: string
    token_hash: string
    expires_at: string
    revoked_at: string | null
  }>(
    `select id::text as id, user_id::text as user_id, email_normalized, token_hash, expires_at::text as expires_at, revoked_at::text as revoked_at
     from public.nanoai_email_trusted_devices
     where id = $1::uuid
     limit 1`,
    [cookie.id]
  )
  if (!row || row.revoked_at || new Date(row.expires_at).getTime() <= Date.now()) return null
  if (email && normalizeEmail(row.email_normalized) !== normalizeEmail(email)) return null
  const hashed = sha256hex(`trusted:${cookie.secret}`)
  if (!safeEqHex(hashed, row.token_hash)) return null
  return {
    userId: row.user_id,
    email: row.email_normalized,
    source: 'cookie',
  }
}

/** Khớp thiết bị tin cậy khi khách nhập lại đúng email. */
export async function resolveTrustedDeviceFromRequest(
  req: NextRequest,
  email: string
): Promise<TrustedDeviceMatch | null> {
  const cookie = parseTrustedDeviceCookie(readTrustedCookie(req))
  if (!cookie) return null
  return resolveTrustedDeviceRowFromCookie(cookie, email)
}

/** Khôi phục phiên im lặng từ cookie thiết bị tin cậy (không cần nhập email). */
export async function resolveTrustedDeviceFromRequestWithoutEmail(
  req: NextRequest
): Promise<TrustedDeviceMatch | null> {
  const cookie = parseTrustedDeviceCookie(readTrustedCookie(req))
  if (!cookie) return null
  return resolveTrustedDeviceRowFromCookie(cookie, null)
}

export async function touchTrustedDeviceFromRequest(response: NextResponse, req: NextRequest) {
  resolveTrustedBrowserId(req, response, null)
  const cookie = parseTrustedDeviceCookie(readTrustedCookie(req))
  if (!cookie) return
  const expiresAt = new Date(Date.now() + resolveTrustedDeviceMaxAgeSec() * 1000).toISOString()
  const newSecret = randomBytes(32).toString('hex')
  const updated = await pgQueryOne<{ id: string }>(
    `update public.nanoai_email_trusted_devices
     set token_hash = $2,
         expires_at = $3::timestamptz,
         last_used_at = now(),
         user_agent_hash = coalesce($4, user_agent_hash)
     where id = $1::uuid and revoked_at is null
     returning id::text as id`,
    [cookie.id, sha256hex(`trusted:${newSecret}`), expiresAt, getUserAgentHashFromRequest(req)]
  )
  if (updated) {
    setTrustedDeviceCookies(response, `${cookie.id}.${newSecret}`)
  }
}

