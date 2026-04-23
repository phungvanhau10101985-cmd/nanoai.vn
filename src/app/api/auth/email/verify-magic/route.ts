import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { EMAIL_SESSION_COOKIE, EMAIL_SESSION_COOKIE_LEGACY, isEmailAuthEnabled } from '@/lib/auth/email-auth-config'
import { createEmailSessionTokenString, getEmailSessionCookieOptions } from '@/lib/auth/email-session-token'
import { issueTrustedDeviceForUser, markTrustedEmailForBrowser } from '@/lib/auth/email-trusted-device'
import { getPublicAppUrlForServer } from '@/lib/auth/public-app-url'
import { sanitizeLoginNext } from '@/lib/auth/sanitize-login-next'
import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

export const dynamic = 'force-dynamic'

function sha256hex(s: string) {
  return createHash('sha256').update(s, 'utf8').digest('hex')
}

function normalizeEmail(e: string) {
  return e.trim().toLowerCase()
}

/** Tránh `new URL(path, req.url)` — sau reverse proxy `req.url` thường là 127.0.0.1 → redirect sai domain. */
function absoluteRedirect(req: Request, pathAndQuery: string): NextResponse {
  const base = getPublicAppUrlForServer(req).replace(/\/$/, '')
  const p = pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`
  return NextResponse.redirect(`${base}${p}`)
}

export async function GET(req: NextRequest) {
  try {
    if (!isEmailAuthEnabled()) {
      return absoluteRedirect(req, '/auth/login?error=email_auth_disabled')
    }
    if (!isPgConfigured()) {
      return absoluteRedirect(req, '/auth/login?error=database')
    }

    const url = new URL(req.url)
    const token = String(url.searchParams.get('token') ?? '').trim()
    const email = normalizeEmail(String(url.searchParams.get('email') ?? ''))
    const nextRaw = url.searchParams.get('next') ?? ''
    const next = sanitizeLoginNext(nextRaw)

    if (!token || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return absoluteRedirect(req, '/auth/login?error=invalid_link')
    }

    /** Khớp đúng challenge theo token (không chỉ «bản mới nhất») — tránh wrong_link khi gửi OTP nhiều lần. */
    const tryHash = sha256hex(`magic:${email}:${token}`)
    const row = await pgQueryOne<{ id: string; magic_token_hash: string }>(
      `select id, magic_token_hash from public.nanoai_email_login_challenges
       where email_normalized = $1 and consumed_at is null and expires_at > now()
         and magic_token_hash = $2
       order by created_at desc limit 1`,
      [email, tryHash]
    )
    if (!row) {
      return absoluteRedirect(req, '/auth/login?error=expired_or_invalid_link')
    }

    const uidRow = await pgQueryOne<{ id: string }>(
      'select (public.nanoai_ensure_user_by_email($1::text))::text as id',
      [email]
    )
    if (!uidRow?.id) {
      return absoluteRedirect(req, '/auth/login?error=user')
    }

    await pgQuery(`update public.nanoai_email_login_challenges set consumed_at = now() where id = $1::uuid`, [row.id])

    const jwt = await createEmailSessionTokenString(uidRow.id, email)
    if (!jwt) {
      return absoluteRedirect(req, '/auth/login?error=jwt')
    }

    const res = absoluteRedirect(req, next)
    const opts = getEmailSessionCookieOptions()
    res.cookies.set(EMAIL_SESSION_COOKIE, jwt, opts)
    res.cookies.set(EMAIL_SESSION_COOKIE_LEGACY, jwt, opts)
    markTrustedEmailForBrowser(res, email)
    await issueTrustedDeviceForUser(res, req, uidRow.id, email)
    return res
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('auth.instances_empty')) {
      return absoluteRedirect(req, '/auth/login?error=auth_instances')
    }
    console.error('[auth/email/verify-magic]', msg)
    return absoluteRedirect(req, '/auth/login?error=server')
  }
}
