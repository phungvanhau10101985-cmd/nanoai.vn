import { NextResponse } from 'next/server'
import { clearEmailSessionCookie } from '@/lib/auth/email-session-token'
import { getPublicAppUrlForServer } from '@/lib/auth/public-app-url'

export async function POST(request: Request) {
  await clearEmailSessionCookie()
  const base = getPublicAppUrlForServer(request).replace(/\/$/, '')
  return NextResponse.redirect(`${base}/`)
}
