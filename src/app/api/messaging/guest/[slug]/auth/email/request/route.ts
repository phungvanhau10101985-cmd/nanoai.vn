import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { isReservedMessagingGuestSlug } from '@/lib/messaging/reserved-guest-slugs'
import {
  createGuestSessionId,
  readGuestSessionIdFromRequest,
  writeGuestSessionCookie,
} from '@/lib/messaging/guest-auth-session'
import { isValidMessagingGuestSessionId } from '@/lib/messaging/guest-session-id'
import { isSmtpConfigured, sendSmtpMail } from '@/lib/email/smtp'
import {
  getClientIpFromRequest,
  getRateLimitRetryAfterSec,
  isRateLimited,
} from '@/lib/api/simple-ip-rate-limit'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const OTP_TTL_MINUTES = 10
const OTP_RESEND_COOLDOWN_SECONDS = 45
const MAGIC_TTL_MINUTES = 10
const REQUEST_RATE_MAX = Math.max(3, parseInt(process.env.GUEST_AUTH_EMAIL_REQUEST_RATE_LIMIT_MAX || '10', 10) || 10)
const REQUEST_RATE_WINDOW_MS = Math.max(
  10_000,
  parseInt(process.env.GUEST_AUTH_EMAIL_REQUEST_RATE_LIMIT_WINDOW_MS || '600000', 10) || 600_000
)

function normalizeEmail(v: string): string {
  return v.trim().toLowerCase()
}

async function resolvePartner(slug: string) {
  if (isReservedMessagingGuestSlug(slug)) return { error: 'not_found' as const }
  const db = createServiceRoleClient()
  const { data: partner, error } = await db
    .from('messaging_partners')
    .select('id, is_active, display_name')
    .eq('slug', slug)
    .maybeSingle()
  if (error || !partner?.is_active) return { error: 'not_found' as const }
  return { db, partnerId: partner.id, displayName: partner.display_name, slug }
}

function randOtp6() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function sha256(v: string) {
  return crypto.createHash('sha256').update(v).digest('hex')
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const p = await resolvePartner(slug)
  if ('error' in p) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { db, partnerId, displayName } = p

  const body = (await request.json().catch(() => null)) as { email?: string } | null
  const email = normalizeEmail(body?.email ?? '')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  const existingSessionId = readGuestSessionIdFromRequest(request)
  const sessionId =
    existingSessionId && isValidMessagingGuestSessionId(existingSessionId)
      ? existingSessionId
      : createGuestSessionId()

  const ip = getClientIpFromRequest(request)
  const rlKey = `guest-auth-email-request:${partnerId}:${ip}:${email}`
  if (isRateLimited(rlKey, REQUEST_RATE_MAX, REQUEST_RATE_WINDOW_MS)) {
    const retry = getRateLimitRetryAfterSec(rlKey)
    return NextResponse.json(
      { error: 'Too many requests. Try again later.', retry_after_sec: retry },
      { status: 429, headers: { 'Retry-After': String(retry) } }
    )
  }

  const now = new Date()
  const cooldownAfter = new Date(now.getTime() - OTP_RESEND_COOLDOWN_SECONDS * 1000).toISOString()
  const { data: latest } = await db
    .from('messaging_guest_email_challenges')
    .select('id, created_at')
    .eq('partner_id', partnerId)
    .eq('email_normalized', email)
    .gt('created_at', cooldownAfter)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (latest?.id) {
    const response = NextResponse.json({ ok: true, sent: true })
    if (!existingSessionId) writeGuestSessionCookie(response, request, sessionId)
    return response
  }

  const otp = randOtp6()
  const otpHash = sha256(`otp:${partnerId}:${email}:${otp}`)
  const magicRaw = crypto.randomBytes(24).toString('hex')
  const magicHash = sha256(`magic:${partnerId}:${email}:${magicRaw}`)
  const expiresAt = new Date(now.getTime() + OTP_TTL_MINUTES * 60 * 1000).toISOString()

  const { error: insErr } = await db.from('messaging_guest_email_challenges').insert({
    partner_id: partnerId,
    email_normalized: email,
    session_id: sessionId,
    code_hash: otpHash,
    magic_token_hash: magicHash,
    expires_at: expiresAt,
    attempt_count: 0,
  })
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  const magicUrl = `${request.nextUrl.origin}/api/messaging/guest/${encodeURIComponent(slug)}/auth/email/verify-magic?token=${encodeURIComponent(
    magicRaw
  )}&email=${encodeURIComponent(email)}`
  const subject = `Xac thuc chat - ${displayName}`
  const text = [
    `Xin chao,`,
    ``,
    `Bam vao link duoi day de xac thuc email va tiep tuc chat:`,
    `${magicUrl}`,
    ``,
    `Neu khong bam duoc link, nhap ma OTP: ${otp}`,
    `Ma het han sau ${MAGIC_TTL_MINUTES} phut.`,
  ].join('\n')
  if (isSmtpConfigured()) {
    await sendSmtpMail({
      to: email,
      subject,
      text,
      html: `<p>Xin chao,</p><p><a href="${magicUrl}">Bam vao day de xac thuc email va tiep tuc chat</a></p><p>Ma OTP du phong: <b>${otp}</b> (het han sau ${MAGIC_TTL_MINUTES} phut).</p>`,
    })
  }

  const response = NextResponse.json({ ok: true, sent: true })
  if (!existingSessionId) writeGuestSessionCookie(response, request, sessionId)
  return response
}
