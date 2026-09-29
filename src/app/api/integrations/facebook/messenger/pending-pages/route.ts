import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { isValidUuidString } from '@/lib/validate-uuid'
import { listFacebookManagedPages } from '@/lib/integration/facebook-managed-pages'
import {
  FACEBOOK_OAUTH_SESSION_COOKIE,
  verifyFacebookOAuthSession,
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

export async function GET(request: NextRequest) {
  const auth = await getUserForAction('Vui long dang nhap.')
  if ('error' in auth) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }
  const { user } = auth

  const partnerId = String(request.nextUrl.searchParams.get('partnerId') || '').trim()
  if (!isValidUuidString(partnerId)) {
    return NextResponse.json({ error: 'Invalid partner.' }, { status: 400 })
  }

  const stateSecret = oauthStateSecret()
  if (!stateSecret) {
    return NextResponse.json({ error: 'Missing config.' }, { status: 500 })
  }

  const token = request.cookies.get(FACEBOOK_OAUTH_SESSION_COOKIE)?.value || ''
  if (!token) return NextResponse.json({ pages: [] as Array<{ id: string; name: string; pictureUrl: string | null }> })

  const verified = verifyFacebookOAuthSession({
    token,
    expectedUserId: user.id,
    expectedPartnerId: partnerId,
    secret: stateSecret,
  })
  if (!verified.ok) {
    return NextResponse.json({ pages: [] as Array<{ id: string; name: string; pictureUrl: string | null }> })
  }

  const pages = await listFacebookManagedPages(verified.userAccessToken)
  return NextResponse.json({
    pages: pages.map((page) => ({
      id: page.id,
      name: page.name || page.id,
      pictureUrl: page.pictureUrl,
    })),
  })
}
