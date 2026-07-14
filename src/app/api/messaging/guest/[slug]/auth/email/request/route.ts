import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { resolveFashionMessagingPartnerBySlug } from '@/lib/messaging/resolve-active-messaging-partner'
import {
  createGuestSessionId,
  readGuestSessionIdFromRequest,
  writeGuestSessionCookie,
  writeGuestSessionHeader,
} from '@/lib/messaging/guest-auth-session'
import { writeGuestAccountCookie } from '@/lib/messaging/guest-account-session'
import { isValidMessagingGuestSessionId } from '@/lib/messaging/guest-session-id'
import { isSmtpConfigured, sendSmtpMail } from '@/lib/email/smtp'
import {
  getClientIpFromRequest,
  getRateLimitRetryAfterSec,
  isRateLimited,
} from '@/lib/api/simple-ip-rate-limit'
import {
  findGuestAccountIdByEmailPg,
  findLatestEmailChallengeInCooldownPg,
  insertGuestAccountPg,
  insertGuestEmailChallengePg,
  updateGuestAccountLastLoginPg,
  upsertGuestIdentityPg,
} from '@/lib/db/messaging-guest-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { EMAIL_SESSION_COOKIE, EMAIL_SESSION_COOKIE_LEGACY } from '@/lib/auth/email-auth-config'
import { createEmailSessionTokenString, getEmailSessionCookieOptions } from '@/lib/auth/email-session-token'
import { issueTrustedDeviceForUser, resolveTrustedDeviceFromRequest } from '@/lib/auth/email-trusted-device'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const OTP_TTL_MINUTES = 10
const OTP_RESEND_COOLDOWN_SECONDS = 45
const REQUEST_RATE_MAX = Math.max(3, parseInt(process.env.GUEST_AUTH_EMAIL_REQUEST_RATE_LIMIT_MAX || '10', 10) || 10)
const REQUEST_RATE_WINDOW_MS = Math.max(
  10_000,
  parseInt(process.env.GUEST_AUTH_EMAIL_REQUEST_RATE_LIMIT_WINDOW_MS || '600000', 10) || 600_000
)

function normalizeEmail(v: string): string {
  return v.trim().toLowerCase()
}

async function resolvePartner(slug: string) {
  const active = await resolveFashionMessagingPartnerBySlug(slug)
  if (!active) return { error: 'not_found' as const }
  return { partnerId: active.id, displayName: active.display_name, slug }
}

function randOtp6() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function sha256(v: string) {
  return createHash('sha256').update(v).digest('hex')
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const p = await resolvePartner(slug)
  if ('error' in p) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { partnerId, displayName } = p

  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Server database is not configured.' }, { status: 503 })
  }

  const body = (await request.json().catch(() => null)) as {
    email?: string
    rememberDevice?: boolean
    browserId?: string
  } | null
  const email = normalizeEmail(body?.email ?? '')
  const rememberDevice = body?.rememberDevice !== false
  const browserId = String(body?.browserId || '').trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  const existingSessionId = readGuestSessionIdFromRequest(request)
  const sessionId =
    existingSessionId && isValidMessagingGuestSessionId(existingSessionId)
      ? existingSessionId
      : createGuestSessionId()

  const trusted = await resolveTrustedDeviceFromRequest(request, email)
  if (trusted) {
    const nowIso = new Date().toISOString()
    let accountId = await findGuestAccountIdByEmailPg(partnerId, email)
    if (!accountId) {
      accountId = await insertGuestAccountPg({
        partnerId,
        emailRaw: email,
        emailNormalized: email,
        firstVerifiedAt: nowIso,
        lastLoginAt: nowIso,
      })
    } else {
      await updateGuestAccountLastLoginPg(accountId, nowIso)
    }
    if (!accountId) {
      return NextResponse.json({ error: 'Account failed' }, { status: 500 })
    }
    const identityOk = await upsertGuestIdentityPg({
      partnerId,
      guestAccountId: accountId,
      provider: 'email_otp',
      providerSubject: email,
    })
    if (!identityOk) {
      return NextResponse.json({ error: 'Account failed' }, { status: 500 })
    }
    const token = await createEmailSessionTokenString(trusted.userId, trusted.email)
    if (!token) {
      return NextResponse.json({ error: 'jwt_config' }, { status: 500 })
    }
    const response = NextResponse.json({
      ok: true,
      autoSignedIn: true,
      accountId,
      emailSessionIssued: true,
    })
    writeGuestAccountCookie(response, request, accountId)
    if (!existingSessionId) {
      writeGuestSessionCookie(response, request, sessionId)
      writeGuestSessionHeader(response, sessionId)
    }
    const opts = getEmailSessionCookieOptions()
    response.cookies.set(EMAIL_SESSION_COOKIE, token, opts)
    response.cookies.set(EMAIL_SESSION_COOKIE_LEGACY, token, opts)
    if (rememberDevice) {
      await issueTrustedDeviceForUser(response, request, trusted.userId, trusted.email, browserId)
    }
    return response
  }

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
  let latestId: string | undefined
  try {
    const latest = await findLatestEmailChallengeInCooldownPg(partnerId, email, cooldownAfter)
    latestId = latest?.id
  } catch (e) {
    console.warn('[guest-auth-email-request] cooldown PG failed', e)
    return NextResponse.json({ error: 'Database error.' }, { status: 500 })
  }
  if (latestId) {
    const response = NextResponse.json({ ok: true, sent: true })
    if (!existingSessionId) {
      writeGuestSessionCookie(response, request, sessionId)
      writeGuestSessionHeader(response, sessionId)
    }
    return response
  }

  const otp = randOtp6()
  const otpHash = sha256(`otp:${partnerId}:${email}:${otp}`)
  const expiresAt = new Date(now.getTime() + OTP_TTL_MINUTES * 60 * 1000).toISOString()

  const inserted = await insertGuestEmailChallengePg({
    partnerId,
    emailNormalized: email,
    sessionId,
    codeHash: otpHash,
    magicTokenHash: '',
    expiresAt,
  })
  if (!inserted) {
    return NextResponse.json({ error: 'Could not create verification challenge.' }, { status: 500 })
  }

  const subject = `Xac thuc chat - ${displayName}`
  const text = [
    `Xin chao,`,
    ``,
    `Ma OTP cua ban: ${otp}`,
    `Vui long nhap ma nay ngay trong khung chat de tiep tuc.`,
    `Ma het han sau ${OTP_TTL_MINUTES} phut.`,
  ].join('\n')
  if (isSmtpConfigured()) {
    await sendSmtpMail({
      to: email,
      subject,
      text,
      html: `<p>Xin chao,</p><p>Ma OTP cua ban: <b>${otp}</b></p><p>Vui long nhap ma nay ngay trong khung chat de tiep tuc.</p><p>Ma het han sau ${OTP_TTL_MINUTES} phut.</p>`,
    })
  }

  const response = NextResponse.json({ ok: true, sent: true })
  if (!existingSessionId) {
    writeGuestSessionCookie(response, request, sessionId)
    writeGuestSessionHeader(response, sessionId)
  }
  return response
}
