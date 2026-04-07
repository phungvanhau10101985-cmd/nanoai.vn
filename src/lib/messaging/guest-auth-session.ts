import type { NextRequest, NextResponse } from 'next/server'
import { isValidMessagingGuestSessionId } from '@/lib/messaging/guest-session-id'

export const MESSAGING_GUEST_SESSION_COOKIE = 'nanoai_guest_session_id'

export function readGuestSessionIdFromRequest(request: NextRequest): string | null {
  const raw = request.cookies.get(MESSAGING_GUEST_SESSION_COOKIE)?.value?.trim() ?? ''
  if (!raw) return null
  return isValidMessagingGuestSessionId(raw) ? raw : null
}

export function createGuestSessionId(): string {
  return crypto.randomUUID()
}

export function writeGuestSessionCookie(response: NextResponse, request: NextRequest, sessionId: string) {
  response.cookies.set(MESSAGING_GUEST_SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
}
