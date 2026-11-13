/**
 * Auth helpers dùng trên client - hỗ trợ bypass cho localhost (dev).
 * Khi chạy local (localhost/127.0.0.1), dùng dev user thay vì bắt đăng nhập.
 */

export function isLocalhost(): boolean {
  if (typeof window === 'undefined') return false
  const h = window.location.hostname
  return h === 'localhost' || h === '127.0.0.1'
}

/** Lấy dev user ID khi chạy local. Production build bỏ biến này khỏi bundle. */
export function getDevUserId(): string {
  if (process.env.NODE_ENV === 'production') return '00000000-0000-0000-0000-000000000001'
  return process.env.NEXT_PUBLIC_AUTH_DEV_USER_ID || '00000000-0000-0000-0000-000000000001'
}
