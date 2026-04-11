import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { resolveActiveMessagingPartnerBySlug } from '@/lib/messaging/resolve-active-messaging-partner'
import { readGuestSessionIdFromRequest } from '@/lib/messaging/guest-auth-session'
import { writeGuestAccountCookie } from '@/lib/messaging/guest-account-session'
import { mergeGuestSessionConversationToAccount } from '@/lib/messaging/guest-account-merge'
import {
  getClientIpFromRequest,
  getRateLimitRetryAfterSec,
  isRateLimited,
} from '@/lib/api/simple-ip-rate-limit'
import {
  consumeEmailChallengePg,
  findActiveOtpChallengePg,
  findGuestAccountIdByEmailPg,
  incrementOtpChallengeAttemptsPg,
  insertGuestAccountPg,
  listGuestChallengeSessionIdsByEmailPg,
  updateGuestAccountLastLoginPg,
  upsertGuestIdentityPg,
} from '@/lib/db/messaging-guest-pg'
import { pgQuery } from '@/lib/db/pg-query'
import { isPgConfigured } from '@/lib/db/pool'
import { EMAIL_SESSION_COOKIE, EMAIL_SESSION_COOKIE_LEGACY } from '@/lib/auth/email-auth-config'
import { createEmailSessionTokenString, getEmailSessionCookieOptions } from '@/lib/auth/email-session-token'

export const dynamic = 'force-dynamic'
export const maxDuration = 60
const VERIFY_RATE_MAX = Math.max(5, parseInt(process.env.GUEST_AUTH_EMAIL_VERIFY_RATE_LIMIT_MAX || '20', 10) || 20)
const VERIFY_RATE_WINDOW_MS = Math.max(
  10_000,
  parseInt(process.env.GUEST_AUTH_EMAIL_VERIFY_RATE_LIMIT_WINDOW_MS || '600000', 10) || 600_000
)

function normalizeEmail(v: string): string {
  return v.trim().toLowerCase()
}
function sha256(v: string) {
  return crypto.createHash('sha256').update(v).digest('hex')
}

async function resolvePartner(slug: string) {
  const active = await resolveActiveMessagingPartnerBySlug(slug)
  if (!active) return { error: 'not_found' as const }
  return { partnerId: active.id }
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const p = await resolvePartner(slug)
  if ('error' in p) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { partnerId } = p

  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Server database is not configured.' }, { status: 503 })
  }

  const sessionId = readGuestSessionIdFromRequest(request)
  if (!sessionId) return NextResponse.json({ error: 'Missing session' }, { status: 400 })

  const body = (await request.json().catch(() => null)) as { email?: string; otp?: string } | null
  const email = normalizeEmail(body?.email ?? '')
  const otp = String(body?.otp ?? '').trim()
  if (!email || !otp) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })

  const ip = getClientIpFromRequest(request)
  const rlKey = `guest-auth-email-verify-otp:${partnerId}:${ip}:${email}`
  if (isRateLimited(rlKey, VERIFY_RATE_MAX, VERIFY_RATE_WINDOW_MS)) {
    const retry = getRateLimitRetryAfterSec(rlKey)
    return NextResponse.json(
      { error: 'Too many requests. Try again later.', retry_after_sec: retry },
      { status: 429, headers: { 'Retry-After': String(retry) } }
    )
  }

  const nowIso = new Date().toISOString()

  let challenge: {
    id: string
    code_hash: string
    expires_at: string
    attempt_count: number
    consumed_at: string | null
  } | null = null
  try {
    challenge = await findActiveOtpChallengePg(partnerId, email, sessionId)
  } catch (e) {
    console.warn('[verify-otp] challenge PG failed', e)
    return NextResponse.json({ error: 'Database error.' }, { status: 500 })
  }
  if (!challenge?.id) return NextResponse.json({ error: 'OTP_INVALID' }, { status: 400 })
  if (challenge.expires_at < nowIso) return NextResponse.json({ error: 'OTP_INVALID' }, { status: 400 })
  if ((challenge.attempt_count ?? 0) >= 5) return NextResponse.json({ error: 'OTP_INVALID' }, { status: 400 })

  const hash = sha256(`otp:${partnerId}:${email}:${otp}`)
  if (hash !== challenge.code_hash) {
    const next = (challenge.attempt_count ?? 0) + 1
    await incrementOtpChallengeAttemptsPg(challenge.id, next)
    return NextResponse.json({ error: 'OTP_INVALID' }, { status: 400 })
  }

  const consumed = await consumeEmailChallengePg(challenge.id, nowIso)
  if (!consumed) {
    return NextResponse.json({ error: 'Could not verify OTP.' }, { status: 500 })
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
        return NextResponse.json({ error: 'Account failed' }, { status: 500 })
      }
      accountId = id
    }
  } catch (e) {
    console.warn('[verify-otp] account PG failed', e)
    return NextResponse.json({ error: 'Account failed' }, { status: 500 })
  }
  if (!accountId) return NextResponse.json({ error: 'Account failed' }, { status: 500 })

  await mergeGuestSessionConversationToAccount(partnerId, sessionId, accountId)
  // Deterministic merge by email: merge all known guest sessions for this email into one account thread.
  try {
    const allSessionIds = await listGuestChallengeSessionIdsByEmailPg(partnerId, email, 300)
    for (const sid of allSessionIds) {
      if (!sid || sid === accountId) continue
      await mergeGuestSessionConversationToAccount(partnerId, sid, accountId)
    }
  } catch (e) {
    console.warn('[verify-otp] email session merge skipped', e)
  }
  // Backward compatibility: merge legacy threads created with auth user id(s) for this email.
  let authUserIdForEmail: string | null = null
  try {
    const legacy = await pgQuery<{ id: string }>(
      `select id::text as id
       from auth.users
       where lower(coalesce(email, '')) = $1`,
      [email]
    )
    for (const row of legacy) {
      const legacyThreadId = String(row.id || '').trim()
      if (!legacyThreadId || legacyThreadId === accountId) continue
      await mergeGuestSessionConversationToAccount(partnerId, legacyThreadId, accountId)
      if (!authUserIdForEmail) authUserIdForEmail = legacyThreadId
    }
  } catch (e) {
    console.warn('[verify-otp] legacy auth user merge skipped', e)
  }
  if (!authUserIdForEmail) {
    try {
      const firstAuthUser = await pgQuery<{ id: string }>(
        `select id::text as id
         from auth.users
         where lower(coalesce(email, '')) = $1
         order by created_at asc
         limit 1`,
        [email]
      )
      authUserIdForEmail = String(firstAuthUser[0]?.id || '').trim() || null
    } catch {}
  }
  if (!authUserIdForEmail) {
    try {
      const ensured = await pgQuery<{ id: string }>(
        `select (public.nanoai_ensure_user_by_email($1::text))::text as id`,
        [email]
      )
      authUserIdForEmail = String(ensured[0]?.id || '').trim() || null
    } catch {}
  }

  const res = NextResponse.json({ ok: true, accountId })
  writeGuestAccountCookie(res, request, accountId)
  if (authUserIdForEmail) {
    try {
      const token = await createEmailSessionTokenString(authUserIdForEmail, email)
      if (token) {
        const opts = getEmailSessionCookieOptions()
        res.cookies.set(EMAIL_SESSION_COOKIE, token, opts)
        res.cookies.set(EMAIL_SESSION_COOKIE_LEGACY, token, opts)
      }
    } catch (e) {
      console.warn('[verify-otp] setEmailSessionCookie skipped', e)
    }
  }
  return res
}
