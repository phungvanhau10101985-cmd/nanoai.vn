import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getUserForAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'
import { isValidUuidString } from '@/lib/validate-uuid'
import { verifyFacebookPendingPagesToken } from '@/lib/integration/facebook-messenger-oauth'
import {
  fetchPartnerChannelStatusRowsFromPg,
  upsertFacebookMessengerChannelPg,
} from '@/lib/db/messaging-partner-channels-pg'

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

export async function POST(request: NextRequest) {
  const auth = await getUserForAction('Vui long dang nhap.')
  if ('error' in auth) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }
  const { user } = auth

  const stateSecret = oauthStateSecret()
  if (!stateSecret) {
    return NextResponse.json({ error: 'Missing config.' }, { status: 500 })
  }

  const body = (await request.json().catch(() => null)) as { partnerId?: string; pageId?: string } | null
  const partnerId = String(body?.partnerId || '').trim()
  const pageId = String(body?.pageId || '').trim()
  if (!isValidUuidString(partnerId) || !pageId) {
    return NextResponse.json({ error: 'Invalid input.' }, { status: 400 })
  }

  const isOwner = await assertPartnerOwner(user.id, partnerId)
  if (!isOwner) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const token = request.cookies.get(FACEBOOK_PENDING_PAGES_COOKIE)?.value || ''
  if (!token) {
    return NextResponse.json({ error: 'Pending pages expired.' }, { status: 410 })
  }

  const verified = verifyFacebookPendingPagesToken({
    token,
    expectedUserId: user.id,
    expectedPartnerId: partnerId,
    secret: stateSecret,
  })
  if (!verified.ok) {
    return NextResponse.json({ error: 'Pending pages invalid.' }, { status: 410 })
  }

  const selected = verified.pages.find((p) => p.id === pageId) || null
  if (!selected || !selected.accessToken) {
    return NextResponse.json({ error: 'Page not found in pending list.' }, { status: 404 })
  }

  const existing = await fetchPartnerChannelStatusRowsFromPg(partnerId)
  const existingVerifyToken = existing?.facebook?.webhook_verify_token?.trim() || ''
  const verifyToken = existingVerifyToken || `fbv_${randomBytes(12).toString('hex')}`
  const upsert = await upsertFacebookMessengerChannelPg({
    partnerId,
    facebookPageId: selected.id,
    pageAccessToken: selected.accessToken,
    webhookVerifyToken: verifyToken,
  })
  if ('error' in upsert) {
    return NextResponse.json({ error: upsert.error }, { status: 500 })
  }
  const subscribed = await subscribePageToApp(selected.id, selected.accessToken)
  revalidateMessagingDashboard()

  const res = NextResponse.json({ ok: true, status: subscribed ? 'ok' : 'subscribed-warn' })
  res.cookies.set(FACEBOOK_PENDING_PAGES_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/',
  })
  return res
}

