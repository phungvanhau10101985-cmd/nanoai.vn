/** Cookie JWT phiên đăng nhập email (OTP / magic link). Legacy `nanoai_email_session` vẫn được ghi/xóa song song. */
export const EMAIL_SESSION_COOKIE = 'app_email_session'
export const EMAIL_SESSION_COOKIE_LEGACY = 'nanoai_email_session'

export function isEmailAuthEnabled(): boolean {
  const v = process.env.EMAIL_AUTH_ENABLED
  return v === '1' || v === 'true'
}

function normalizeJwtSecretList(raw: string): string[] {
  return raw
    .split(',')
    .map((x) => x.trim())
    .filter((x) => x.length >= 32)
}

/** Secret chính dùng để ký token mới. */
export function getPrimaryAuthJwtSecretBytes(): Uint8Array | null {
  const s = process.env.AUTH_JWT_SECRET?.trim()
  if (!s || s.length < 32) return null
  return new TextEncoder().encode(s)
}

/**
 * Danh sách secret dùng để verify token cũ+mới (phục vụ rotate secret không logout hàng loạt).
 * - AUTH_JWT_SECRET: secret hiện tại
 * - AUTH_JWT_SECRET_PREVIOUS: danh sách secret cũ, phân tách dấu phẩy
 */
export function getAuthJwtSecretCandidatesBytes(): Uint8Array[] {
  const out: Uint8Array[] = []
  const seen = new Set<string>()
  const current = process.env.AUTH_JWT_SECRET?.trim() ?? ''
  if (current.length >= 32) {
    out.push(new TextEncoder().encode(current))
    seen.add(current)
  }
  const previousRaw = process.env.AUTH_JWT_SECRET_PREVIOUS?.trim() ?? ''
  if (previousRaw) {
    for (const s of normalizeJwtSecretList(previousRaw)) {
      if (seen.has(s)) continue
      out.push(new TextEncoder().encode(s))
      seen.add(s)
    }
  }
  return out
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
  return Boolean(getPrimaryAuthJwtSecretBytes())
}
