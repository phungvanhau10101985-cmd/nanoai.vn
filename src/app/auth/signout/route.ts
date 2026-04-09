import { NextResponse } from 'next/server'
import { clearEmailSessionCookie } from '@/lib/auth/email-session-token'

export async function POST(request: Request) {
  await clearEmailSessionCookie()
  return NextResponse.redirect(new URL('/', request.url))
}
