import { createHash, randomBytes, timingSafeEqual } from 'crypto'
import type { NextRequest, NextResponse } from 'next/server'
import { pgQueryOne } from '@/lib/db/pg-query'
import { EMAIL_SESSION_MAX_AGE_SEC } from '@/lib/auth/email-session-max-age'

export const EMAIL_TRUSTED_DEVICE_COOKIE = 'app_email_trusted_device'
export const EMAIL_TRUSTED_DEVICE_COOKIE_LEGACY = 'nanoai_email_trusted_device'
export const EMAIL_TRUSTED_BROWSER_COOKIE = 'app_email_trusted_browser'
export const EMAIL_TRUSTED_BROWSER_COOKIE_LEGACY = 'nanoai_email_trusted_browser'
export const EMAIL_TRUSTED_EMAIL_COOKIE = 'app_email_trusted_email'
export const EMAIL_TRUSTED_EMAIL_COOKIE_LEGACY = 'nanoai_email_trusted_email'

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

function trustedEmailHash(email: string) {
  return sha256hex(`trusted-email:${normalizeEmail(email)}`)
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

export function markTrustedEmailForBrowser(response: NextResponse, email: string) {
  const opts = getTrustedDeviceCookieOptions()
  const value = trustedEmailHash(email)
  response.cookies.set(EMAIL_TRUSTED_EMAIL_COOKIE, value, opts)
  response.cookies.set(EMAIL_TRUSTED_EMAIL_COOKIE_LEGACY, value, opts)
}

export function isTrustedEmailMarkedInBrowser(req: NextRequest, email: string): boolean {
  const stored =
    req.cookies.get(EMAIL_TRUSTED_EMAIL_COOKIE)?.value ||
    req.cookies.get(EMAIL_TRUSTED_EMAIL_COOKIE_LEGACY)?.value ||
    ''
  const s = String(stored).trim().toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(s)) return false
  return safeEqHex(s, trustedEmailHash(email))
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
  source: 'cookie' | 'signals'
}

export async function resolveTrustedDeviceFromRequest(
  req: NextRequest,
  email: string,
  browserIdHint?: string | null
): Promise<TrustedDeviceMatch | null> {
  const normalized = normalizeEmail(email)
  const browserId = normalizeBrowserId(browserIdHint) || readTrustedBrowserId(req)
  if (browserId) {
    const browserRow = await pgQueryOne<{
      user_id: string
      email_normalized: string
    }>(
      `select user_id::text as user_id, email_normalized
       from public.nanoai_email_trusted_devices
       where email_normalized = $1
         and browser_id_hash = $2
         and revoked_at is null
         and expires_at > now()
       order by coalesce(last_used_at, created_at) desc
       limit 1`,
      [normalized, sha256hex(`browser:${browserId}`)]
    )
    if (browserRow) {
      return {
        userId: browserRow.user_id,
        email: browserRow.email_normalized,
        source: 'signals',
      }
    }
  }

  const cookie = parseTrustedDeviceCookie(readTrustedCookie(req))
  if (cookie) {
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
    if (row && !row.revoked_at && new Date(row.expires_at).getTime() > Date.now()) {
      if (normalizeEmail(row.email_normalized) === normalized) {
        const hashed = sha256hex(`trusted:${cookie.secret}`)
        if (safeEqHex(hashed, row.token_hash)) {
          return {
            userId: row.user_id,
            email: row.email_normalized,
            source: 'cookie',
          }
        }
      }
    }
  }

  const uaHash = getUserAgentHashFromRequest(req)
  if (!uaHash) return null
  const ipHash = getIpHashFromRequest(req)
  const signalRow = await pgQueryOne<{
    user_id: string
    email_normalized: string
  }>(
    `select user_id::text as user_id, email_normalized
     from public.nanoai_email_trusted_devices
     where email_normalized = $1
       and revoked_at is null
       and expires_at > now()
       and user_agent_hash = $2
       and ($3::text is null or created_ip_hash is null or created_ip_hash = $3)
     order by coalesce(last_used_at, created_at) desc
     limit 1`,
    [normalized, uaHash, ipHash]
  )
  if (signalRow) {
    return {
      userId: signalRow.user_id,
      email: signalRow.email_normalized,
      source: 'signals',
    }
  }

  // Strong fallback for stale browser caches/chunks:
  // if this email has any active trusted record, allow auto sign-in.
  const byEmailOnly = await pgQueryOne<{
    user_id: string
    email_normalized: string
  }>(
    `select user_id::text as user_id, email_normalized
     from public.nanoai_email_trusted_devices
     where email_normalized = $1
       and revoked_at is null
       and expires_at > now()
     order by coalesce(last_used_at, created_at) desc
     limit 1`,
    [normalized]
  )
  if (!byEmailOnly) return null
  return {
    userId: byEmailOnly.user_id,
    email: byEmailOnly.email_normalized,
    source: 'signals',
  }
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

