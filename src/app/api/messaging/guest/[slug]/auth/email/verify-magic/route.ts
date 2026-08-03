import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { resolveFashionMessagingPartnerBySlug } from '@/lib/messaging/resolve-active-messaging-partner'
import { readGuestSessionIdFromRequest } from '@/lib/messaging/guest-auth-session'
import { writeGuestAccountCookie } from '@/lib/messaging/guest-account-session'
import { isValidMessagingGuestSessionId, LOOSE_RFC4122_UUID_STRING_RE } from '@/lib/messaging/guest-session-id'
import {
  getClientIpFromRequest,
  getRateLimitRetryAfterSec,
  isRateLimited,
} from '@/lib/api/simple-ip-rate-limit'
import {
  consumeEmailChallengePg,
  findGuestAccountIdByEmailPg,
  findMagicLinkChallengePg,
  insertGuestAccountPg,
  updateGuestAccountLastLoginPg,
  upsertGuestIdentityPg,
} from '@/lib/db/messaging-guest-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { EMAIL_SESSION_COOKIE, EMAIL_SESSION_COOKIE_LEGACY } from '@/lib/auth/email-auth-config'
import { getEmailSessionCookieOptions } from '@/lib/auth/email-session-token'
import { issueTrustedDeviceForUser } from '@/lib/auth/email-trusted-device'
import {
  completeGuestEmailAuth,
  mergeAllGuestSessionsForEmail,
} from '@/lib/messaging/complete-guest-email-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60
const VERIFY_RATE_MAX = Math.max(5, parseInt(process.env.GUEST_AUTH_EMAIL_VERIFY_RATE_LIMIT_MAX || '20', 10) || 20)
const VERIFY_RATE_WINDOW_MS = Math.max(
  10_000,
  parseInt(process.env.GUEST_AUTH_EMAIL_VERIFY_RATE_LIMIT_WINDOW_MS || '600000', 10) || 600_000
)

function sha256(v: string) {
  return crypto.createHash('sha256').update(v).digest('hex')
}

async function resolvePartner(slug: string) {
  const active = await resolveFashionMessagingPartnerBySlug(slug)
  if (!active) return { error: 'not_found' as const }
  return { partnerId: active.id }
}

function resolvePublicOrigin(request: NextRequest): string {
  const envOrigin =
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
    ''
  if (envOrigin) return envOrigin.replace(/\/$/, '')

  const xfProto = request.headers.get('x-forwarded-proto')?.trim()
  const xfHost = request.headers.get('x-forwarded-host')?.trim()
  if (xfHost) return `${xfProto || 'https'}://${xfHost}`.replace(/\/$/, '')
  return request.nextUrl.origin.replace(/\/$/, '')
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const publicOrigin = resolvePublicOrigin(request)
  const guestChatUrl = `${publicOrigin}/messaging/p/${encodeURIComponent(slug)}`
  const p = await resolvePartner(slug)
  if ('error' in p) return NextResponse.redirect(new URL(`${guestChatUrl}?auth=failed`))
  const { partnerId } = p

  if (!isPgConfigured()) {
    return NextResponse.redirect(new URL(`${guestChatUrl}?auth=failed`))
  }

  const email = String(request.nextUrl.searchParams.get('email') ?? '').trim().toLowerCase()
  const token = String(request.nextUrl.searchParams.get('token') ?? '').trim()
  const sessionIdFromCookieOrHeader = readGuestSessionIdFromRequest(request)
  const sidQuery = String(request.nextUrl.searchParams.get('sid') ?? '').trim()
  const sessionIdFromQuery =
    sidQuery && (isValidMessagingGuestSessionId(sidQuery) || LOOSE_RFC4122_UUID_STRING_RE.test(sidQuery))
      ? sidQuery
      : null
  const sessionId = sessionIdFromCookieOrHeader || sessionIdFromQuery
  if (!email || !token || !sessionId) {
    return NextResponse.redirect(new URL(`${guestChatUrl}?auth=failed`))
  }

  const ip = getClientIpFromRequest(request)
  const rlKey = `guest-auth-email-verify-magic:${partnerId}:${ip}:${email}`
  if (isRateLimited(rlKey, VERIFY_RATE_MAX, VERIFY_RATE_WINDOW_MS)) {
    const retry = getRateLimitRetryAfterSec(rlKey)
    return NextResponse.json(
      { error: 'Too many requests. Try again later.', retry_after_sec: retry },
      { status: 429, headers: { 'Retry-After': String(retry) } }
    )
  }

  const hash = sha256(`magic:${partnerId}:${email}:${token}`)
  const nowIso = new Date().toISOString()

  let row: { id: string; expires_at: string; consumed_at: string | null } | null = null
  try {
    row = await findMagicLinkChallengePg(partnerId, email, sessionId, hash)
  } catch (e) {
    console.warn('[verify-magic] PG challenge failed', e)
    return NextResponse.redirect(new URL(`${guestChatUrl}?auth=failed`))
  }
  if (!row?.id || row.expires_at < nowIso) {
    return NextResponse.redirect(new URL(`${guestChatUrl}?auth=failed`))
  }

  const consumed = await consumeEmailChallengePg(row.id, nowIso)
  if (!consumed) {
    return NextResponse.redirect(new URL(`${guestChatUrl}?auth=failed`))
  }

  let accountId: string | undefined
  try {
    let id: string | null = await findGuestAccountIdByEmailPg(partnerId, email)
    if (!id) {
      id = await insertGuestAccountPg({
        partnerId,
        emailRaw: email,
        emailNormalized: email,
        firstVerifiedAt: nowIso,
        lastLoginAt: nowIso,
      })
    } else {
      await updateGuestAccountLastLoginPg(id, nowIso)
    }
    if (id) {
      const identityOk = await upsertGuestIdentityPg({
        partnerId,
        guestAccountId: id,
        provider: 'email_otp',
        providerSubject: email,
      })
      if (!identityOk) {
        return NextResponse.redirect(new URL(`${guestChatUrl}?auth=failed`))
      }
      accountId = id
    }
  } catch (e) {
    console.warn('[verify-magic] account PG failed', e)
    return NextResponse.redirect(new URL(`${guestChatUrl}?auth=failed`))
  }
  if (!accountId) {
    return NextResponse.redirect(new URL(`${guestChatUrl}?auth=failed`))
  }

  await mergeAllGuestSessionsForEmail({
    partnerId,
    email,
    guestAccountId: accountId,
    currentSessionId: sessionId,
  })

  const { authUserId: authUserIdForEmail, sessionToken } = await completeGuestEmailAuth({
    partnerId,
    email,
    guestAccountId: accountId,
  })

  const redirectUrl = new URL(`${guestChatUrl}?auth=ok`)
  const res = NextResponse.redirect(redirectUrl)
  writeGuestAccountCookie(res, request, accountId)
  if (sessionToken && authUserIdForEmail) {
    const opts = getEmailSessionCookieOptions()
    res.cookies.set(EMAIL_SESSION_COOKIE, sessionToken, opts)
    res.cookies.set(EMAIL_SESSION_COOKIE_LEGACY, sessionToken, opts)
    await issueTrustedDeviceForUser(res, request, authUserIdForEmail, email)
  }
  return res
}
