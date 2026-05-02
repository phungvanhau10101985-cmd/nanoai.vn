import type { NextRequest, NextResponse } from 'next/server'
import { EMAIL_SESSION_MAX_AGE_SEC } from '@/lib/auth/email-session-token'

export const MESSAGING_GUEST_ACCOUNT_COOKIE = 'app_guest_account_id'
export const MESSAGING_GUEST_ACCOUNT_COOKIE_LEGACY = 'nanoai_guest_account_id'
/** Không HttpOnly — đồng bộ ref khi localStorage bị WebKit xóa (iOS). */
export const MESSAGING_GUEST_ACCOUNT_SYNC_COOKIE = 'app_guest_account_sync'
export const MESSAGING_GUEST_ACCOUNT_HEADER = 'x-guest-account-id'
export const MESSAGING_GUEST_ACCOUNT_STORAGE_KEY = 'app_guest_account_id'
export const MESSAGING_GUEST_ACCOUNT_STORAGE_KEY_LEGACY = 'nanoai_guest_account_id'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function readGuestAccountIdFromRequest(request: NextRequest): string | null {
  const raw =
    request.headers.get(MESSAGING_GUEST_ACCOUNT_HEADER)?.trim()
    ?? request.cookies.get(MESSAGING_GUEST_ACCOUNT_COOKIE)?.value?.trim()
    ?? request.cookies.get(MESSAGING_GUEST_ACCOUNT_COOKIE_LEGACY)?.value?.trim()
    ?? request.cookies.get(MESSAGING_GUEST_ACCOUNT_SYNC_COOKIE)?.value?.trim()
    ?? ''
  if (!raw) return null
  return UUID_RE.test(raw) ? raw : null
}

export function writeGuestAccountCookie(response: NextResponse, request: NextRequest, accountId: string) {
  const opts = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: request.nextUrl.protocol === 'https:',
    path: '/',
    /** Cùng thời hạn cookie phiên email (`EMAIL_SESSION_MAX_AGE_DAYS`, mặc định ~10 năm). */
    maxAge: EMAIL_SESSION_MAX_AGE_SEC,
  }
  const syncOpts = {
    httpOnly: false,
    sameSite: 'lax' as const,
    secure: request.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: EMAIL_SESSION_MAX_AGE_SEC,
  }
  response.cookies.set(MESSAGING_GUEST_ACCOUNT_COOKIE, accountId, opts)
  response.cookies.set(MESSAGING_GUEST_ACCOUNT_COOKIE_LEGACY, accountId, opts)
  response.cookies.set(MESSAGING_GUEST_ACCOUNT_SYNC_COOKIE, accountId, syncOpts)
  response.headers.set(MESSAGING_GUEST_ACCOUNT_HEADER, accountId)
}
