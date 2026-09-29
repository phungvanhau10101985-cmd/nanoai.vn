import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'
import { isValidUuidString } from '@/lib/validate-uuid'
import { getOAuthBrowserOrigin, oauthBrowserLocation } from '@/lib/auth/public-app-url'
import { createFacebookOAuthState } from '@/lib/integration/facebook-messenger-oauth'

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
  const path =
    `/dashboard/messaging/settings?partner=${encodeURIComponent(partnerId)}` +
    `&fb_oauth=${encodeURIComponent(status)}&section=channels`
  const location = oauthBrowserLocation(request, path)
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

export async function GET(request: NextRequest) {
  const partnerId = String(request.nextUrl.searchParams.get('partnerId') || '').trim()
  if (!isValidUuidString(partnerId)) {
    return buildSettingsRedirect(request, partnerId || 'unknown', 'invalid-partner')
  }

  const auth = await getUserForAction('Vui long dang nhap.')
  if ('error' in auth) {
    return buildSettingsRedirect(request, partnerId, 'unauthorized')
  }
  const { user } = auth
  const isOwner = await assertPartnerOwner(user.id, partnerId)
  if (!isOwner) {
    return buildSettingsRedirect(request, partnerId, 'forbidden')
  }

  const appId = (process.env.FACEBOOK_MESSENGER_APP_ID || process.env.FACEBOOK_APP_ID || '').trim()
  const stateSecret = oauthStateSecret()
  if (!appId || !stateSecret) {
    return buildSettingsRedirect(request, partnerId, 'missing-config')
  }

  const callbackUrl = new URL('/api/integrations/facebook/messenger/callback', getOAuthBrowserOrigin(request)).toString()
  const state = createFacebookOAuthState({
    partnerId,
    userId: user.id,
    secret: stateSecret,
  })

  const oauthUrl = new URL('https://www.facebook.com/v21.0/dialog/oauth')
  oauthUrl.searchParams.set('client_id', appId)
  oauthUrl.searchParams.set('redirect_uri', callbackUrl)
  oauthUrl.searchParams.set('response_type', 'code')
  oauthUrl.searchParams.set(
    'scope',
    [
      'pages_show_list',
      'pages_manage_metadata',
      'pages_messaging',
      'pages_read_engagement',
      'business_management',
    ].join(',')
  )
  oauthUrl.searchParams.set('auth_type', 'rerequest')
  oauthUrl.searchParams.set('state', state)

  return NextResponse.redirect(oauthUrl.toString())
}

