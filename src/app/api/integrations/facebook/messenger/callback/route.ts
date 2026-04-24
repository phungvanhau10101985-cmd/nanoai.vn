import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getUserForAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'
import { isValidUuidString } from '@/lib/validate-uuid'
import {
  createFacebookPendingPagesToken,
  verifyFacebookOAuthState,
} from '@/lib/integration/facebook-messenger-oauth'
import {
  fetchPartnerChannelStatusRowsFromPg,
  upsertFacebookMessengerChannelPg,
} from '@/lib/db/messaging-partner-channels-pg'

type FacebookPageAccount = {
  id?: string
  name?: string
  access_token?: string
}
const FACEBOOK_PENDING_PAGES_COOKIE = 'fb_messenger_pending_pages'

function oauthStateSecret(): string {
  return (
    process.env.FACEBOOK_OAUTH_STATE_SECRET ||
    process.env.FACEBOOK_MESSENGER_APP_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    ''
  ).trim()
}

function buildSettingsRedirect(request: NextRequest, partnerId: string, status: string): string {
  const url = new URL('/dashboard/messaging/settings', request.nextUrl.origin)
  if (partnerId && isValidUuidString(partnerId)) {
    url.searchParams.set('partner', partnerId)
  }
  url.searchParams.set('fb_oauth', status)
  return url.toString()
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

async function fetchManagedPages(userAccessToken: string): Promise<FacebookPageAccount[]> {
  const url = new URL('https://graph.facebook.com/v21.0/me/accounts')
  url.searchParams.set('fields', 'id,name,access_token')
  url.searchParams.set('limit', '200')
  url.searchParams.set('access_token', userAccessToken)
  const res = await fetch(url.toString(), { method: 'GET', cache: 'no-store' })
  const json = (await res.json().catch(() => null)) as { data?: FacebookPageAccount[] } | null
  if (!res.ok || !Array.isArray(json?.data)) return []
  return json.data
}

async function subscribePageToApp(pageId: string, pageAccessToken: string): Promise<boolean> {
  const url = new URL(`https://graph.facebook.com/v21.0/${encodeURIComponent(pageId)}/subscribed_apps`)
  url.searchParams.set('subscribed_fields', 'messages,messaging_postbacks,message_reads,message_deliveries')
  url.searchParams.set('access_token', pageAccessToken)
  const res = await fetch(url.toString(), { method: 'POST', cache: 'no-store' })
  return res.ok
}

function revalidateMessagingDashboard() {
  revalidatePath('/dashboard/messaging')
  revalidatePath('/dashboard/messaging/settings')
  revalidatePath('/dashboard/messaging/orders')
  revalidatePath('/dashboard/api-integration')
}

async function saveFacebookChannel(params: {
  partnerId: string
  pageId: string
  pageAccessToken: string
}): Promise<'ok' | 'subscribed-warn' | 'save-failed'> {
  const existing = await fetchPartnerChannelStatusRowsFromPg(params.partnerId)
  const existingVerifyToken = existing?.facebook?.webhook_verify_token?.trim() || ''
  const verifyToken = existingVerifyToken || `fbv_${randomBytes(12).toString('hex')}`
  const upsert = await upsertFacebookMessengerChannelPg({
    partnerId: params.partnerId,
    facebookPageId: params.pageId,
    pageAccessToken: params.pageAccessToken,
    webhookVerifyToken: verifyToken,
  })
  if ('error' in upsert) return 'save-failed'
  const subscribed = await subscribePageToApp(params.pageId, params.pageAccessToken)
  revalidateMessagingDashboard()
  return subscribed ? 'ok' : 'subscribed-warn'
}

export async function GET(request: NextRequest) {
  const auth = await getUserForAction('Vui long dang nhap.')
  if ('error' in auth) {
    return NextResponse.redirect(buildSettingsRedirect(request, '', 'unauthorized'))
  }
  const { user } = auth

  const appId = (process.env.FACEBOOK_MESSENGER_APP_ID || process.env.FACEBOOK_APP_ID || '').trim()
  const appSecret = (process.env.FACEBOOK_MESSENGER_APP_SECRET || process.env.FACEBOOK_APP_SECRET || '').trim()
  const stateSecret = oauthStateSecret()
  if (!appId || !appSecret || !stateSecret) {
    return NextResponse.redirect(buildSettingsRedirect(request, '', 'missing-config'))
  }

  const code = String(request.nextUrl.searchParams.get('code') || '').trim()
  const state = String(request.nextUrl.searchParams.get('state') || '').trim()
  if (!code || !state) {
    return NextResponse.redirect(buildSettingsRedirect(request, '', 'missing-code'))
  }

  const verified = verifyFacebookOAuthState({
    state,
    expectedUserId: user.id,
    secret: stateSecret,
  })
  if (!verified.ok) {
    return NextResponse.redirect(buildSettingsRedirect(request, '', 'invalid-state'))
  }
  const partnerId = verified.partnerId
  if (!isValidUuidString(partnerId)) {
    return NextResponse.redirect(buildSettingsRedirect(request, '', 'invalid-partner'))
  }

  const isOwner = await assertPartnerOwner(user.id, partnerId)
  if (!isOwner) {
    return NextResponse.redirect(buildSettingsRedirect(request, partnerId, 'forbidden'))
  }

  const callbackUrl = new URL('/api/integrations/facebook/messenger/callback', request.nextUrl.origin).toString()
  const userAccessToken = await fetchUserAccessToken({
    appId,
    appSecret,
    callbackUrl,
    code,
  })
  if (!userAccessToken) {
    return NextResponse.redirect(buildSettingsRedirect(request, partnerId, 'exchange-failed'))
  }

  const pages = await fetchManagedPages(userAccessToken)
  if (pages.length < 1) {
    return NextResponse.redirect(buildSettingsRedirect(request, partnerId, 'no-page-access'))
  }

  const availablePages = pages
    .map((it) => ({
      id: String(it.id || '').trim(),
      name: String(it.name || '').trim(),
      accessToken: String(it.access_token || '').trim(),
    }))
    .filter((it) => it.id && it.accessToken)

  if (availablePages.length < 1) {
    return NextResponse.redirect(buildSettingsRedirect(request, partnerId, 'no-page-access'))
  }

  if (availablePages.length > 1) {
    const pendingToken = createFacebookPendingPagesToken({
      partnerId,
      userId: user.id,
      pages: availablePages,
      secret: stateSecret,
    })
    const res = NextResponse.redirect(buildSettingsRedirect(request, partnerId, 'pick-page'))
    res.cookies.set(FACEBOOK_PENDING_PAGES_COOKIE, pendingToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 10 * 60,
      path: '/',
    })
    return res
  }

  const onlyPage = availablePages[0]
  const status = await saveFacebookChannel({
    partnerId,
    pageId: onlyPage.id,
    pageAccessToken: onlyPage.accessToken,
  })
  return NextResponse.redirect(buildSettingsRedirect(request, partnerId, status))
}

