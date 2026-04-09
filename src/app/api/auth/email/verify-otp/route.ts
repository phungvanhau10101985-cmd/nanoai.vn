import { createHash, timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { EMAIL_SESSION_COOKIE, isEmailAuthEnabled } from '@/lib/auth/email-auth-config'
import { createEmailSessionTokenString, getEmailSessionCookieOptions } from '@/lib/auth/email-session-token'
import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

export const dynamic = 'force-dynamic'

function sha256hex(s: string) {
  return createHash('sha256').update(s, 'utf8').digest('hex')
}

function normalizeEmail(e: string) {
  return e.trim().toLowerCase()
}

function safeEqStr(a: string, b: string) {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))
}

export async function POST(req: Request) {
  try {
    if (!isEmailAuthEnabled()) {
      return NextResponse.json({ error: 'email_auth_disabled' }, { status: 503 })
    }
    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'database_not_configured' }, { status: 503 })
    }

    const body = (await req.json().catch(() => null)) as { email?: string; otp?: string } | null
    const email = normalizeEmail(String(body?.email || ''))
    const otp = String(body?.otp ?? '').replace(/\D/g, '').trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || otp.length !== 6) {
      return NextResponse.json({ error: 'invalid_payload' }, { status: 400 })
    }

    const row = await pgQueryOne<{ id: string; otp_hash: string }>(
      `select id, otp_hash from public.nanoai_email_login_challenges
       where email_normalized = $1 and consumed_at is null and expires_at > now()
       order by created_at desc limit 1`,
      [email]
    )
    if (!row) {
      return NextResponse.json({ error: 'no_challenge' }, { status: 400 })
    }

    const tryHash = sha256hex(`otp:${email}:${otp}`)
    if (!safeEqStr(tryHash, row.otp_hash)) {
      return NextResponse.json({ error: 'wrong_otp' }, { status: 401 })
    }

    const uidRow = await pgQueryOne<{ id: string }>(
      'select (public.nanoai_ensure_user_by_email($1::text))::text as id',
      [email]
    )
    if (!uidRow?.id) {
      return NextResponse.json({ error: 'user_create_failed' }, { status: 500 })
    }

    await pgQuery(`update public.nanoai_email_login_challenges set consumed_at = now() where id = $1::uuid`, [row.id])

    const token = await createEmailSessionTokenString(uidRow.id, email)
    if (!token) {
      return NextResponse.json({ error: 'jwt_config' }, { status: 500 })
    }

    const res = NextResponse.json({ ok: true })
    res.cookies.set(EMAIL_SESSION_COOKIE, token, getEmailSessionCookieOptions())
    return res
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('auth.instances_empty')) {
      return NextResponse.json({ error: 'auth_instances_missing' }, { status: 503 })
    }
    console.error('[auth/email/verify-otp]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
