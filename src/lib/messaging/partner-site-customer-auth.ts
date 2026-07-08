import crypto from 'node:crypto'
import type { NextRequest } from 'next/server'
import { EMAIL_SESSION_COOKIE, EMAIL_SESSION_COOKIE_LEGACY } from '@/lib/auth/email-auth-config'
import { resolveCanonicalUserIdByEmail } from '@/lib/auth/resolve-canonical-email-user'
import {
  createEmailSessionTokenString,
  getEmailSessionCookieOptions,
} from '@/lib/auth/email-session-token'
import type { NextResponse } from 'next/server'
import {
  findGuestAccountIdByEmailPg,
  insertGuestAccountPg,
  listGuestChallengeSessionIdsByEmailPg,
  updateGuestAccountLastLoginPg,
  upsertGuestIdentityPg,
} from '@/lib/db/messaging-guest-pg'
import { upsertPartnerCustomerProfileByEmailFromPg } from '@/lib/db/messaging-partner-customer-profiles-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { mergeGuestSessionConversationToAccount } from '@/lib/messaging/guest-account-merge'
import { writeGuestAccountCookie } from '@/lib/messaging/guest-account-session'
import { readGuestSessionIdFromRequestStrictOrLoose } from '@/lib/messaging/guest-auth-session'
import { syncGuestConversationCustomerNamesForAccountPg } from '@/lib/db/customer-care-pg'
import { PARTNER_SITE_CUSTOMER_TOKEN_MAX_TTL_SEC } from '@/lib/messaging/partner-site-customer-auth-constants'

export {
  PARTNER_SITE_CUSTOMER_TOKEN_MAX_TTL_SEC,
  PARTNER_SITE_CUSTOMER_TOKEN_QUERY_KEY,
} from '@/lib/messaging/partner-site-customer-auth-constants'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type PartnerSiteCustomerTokenPayload = {
  email: string
  name?: string
  phone?: string
  exp: number
  sig: string
}

export function normalizePartnerSiteCustomerEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

function signPartnerSiteCustomerPayload(emailNormalized: string, exp: number, embedKey: string): string {
  return crypto.createHmac('sha256', embedKey).update(`${emailNormalized}|${exp}`).digest('hex')
}

/** Ký token trên server shop (dùng embed_key của workspace — không đặt trong JS công khai). */
export function buildPartnerSiteCustomerToken(input: {
  embedKey: string
  email: string
  name?: string
  phone?: string
  /** Unix giây; mặc định now + 5 phút. */
  exp?: number
}): string {
  const embedKey = input.embedKey.trim()
  const emailNormalized = normalizePartnerSiteCustomerEmail(input.email)
  if (!EMAIL_RE.test(emailNormalized)) {
    throw new Error('Invalid email')
  }
  const nowSec = Math.floor(Date.now() / 1000)
  const exp = input.exp ?? nowSec + 300
  const sig = signPartnerSiteCustomerPayload(emailNormalized, exp, embedKey)
  const payload: PartnerSiteCustomerTokenPayload = {
    email: emailNormalized,
    exp,
    sig,
  }
  const name = String(input.name ?? '').trim().slice(0, 180)
  const phone = String(input.phone ?? '').trim().slice(0, 40)
  if (name) payload.name = name
  if (phone) payload.phone = phone
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

export function parsePartnerSiteCustomerToken(raw: string): PartnerSiteCustomerTokenPayload | null {
  const t = raw.trim()
  if (!t) return null
  try {
    const json = Buffer.from(t, 'base64url').toString('utf8')
    const o = JSON.parse(json) as Partial<PartnerSiteCustomerTokenPayload>
    const email = normalizePartnerSiteCustomerEmail(String(o.email ?? ''))
    const exp = Number(o.exp)
    const sig = String(o.sig ?? '').trim().toLowerCase()
    if (!EMAIL_RE.test(email) || !Number.isFinite(exp) || !/^[0-9a-f]{64}$/.test(sig)) return null
    return {
      email,
      exp: Math.floor(exp),
      sig,
      ...(String(o.name ?? '').trim() ? { name: String(o.name).trim().slice(0, 180) } : {}),
      ...(String(o.phone ?? '').trim() ? { phone: String(o.phone).trim().slice(0, 40) } : {}),
    }
  } catch {
    return null
  }
}

export function verifyPartnerSiteCustomerToken(
  embedKey: string,
  tokenRaw: string
): { ok: true; payload: PartnerSiteCustomerTokenPayload } | { ok: false; error: string } {
  const key = embedKey.trim()
  if (!key) return { ok: false, error: 'INVALID_TOKEN' }
  const payload = parsePartnerSiteCustomerToken(tokenRaw)
  if (!payload) return { ok: false, error: 'INVALID_TOKEN' }
  const nowSec = Math.floor(Date.now() / 1000)
  if (payload.exp < nowSec) return { ok: false, error: 'TOKEN_EXPIRED' }
  if (payload.exp - nowSec > PARTNER_SITE_CUSTOMER_TOKEN_MAX_TTL_SEC) {
    return { ok: false, error: 'INVALID_TOKEN' }
  }
  const expected = signPartnerSiteCustomerPayload(payload.email, payload.exp, key)
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(payload.sig, 'utf8')
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, error: 'INVALID_TOKEN' }
  }
  return { ok: true, payload }
}

export type PartnerSiteCustomerAuthResult =
  | {
      ok: true
      accountId: string
      email: string
      emailSessionIssued: boolean
      sessionToken: string | null
    }
  | { ok: false; status: number; error: string }

export async function authenticatePartnerSiteCustomer(params: {
  partnerId: string
  embedKey: string
  request: NextRequest
  tokenRaw: string
}): Promise<PartnerSiteCustomerAuthResult> {
  if (!isPgConfigured()) {
    return { ok: false, status: 503, error: 'Server database is not configured.' }
  }

  const verified = verifyPartnerSiteCustomerToken(params.embedKey, params.tokenRaw)
  if (!verified.ok) {
    return { ok: false, status: 401, error: verified.error }
  }
  const { email, name, phone } = verified.payload
  const partnerId = params.partnerId
  const sessionId = readGuestSessionIdFromRequestStrictOrLoose(params.request)
  const nowIso = new Date().toISOString()

  let accountId: string | null = null
  try {
    accountId = await findGuestAccountIdByEmailPg(partnerId, email)
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
      return { ok: false, status: 500, error: 'Account failed' }
    }
    const identityOk = await upsertGuestIdentityPg({
      partnerId,
      guestAccountId: accountId,
      provider: 'partner_site',
      providerSubject: email,
    })
    if (!identityOk) {
      return { ok: false, status: 500, error: 'Account failed' }
    }
  } catch (e) {
    console.warn('[partner-site-customer-auth] account PG failed', e)
    return { ok: false, status: 500, error: 'Account failed' }
  }

  if (name || phone) {
    await upsertPartnerCustomerProfileByEmailFromPg({
      partnerId,
      emailNormalized: email,
      emailRaw: email,
      customerName: name ?? '',
      customerPhone: phone ?? '',
      shippingAddress: '',
    })
  }

  if (sessionId) {
    await mergeGuestSessionConversationToAccount(partnerId, sessionId, accountId)
  }
  try {
    const allSessionIds = await listGuestChallengeSessionIdsByEmailPg(partnerId, email, 300)
    for (const sid of allSessionIds) {
      if (!sid || sid === accountId) continue
      await mergeGuestSessionConversationToAccount(partnerId, sid, accountId)
    }
  } catch (e) {
    console.warn('[partner-site-customer-auth] email session merge skipped', e)
  }

  let authUserIdForEmail: string | null = await resolveCanonicalUserIdByEmail(email)
  if (authUserIdForEmail && authUserIdForEmail !== accountId) {
    await mergeGuestSessionConversationToAccount(partnerId, authUserIdForEmail, accountId)
  }

  await syncGuestConversationCustomerNamesForAccountPg({
    partnerId,
    guestAccountId: accountId,
    customerNameHint: name ?? null,
  })

  let sessionToken: string | null = null
  let emailSessionIssued = false
  if (authUserIdForEmail) {
    try {
      sessionToken = await createEmailSessionTokenString(authUserIdForEmail, email)
      if (sessionToken) emailSessionIssued = true
    } catch (e) {
      console.warn('[partner-site-customer-auth] email JWT not issued', e)
    }
  }

  return {
    ok: true,
    accountId,
    email,
    emailSessionIssued,
    sessionToken,
  }
}

export function applyPartnerSiteCustomerAuthCookies(
  response: NextResponse,
  request: NextRequest,
  result: Extract<PartnerSiteCustomerAuthResult, { ok: true }>
): void {
  writeGuestAccountCookie(response, request, result.accountId)
  if (result.sessionToken) {
    const opts = getEmailSessionCookieOptions()
    response.cookies.set(EMAIL_SESSION_COOKIE, result.sessionToken, opts)
    response.cookies.set(EMAIL_SESSION_COOKIE_LEGACY, result.sessionToken, opts)
  }
}
