import { createHash, randomBytes, randomInt } from 'crypto'
import { NextResponse } from 'next/server'
import { isEmailAuthEnabled } from '@/lib/auth/email-auth-config'
import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { sanitizeLoginNext } from '@/lib/auth/sanitize-login-next'
import { getPublicAppUrlForServer } from '@/lib/auth/public-app-url'
import {
  countOtpSendsForEmailLastHour,
  getOtpRequestClientIp,
  isInOtpResendCooldown,
  recordOtpIpHit,
  wouldExceedOtpIpLimit,
} from '@/lib/auth/otp-request-rate-limit'
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

    const clientIp = getOtpRequestClientIp(req)
    const maxPerIp = parseInt(process.env.OTP_MAX_PER_IP_PER_HOUR || '40', 10)
    const maxPerIpSafe = Number.isFinite(maxPerIp) ? Math.max(0, maxPerIp) : 40
    if (wouldExceedOtpIpLimit(clientIp, maxPerIpSafe)) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
    }

    const cooldownSec = parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS || '90', 10)
    const cooldownSafe = Number.isFinite(cooldownSec) ? Math.min(600, Math.max(0, cooldownSec)) : 90
    if (cooldownSafe > 0 && (await isInOtpResendCooldown(email, cooldownSafe))) {
      return NextResponse.json({ error: 'resend_cooldown' }, { status: 429 })
    }

    const maxPerEmailHour = parseInt(process.env.OTP_MAX_PER_EMAIL_PER_HOUR || '5', 10)
    const maxEmailSafe = Number.isFinite(maxPerEmailHour) ? Math.max(1, maxPerEmailHour) : 5
    const sentLastHour = await countOtpSendsForEmailLastHour(email)
    if (sentLastHour >= maxEmailSafe) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
    }

    const otp = String(randomInt(100000, 1000000))
    const magicRaw = randomBytes(24).toString('hex')
    const otpHash = sha256hex(`otp:${email}:${otp}`)
    const magicHash = sha256hex(`magic:${email}:${magicRaw}`)

    const ttlMinRaw = parseInt(process.env.EMAIL_MAGIC_LINK_TTL_MINUTES || '15', 10)
    const ttlMinutes = Number.isFinite(ttlMinRaw) ? Math.min(10080, Math.max(5, ttlMinRaw)) : 15

    const inserted = await pgQueryOne<{ id: string }>(
      `insert into public.nanoai_email_login_challenges (email_normalized, otp_hash, magic_token_hash, expires_at)
       values ($1, $2, $3, now() + ($4::int * interval '1 minute'))
       returning id::text as id`,
      [email, otpHash, magicHash, ttlMinutes]
    )

    const baseUrl = getPublicAppUrlForServer(req)
    const magicUrl = `${baseUrl}/api/auth/email/verify-magic?token=${encodeURIComponent(magicRaw)}&email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`

    const sent = await sendSmtpMail({
      to: email,
      subject: 'Mã đăng nhập NanoAI',
      text: `Mã OTP: ${otp}\n\nHoặc bấm link (hết hạn sau ${ttlMinutes} phút):\n${magicUrl}\n`,
      html: `<p>Mã OTP: <b>${otp}</b></p><p><a href="${magicUrl}">Đăng nhập bằng một lần bấm</a></p><p>Hết hạn sau ${ttlMinutes} phút (OTP và link cùng thời hạn).</p>`,
    })

    if (!sent.ok) {
      if (inserted?.id) {
        try {
          await pgQuery(`delete from public.nanoai_email_login_challenges where id = $1::uuid`, [inserted.id])
        } catch (delErr) {
          console.error('[auth/email/request] rollback challenge after SMTP failure', delErr)
        }
      }
      return NextResponse.json({ error: sent.error }, { status: 500 })
    }
    recordOtpIpHit(clientIp)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[auth/email/request]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
