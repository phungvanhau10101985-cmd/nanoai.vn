import type { NextRequest, NextResponse } from 'next/server'
import { EMAIL_SESSION_MAX_AGE_SEC } from '@/lib/auth/email-session-token'
import { writeGuestAccountCookie } from '@/lib/messaging/guest-account-session'
import {
  isValidMessagingGuestSessionId,
  LOOSE_RFC4122_UUID_STRING_RE,
} from '@/lib/messaging/guest-session-id'

export const MESSAGING_GUEST_SESSION_COOKIE = 'app_guest_session_id'
export const MESSAGING_GUEST_SESSION_COOKIE_LEGACY = 'nanoai_guest_session_id'
/** Cookie không HttpOnly — iOS/Safari hay xóa localStorage; JS đọc được để gửi header trước fetch đầu. */
export const MESSAGING_GUEST_SESSION_SYNC_COOKIE = 'app_guest_session_sync'
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
      ?? request.cookies.get(MESSAGING_GUEST_SESSION_SYNC_COOKIE)?.value?.trim()
      ?? ''
    if (!raw) return null
    return isValidMessagingGuestSessionId(raw) ? raw : null
  })()
}

/** Dùng khi cần khớp `order.external_thread_id` / DB: chấp nhận UUID «lỏng» nếu strict RFC 4122 từ chối. */
export function readLooseGuestSessionIdFromRequest(request: NextRequest): string | null {
  const fromHeader = request.headers.get(MESSAGING_GUEST_SESSION_HEADER)?.trim() ?? ''
  if (fromHeader && LOOSE_RFC4122_UUID_STRING_RE.test(fromHeader)) return fromHeader
  const raw =
    request.cookies.get(MESSAGING_GUEST_SESSION_COOKIE)?.value?.trim()
    ?? request.cookies.get(MESSAGING_GUEST_SESSION_COOKIE_LEGACY)?.value?.trim()
    ?? request.cookies.get(MESSAGING_GUEST_SESSION_SYNC_COOKIE)?.value?.trim()
    ?? ''
  if (raw && LOOSE_RFC4122_UUID_STRING_RE.test(raw)) return raw
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
    /** Đồng bộ với phiên email + guest account (`EMAIL_SESSION_MAX_AGE_DAYS`). */
    maxAge: EMAIL_SESSION_MAX_AGE_SEC,
  }
  const syncOpts = {
    httpOnly: false,
    sameSite: 'lax' as const,
    secure: request.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: EMAIL_SESSION_MAX_AGE_SEC,
  }
  response.cookies.set(MESSAGING_GUEST_SESSION_COOKIE, sessionId, opts)
  response.cookies.set(MESSAGING_GUEST_SESSION_COOKIE_LEGACY, sessionId, opts)
  response.cookies.set(MESSAGING_GUEST_SESSION_SYNC_COOKIE, sessionId, syncOpts)
}

export function writeGuestSessionHeader(response: NextResponse, sessionId: string) {
  response.headers.set(MESSAGING_GUEST_SESSION_HEADER, sessionId)
}

/**
 * Gia hạn cookie phiên (maxAge) và gửi header — client đồng bộ lại localStorage.
 * Gọi cho **mọi** response khi khách ẩn danh đã có session (không chỉ lần tạo mới),
 * tránh mất lịch sử trên iOS/Safari khi WebKit xóa storage nhưng cookie HttpOnly còn.
 */
export function mirrorGuestSessionToClient(response: NextResponse, request: NextRequest, sessionId: string) {
  if (!isValidMessagingGuestSessionId(sessionId)) return
  writeGuestSessionCookie(response, request, sessionId)
  writeGuestSessionHeader(response, sessionId)
}

type GuestIdentityMirrorOpts = {
  newSessionId: string | null
  user?: { id?: string } | null
  effectiveExternalThreadId: string
  effectiveGuestAccountId: string | null
}

/**
 * Đồng bộ cookie + header tài khoản / session khách sau mỗi API thành công.
 */
export function applyGuestIdentityToResponse(
  response: NextResponse,
  request: NextRequest,
  opts: GuestIdentityMirrorOpts
): void {
  const { newSessionId, user, effectiveExternalThreadId, effectiveGuestAccountId } = opts
  if (effectiveGuestAccountId) {
    writeGuestAccountCookie(response, request, effectiveGuestAccountId)
  }
  if (newSessionId) {
    mirrorGuestSessionToClient(response, request, newSessionId)
    return
  }
  if (
    !effectiveGuestAccountId &&
    !user?.id &&
    isValidMessagingGuestSessionId(effectiveExternalThreadId)
  ) {
    mirrorGuestSessionToClient(response, request, effectiveExternalThreadId)
  }
}
