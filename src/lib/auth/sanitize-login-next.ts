const DEFAULT_AFTER_LOGIN = '/dashboard'

/**
 * Chỉ cho phép đường dẫn nội bộ (pathname + query), tránh open redirect.
 */
export function sanitizeLoginNext(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim()
  if (!s || !s.startsWith('/') || s.startsWith('//')) return DEFAULT_AFTER_LOGIN
  if (s.includes('://') || s.includes('\\')) return DEFAULT_AFTER_LOGIN
  if (
    s.startsWith('/auth/login') ||
    s.startsWith('/auth/callback') ||
    s.startsWith('/auth/auth-code-error') ||
    s.startsWith('/auth/force-login')
  ) {
    return DEFAULT_AFTER_LOGIN
  }
  return s
}
