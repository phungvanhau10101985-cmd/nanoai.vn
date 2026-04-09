import { createHash, randomBytes, randomInt } from 'crypto'
import { NextResponse } from 'next/server'
import { isEmailAuthEnabled } from '@/lib/auth/email-auth-config'
import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery } from '@/lib/db/pg-query'
import { sanitizeLoginNext } from '@/lib/auth/sanitize-login-next'
import { isSmtpConfigured, sendSmtpMail } from '@/lib/email/smtp'

export const dynamic = 'force-dynamic'

function sha256hex(s: string) {
  return createHash('sha256').update(s, 'utf8').digest('hex')
}

function normalizeEmail(e: string) {
  return e.trim().toLowerCase()
}

/** Gửi OTP + magic link đăng nhập qua SMTP. */
export async function POST(req: Request) {
  try {
    if (!isEmailAuthEnabled()) {
      return NextResponse.json({ error: 'email_auth_disabled' }, { status: 503 })
    }
    if (!isSmtpConfigured()) {
      return NextResponse.json({ error: 'smtp_not_configured' }, { status: 503 })
    }
    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'database_not_configured' }, { status: 503 })
    }

    const body = (await req.json().catch(() => null)) as { email?: string; next?: string } | null
    const email = normalizeEmail(String(body?.email || ''))
    const next = sanitizeLoginNext(body?.next)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'invalid_email' }, { status: 400 })
    }

    const recent = await pgQuery<{ n: string }>(
      `select count(*)::text as n from public.nanoai_email_login_challenges
       where email_normalized = $1 and created_at > now() - interval '1 hour'`,
      [email]
    )
    const n = recent[0] ? parseInt(recent[0].n, 10) : 0
    if (n >= 5) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
    }

    const otp = String(randomInt(100000, 1000000))
    const magicRaw = randomBytes(24).toString('hex')
    const otpHash = sha256hex(`otp:${email}:${otp}`)
    const magicHash = sha256hex(`magic:${email}:${magicRaw}`)

    await pgQuery(
      `insert into public.nanoai_email_login_challenges (email_normalized, otp_hash, magic_token_hash, expires_at)
       values ($1, $2, $3, now() + interval '15 minutes')`,
      [email, otpHash, magicHash]
    )

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, '') || 'http://localhost:3000'
    const magicUrl = `${baseUrl}/api/auth/email/verify-magic?token=${encodeURIComponent(magicRaw)}&email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`

    const sent = await sendSmtpMail({
      to: email,
      subject: 'Mã đăng nhập NanoAI',
      text: `Mã OTP: ${otp}\n\nHoặc bấm link (hết hạn sau 15 phút):\n${magicUrl}\n`,
      html: `<p>Mã OTP: <b>${otp}</b></p><p><a href="${magicUrl}">Đăng nhập bằng một lần bấm</a></p><p>Hết hạn sau 15 phút.</p>`,
    })

    if (!sent.ok) {
      return NextResponse.json({ error: sent.error }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[auth/email/request]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
