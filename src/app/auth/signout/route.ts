import { NextResponse } from 'next/server'
import { clearEmailSessionCookie } from '@/lib/auth/email-session-token'
import { getPublicAppUrlForServer } from '@/lib/auth/public-app-url'
import {
  MESSAGING_GUEST_ACCOUNT_COOKIE,
  MESSAGING_GUEST_ACCOUNT_COOKIE_LEGACY,
  MESSAGING_GUEST_ACCOUNT_SYNC_COOKIE,
} from '@/lib/messaging/guest-account-session'

export async function POST(request: Request) {
  await clearEmailSessionCookie()
  const base = getPublicAppUrlForServer(request).replace(/\/$/, '')
  const res = NextResponse.redirect(`${base}/`)
  const clear = { path: '/', maxAge: 0 }
  res.cookies.set(MESSAGING_GUEST_ACCOUNT_COOKIE, '', clear)
  res.cookies.set(MESSAGING_GUEST_ACCOUNT_COOKIE_LEGACY, '', clear)
  res.cookies.set(MESSAGING_GUEST_ACCOUNT_SYNC_COOKIE, '', clear)
  return res
}
