import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'
import { isValidUuidString } from '@/lib/validate-uuid'
import { listFacebookManagedPages } from '@/lib/integration/facebook-managed-pages'
import { connectFacebookPagesForPartner } from '@/lib/integration/facebook-messenger-connect'
import {
  FACEBOOK_OAUTH_SESSION_COOKIE,
  verifyFacebookOAuthSession,
} from '@/lib/integration/facebook-messenger-oauth'

export const maxDuration = 60

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

function clearSession(res: NextResponse) {
  res.cookies.set(FACEBOOK_OAUTH_SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/',
  })
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

  const body = (await request.json().catch(() => null)) as { partnerId?: string; pageId?: string; pageIds?: string[] } | null
  const partnerId = String(body?.partnerId || '').trim()
  const requested = [
    ...(Array.isArray(body?.pageIds) ? body.pageIds : []),
    ...(body?.pageId ? [body.pageId] : []),
  ]
    .map((id) => String(id || '').trim())
    .filter(Boolean)
  const pageIds = [...new Set(requested)].slice(0, 30)
  if (!isValidUuidString(partnerId) || pageIds.length < 1) {
    return NextResponse.json({ error: 'Invalid input.' }, { status: 400 })
  }

  const isOwner = await assertPartnerOwner(user.id, partnerId)
  if (!isOwner) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const token = request.cookies.get(FACEBOOK_OAUTH_SESSION_COOKIE)?.value || ''
  if (!token) {
    return NextResponse.json({ error: 'Pending pages expired.' }, { status: 410 })
  }

  const verified = verifyFacebookOAuthSession({
    token,
    expectedUserId: user.id,
    expectedPartnerId: partnerId,
    secret: stateSecret,
  })
  if (!verified.ok) {
    return NextResponse.json({ error: 'Pending pages invalid.' }, { status: 410 })
  }

  const available = await listFacebookManagedPages(verified.userAccessToken)
  const selected = available.filter((page) => pageIds.includes(page.id))
  if (selected.length < 1) {
    return NextResponse.json({ error: 'Page not found in pending list.' }, { status: 404 })
  }

  const saved = await connectFacebookPagesForPartner({
    partnerId,
    pages: selected.map((page) => ({ id: page.id, accessToken: page.accessToken })),
  })
  const linked = saved.connected.length + saved.warned.length
  if (linked < 1) {
    return NextResponse.json({ error: saved.failed[0]?.error || 'Could not save Facebook Page.' }, { status: 500 })
  }

  const res = NextResponse.json({
    ok: true,
    status: saved.warned.length > 0 && saved.connected.length === 0 ? 'subscribed-warn' : 'ok',
    connected: saved.connected.length,
    warned: saved.warned.length,
    failed: saved.failed.length,
  })
  if (saved.failed.length === 0) clearSession(res)
  return res
}
