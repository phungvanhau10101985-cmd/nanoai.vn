import type { NextRequest, NextResponse } from 'next/server'
import {
  isValidMessagingGuestSessionId,
  LOOSE_RFC4122_UUID_STRING_RE,
} from '@/lib/messaging/guest-session-id'

/** Khớp mọi chuỗi UUID dạng 8-4-4-4-12 (kể cả khi không thỏa variant/version RFC 4122 trong `isValidMessagingGuestSessionId`). */
const LOOSE_GUEST_SESSION_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const MESSAGING_GUEST_SESSION_COOKIE = 'app_guest_session_id'
export const MESSAGING_GUEST_SESSION_COOKIE_LEGACY = 'nanoai_guest_session_id'
export const MESSAGING_GUEST_SESSION_HEADER = 'x-guest-session-id'

/** Khớp cookie HttpOnly (đồng bộ với localStorage phía client). */
export const MESSAGING_GUEST_SESSION_STORAGE_KEY = 'app_guest_session_id'
export const MESSAGING_GUEST_SESSION_STORAGE_KEY_LEGACY = 'nanoai_guest_session_id'

export function readGuestSessionIdFromHeader(request: NextRequest): string | null {
  const raw = request.headers.get(MESSAGING_GUEST_SESSION_HEADER)?.trim() ?? ''
  if (!raw) return null
  return isValidMessagingGuestSessionId(raw) ? raw : null
}

export function readGuestSessionIdFromRequest(request: NextRequest): string | null {
  return readGuestSessionIdFromHeader(request) ?? ((): string | null => {
    const raw =
      request.cookies.get(MESSAGING_GUEST_SESSION_COOKIE)?.value?.trim()
      ?? request.cookies.get(MESSAGING_GUEST_SESSION_COOKIE_LEGACY)?.value?.trim()
      ?? ''
    if (!raw) return null
    return isValidMessagingGuestSessionId(raw) ? raw : null
  })()
}

/** Dùng khi cần khớp `order.external_thread_id` / DB: chấp nhận UUID «lỏng» nếu strict RFC 4122 từ chối. */
export function readLooseGuestSessionIdFromRequest(request: NextRequest): string | null {
  const fromHeader = request.headers.get(MESSAGING_GUEST_SESSION_HEADER)?.trim() ?? ''
  if (fromHeader && LOOSE_GUEST_SESSION_UUID_RE.test(fromHeader)) return fromHeader
  const raw =
    request.cookies.get(MESSAGING_GUEST_SESSION_COOKIE)?.value?.trim()
    ?? request.cookies.get(MESSAGING_GUEST_SESSION_COOKIE_LEGACY)?.value?.trim()
    ?? ''
  if (raw && LOOSE_GUEST_SESSION_UUID_RE.test(raw)) return raw
  return null
}

/** Ưu tiên session đã validate; fallback loose để PATCH checkout vẫn khớp đơn nháp tạo lúc ẩn danh. */
export function readGuestSessionIdFromRequestStrictOrLoose(request: NextRequest): string | null {
  return readGuestSessionIdFromRequest(request) ?? readLooseGuestSessionIdFromRequest(request)
}

export function createGuestSessionId(): string {
  return crypto.randomUUID()
}

export function writeGuestSessionCookie(response: NextResponse, request: NextRequest, sessionId: string) {
  const opts = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: request.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  }
  response.cookies.set(MESSAGING_GUEST_SESSION_COOKIE, sessionId, opts)
  response.cookies.set(MESSAGING_GUEST_SESSION_COOKIE_LEGACY, sessionId, opts)
}

export function writeGuestSessionHeader(response: NextResponse, sessionId: string) {
  response.headers.set(MESSAGING_GUEST_SESSION_HEADER, sessionId)
}
