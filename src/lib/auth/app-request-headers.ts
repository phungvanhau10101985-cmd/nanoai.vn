/** Header do middleware gắn: URL (path+query) trang đang mở để quay lại sau đăng nhập. */
export const APP_LOGIN_NEXT_HEADER = 'x-app-login-next'
export const APP_LOGIN_NEXT_HEADER_LEGACY = 'x-nanoai-login-next'

export function readLoginNextFromHeaders(get: (name: string) => string | null): string {
  const v = get(APP_LOGIN_NEXT_HEADER)?.trim() || get(APP_LOGIN_NEXT_HEADER_LEGACY)?.trim()
  return v || ''
}
