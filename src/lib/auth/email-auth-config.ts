/** Cookie JWT phiên đăng nhập email (OTP / magic link). Legacy `nanoai_email_session` vẫn được ghi/xóa song song. */
export const EMAIL_SESSION_COOKIE = 'app_email_session'
export const EMAIL_SESSION_COOKIE_LEGACY = 'nanoai_email_session'

export function isEmailAuthEnabled(): boolean {
  const v = process.env.EMAIL_AUTH_ENABLED
  return v === '1' || v === 'true'
}

export function getAuthJwtSecretBytes(): Uint8Array | null {
  const s = process.env.AUTH_JWT_SECRET?.trim()
  if (!s || s.length < 32) return null
  return new TextEncoder().encode(s)
}

/**
 * Phiên đăng nhập chỉ qua cookie JWT email — middleware không gọi hosted Auth (refresh/getUser).
 * Bật khi đã chuyển hết người dùng sang OTP/magic link và không còn dùng Google OAuth / mật khẩu qua host cũ.
 * Yêu cầu: EMAIL_AUTH_ENABLED + AUTH_JWT_SECRET (≥32 ký tự).
 */
export function isAuthEmailSessionOnlyMode(): boolean {
  const v = process.env.AUTH_EMAIL_SESSION_ONLY?.trim().toLowerCase()
  if (v !== '1' && v !== 'true' && v !== 'yes') return false
  if (!isEmailAuthEnabled()) return false
  const s = process.env.AUTH_JWT_SECRET?.trim()
  return Boolean(s && s.length >= 32)
}
