import type { NextRequest, NextResponse } from 'next/server'

export const MESSAGING_GUEST_ACCOUNT_COOKIE = 'nanoai_guest_account_id'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function readGuestAccountIdFromRequest(request: NextRequest): string | null {
  const raw = request.cookies.get(MESSAGING_GUEST_ACCOUNT_COOKIE)?.value?.trim() ?? ''
  if (!raw) return null
  return UUID_RE.test(raw) ? raw : null
}

export function writeGuestAccountCookie(response: NextResponse, request: NextRequest, accountId: string) {
  response.cookies.set(MESSAGING_GUEST_ACCOUNT_COOKIE, accountId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
}
