import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { sanitizeLoginNext } from '@/lib/auth/sanitize-login-next'

export { sanitizeLoginNext } from '@/lib/auth/sanitize-login-next'

/**
 * Đọc URL trang đang truy cập do middleware gắn (x-nanoai-login-next).
 */
export function getIntendedPathFromRequest(): string {
  try {
    const h = headers()
    const fromHeader = h.get('x-nanoai-login-next')
    return sanitizeLoginNext(fromHeader)
  } catch {
    return sanitizeLoginNext(null)
  }
}

/** Chuyển tới đăng nhập, sau khi đăng nhập quay lại trang vừa mở (nếu hợp lệ). */
export function redirectToLogin(): never {
  const next = getIntendedPathFromRequest()
  redirect(`/auth/login?next=${encodeURIComponent(next)}`)
}
