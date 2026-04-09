import { createHash } from 'crypto'
import { NextResponse } from 'next/server'
import { EMAIL_SESSION_COOKIE, EMAIL_SESSION_COOKIE_LEGACY, isEmailAuthEnabled } from '@/lib/auth/email-auth-config'
import { createEmailSessionTokenString, getEmailSessionCookieOptions } from '@/lib/auth/email-session-token'
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

export async function GET(req: Request) {
  try {
    if (!isEmailAuthEnabled()) {
      return NextResponse.redirect(new URL('/auth/login?error=email_auth_disabled', req.url))
    }
    if (!isPgConfigured()) {
      return NextResponse.redirect(new URL('/auth/login?error=database', req.url))
    }

    const url = new URL(req.url)
    const token = String(url.searchParams.get('token') ?? '').trim()
    const email = normalizeEmail(String(url.searchParams.get('email') ?? ''))
    const nextRaw = url.searchParams.get('next') ?? ''
    const next = sanitizeLoginNext(nextRaw)

    if (!token || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.redirect(new URL('/auth/login?error=invalid_link', req.url))
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
      return NextResponse.redirect(new URL('/auth/login?error=expired_or_invalid_link', req.url))
    }

    const uidRow = await pgQueryOne<{ id: string }>(
      'select (public.nanoai_ensure_user_by_email($1::text))::text as id',
      [email]
    )
    if (!uidRow?.id) {
      return NextResponse.redirect(new URL('/auth/login?error=user', req.url))
    }

    await pgQuery(`update public.nanoai_email_login_challenges set consumed_at = now() where id = $1::uuid`, [row.id])

    const jwt = await createEmailSessionTokenString(uidRow.id, email)
    if (!jwt) {
      return NextResponse.redirect(new URL('/auth/login?error=jwt', req.url))
    }

    const res = NextResponse.redirect(new URL(next, req.url))
    const opts = getEmailSessionCookieOptions()
    res.cookies.set(EMAIL_SESSION_COOKIE, jwt, opts)
    res.cookies.set(EMAIL_SESSION_COOKIE_LEGACY, jwt, opts)
    return res
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('auth.instances_empty')) {
      return NextResponse.redirect(new URL('/auth/login?error=auth_instances', req.url))
    }
    console.error('[auth/email/verify-magic]', msg)
    return NextResponse.redirect(new URL('/auth/login?error=server', req.url))
  }
}
