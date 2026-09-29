import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'
import { isValidUuidString } from '@/lib/validate-uuid'
import { getOAuthBrowserOrigin, oauthBrowserLocation } from '@/lib/auth/public-app-url'
import { exchangeFacebookLongLivedUserToken } from '@/lib/integration/facebook-managed-pages'
import {
  createFacebookOAuthSession,
  FACEBOOK_OAUTH_SESSION_COOKIE,
  verifyFacebookOAuthState,
} from '@/lib/integration/facebook-messenger-oauth'

function oauthStateSecret(): string {
  return (
    process.env.FACEBOOK_OAUTH_STATE_SECRET ||
    process.env.FACEBOOK_MESSENGER_APP_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    ''
  ).trim()
}

function buildSettingsRedirect(request: NextRequest, partnerId: string, status: string): NextResponse {
  const params = new URLSearchParams()
  if (partnerId && isValidUuidString(partnerId)) params.set('partner', partnerId)
  params.set('fb_oauth', status)
  params.set('section', 'channels')
  const location = oauthBrowserLocation(request, `/dashboard/messaging/settings?${params.toString()}`)
  const res = NextResponse.redirect(location.startsWith('/') ? `http://127.0.0.1${location}` : location, 307)
  res.headers.set('Location', location)
  res.headers.set('Cache-Control', 'no-store')
  return res
}

async function assertPartnerOwner(userId: string, partnerId: string): Promise<boolean> {
  if (!isValidUuidString(userId) || !isValidUuidString(partnerId)) return false
  if (!isPgConfigured()) return false
  try {
    const row = await pgQueryOne<{ id: string }>(
      `select id::text
       from public.messaging_partners
       where id = $1::uuid and owner_user_id = $2::uuid
       limit 1`,
      [partnerId, userId]
    )
    return Boolean(row?.id)
  } catch {
    return false
  }
}

async function fetchUserAccessToken(params: {
  appId: string
  appSecret: string
  callbackUrl: string
  code: string
}): Promise<string | null> {
  const url = new URL('https://graph.facebook.com/v21.0/oauth/access_token')
  url.searchParams.set('client_id', params.appId)
  url.searchParams.set('client_secret', params.appSecret)
  url.searchParams.set('redirect_uri', params.callbackUrl)
  url.searchParams.set('code', params.code)
  const res = await fetch(url.toString(), { method: 'GET', cache: 'no-store' })
  const json = (await res.json().catch(() => null)) as { access_token?: string } | null
  if (!res.ok || !json?.access_token) return null
  return String(json.access_token).trim() || null
}

export async function GET(request: NextRequest) {
  const auth = await getUserForAction('Vui long dang nhap.')
  if ('error' in auth) {
    return buildSettingsRedirect(request, '', 'unauthorized')
  }
  const { user } = auth

  const appId = (process.env.FACEBOOK_MESSENGER_APP_ID || process.env.FACEBOOK_APP_ID || '').trim()
  const appSecret = (process.env.FACEBOOK_MESSENGER_APP_SECRET || process.env.FACEBOOK_APP_SECRET || '').trim()
  const stateSecret = oauthStateSecret()
  if (!appId || !appSecret || !stateSecret) {
    return buildSettingsRedirect(request, '', 'missing-config')
  }

  const code = String(request.nextUrl.searchParams.get('code') || '').trim()
  const state = String(request.nextUrl.searchParams.get('state') || '').trim()
  if (!code || !state) {
    return buildSettingsRedirect(request, '', 'missing-code')
  }

  const verified = verifyFacebookOAuthState({
    state,
    expectedUserId: user.id,
    secret: stateSecret,
  })
  if (!verified.ok) {
    return buildSettingsRedirect(request, '', 'invalid-state')
  }
  const partnerId = verified.partnerId
  if (!isValidUuidString(partnerId)) {
    return buildSettingsRedirect(request, '', 'invalid-partner')
  }

  const isOwner = await assertPartnerOwner(user.id, partnerId)
  if (!isOwner) {
    return buildSettingsRedirect(request, partnerId, 'forbidden')
  }

  const callbackUrl = new URL('/api/integrations/facebook/messenger/callback', getOAuthBrowserOrigin(request)).toString()
  const shortLived = await fetchUserAccessToken({
    appId,
    appSecret,
    callbackUrl,
    code,
  })
  if (!shortLived) {
    return buildSettingsRedirect(request, partnerId, 'exchange-failed')
  }

  const userAccessToken = await exchangeFacebookLongLivedUserToken({
    appId,
    appSecret,
    shortLivedToken: shortLived,
  })
  const session = createFacebookOAuthSession({
    partnerId,
    userId: user.id,
    userAccessToken,
    secret: stateSecret,
  })
  const res = buildSettingsRedirect(request, partnerId, 'pick-page')
  res.cookies.set(FACEBOOK_OAUTH_SESSION_COOKIE, session, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 15 * 60,
    path: '/',
  })
  return res
}
