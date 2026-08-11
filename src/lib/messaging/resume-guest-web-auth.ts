import type { NextRequest, NextResponse } from 'next/server'
import { EMAIL_SESSION_COOKIE, EMAIL_SESSION_COOKIE_LEGACY } from '@/lib/auth/email-auth-config'
import { getEmailSessionUser } from '@/lib/auth/email-session-user'
import { createEmailSessionTokenString, getEmailSessionCookieOptions } from '@/lib/auth/email-session-token'
import {
  resolveTrustedDeviceFromRequestWithoutEmail,
  touchTrustedDeviceFromRequest,
} from '@/lib/auth/email-trusted-device'
import {
  findGuestAccountIdByEmailPg,
  insertGuestAccountPg,
  updateGuestAccountLastLoginPg,
  upsertGuestIdentityPg,
} from '@/lib/db/messaging-guest-pg'
import { isPgConfigured } from '@/lib/db/pool'
import type { SignupSource } from '@/lib/auth/signup-source'
import {
  completeGuestEmailAuth,
  mergeAllGuestSessionsForEmail,
} from '@/lib/messaging/complete-guest-email-auth'
import { readGuestAccountIdFromRequest, writeGuestAccountCookie } from '@/lib/messaging/guest-account-session'
import {
  createGuestSessionId,
  mirrorGuestSessionToClient,
  readGuestSessionIdFromRequestStrictOrLoose,
} from '@/lib/messaging/guest-auth-session'
import { isValidMessagingGuestSessionId } from '@/lib/messaging/guest-session-id'
import { upsertGuestAccountForGoogleIdentity } from '@/lib/messaging/guest-widget-identity'

export type ResumeGuestWebAuthSource =
  | 'existing_account'
  | 'platform_session'
  | 'trusted_device'
  | 'none'

export type ResumeGuestWebAuthResult = {
  synced: boolean
  source: ResumeGuestWebAuthSource
  accountId: string | null
  email: string | null
  sessionId: string | null
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

async function signInGuestAccountForEmail(input: {
  request: NextRequest
  response: NextResponse
  partnerId: string
  email: string
  sessionId: string
  existingAccountId?: string | null
  signupSource?: SignupSource
  partnerSlug?: string | null
}): Promise<string | null> {
  const email = normalizeEmail(input.email)
  const nowIso = new Date().toISOString()
  let accountId = input.existingAccountId?.trim() || null

  if (!accountId) {
    accountId = await findGuestAccountIdByEmailPg(input.partnerId, email)
  }
  if (!accountId) {
    accountId = await insertGuestAccountPg({
      partnerId: input.partnerId,
      emailRaw: email,
      emailNormalized: email,
      firstVerifiedAt: nowIso,
      lastLoginAt: nowIso,
    })
  } else {
    await updateGuestAccountLastLoginPg(accountId, nowIso)
  }
  if (!accountId) return null

  const identityOk = await upsertGuestIdentityPg({
    partnerId: input.partnerId,
    guestAccountId: accountId,
    provider: 'email_otp',
    providerSubject: email,
  })
  if (!identityOk) return null

  await mergeAllGuestSessionsForEmail({
    partnerId: input.partnerId,
    email,
    guestAccountId: accountId,
    currentSessionId: input.sessionId,
  })

  const auth = await completeGuestEmailAuth({
    partnerId: input.partnerId,
    email,
    guestAccountId: accountId,
    signupSource: input.signupSource ?? 'partner_website',
    partnerSlug: input.partnerSlug,
  })

  writeGuestAccountCookie(input.response, input.request, accountId)
  mirrorGuestSessionToClient(input.response, input.request, input.sessionId)

  const token =
    auth.sessionToken ||
    (auth.authUserId ? await createEmailSessionTokenString(auth.authUserId, email) : null)
  if (token) {
    const opts = getEmailSessionCookieOptions()
    input.response.cookies.set(EMAIL_SESSION_COOKIE, token, opts)
    input.response.cookies.set(EMAIL_SESSION_COOKIE_LEGACY, token, opts)
  }

  return accountId
}

/**
 * Khôi phục phiên khách trên mọi web (shop, chat, landing) — cùng cơ chế giữ đăng nhập NanoAI:
 * cookie guest account → JWT email → thiết bị tin cậy.
 */
export async function applyResumeGuestWebAuth(input: {
  request: NextRequest
  response: NextResponse
  partnerId: string
  signupSource?: SignupSource
  partnerSlug?: string | null
}): Promise<ResumeGuestWebAuthResult> {
  const signupSource = input.signupSource ?? 'partner_website'
  if (!isPgConfigured()) {
    return { synced: false, source: 'none', accountId: null, email: null, sessionId: null }
  }

  let sessionId = readGuestSessionIdFromRequestStrictOrLoose(input.request) ?? ''
  if (!isValidMessagingGuestSessionId(sessionId)) {
    sessionId = createGuestSessionId()
  }
  mirrorGuestSessionToClient(input.response, input.request, sessionId)

  const existingAccountId = readGuestAccountIdFromRequest(input.request)
  if (existingAccountId) {
    writeGuestAccountCookie(input.response, input.request, existingAccountId)
    await touchTrustedDeviceFromRequest(input.response, input.request)
    return {
      synced: true,
      source: 'existing_account',
      accountId: existingAccountId,
      email: null,
      sessionId,
    }
  }

  const platformUser = await getEmailSessionUser()
  if (platformUser?.email) {
    const accountId = await upsertGuestAccountForGoogleIdentity(
      input.partnerId,
      input.request,
      platformUser
    )
    if (accountId) {
      writeGuestAccountCookie(input.response, input.request, accountId)
      mirrorGuestSessionToClient(input.response, input.request, sessionId)
      await touchTrustedDeviceFromRequest(input.response, input.request)
      return {
        synced: true,
        source: 'platform_session',
        accountId,
        email: normalizeEmail(platformUser.email),
        sessionId,
      }
    }
  }

  const trusted = await resolveTrustedDeviceFromRequestWithoutEmail(input.request)
  if (trusted) {
    const accountId = await signInGuestAccountForEmail({
      request: input.request,
      response: input.response,
      partnerId: input.partnerId,
      email: trusted.email,
      sessionId,
      signupSource,
      partnerSlug: input.partnerSlug,
    })
    if (accountId) {
      await touchTrustedDeviceFromRequest(input.response, input.request)
      return {
        synced: true,
        source: 'trusted_device',
        accountId,
        email: trusted.email,
        sessionId,
      }
    }
  }

  return { synced: false, source: 'none', accountId: null, email: null, sessionId }
}
