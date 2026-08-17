/** Header do middleware gắn: URL (path+query) trang đang mở để quay lại sau đăng nhập. */
export const APP_LOGIN_NEXT_HEADER = 'x-app-login-next'
export const APP_LOGIN_NEXT_HEADER_LEGACY = 'x-nanoai-login-next'
/** Hostname domain riêng shop (middleware rewrite) — ẩn chrome NanoAI trên white-label. */
export const PARTNER_CUSTOM_DOMAIN_HEADER = 'x-partner-custom-domain'
/**
 * `?pw-device=` do middleware chuyển thành header, để mọi trang `/site/{slug}/…` xem đúng bản đã lưu
 * của máy đó mà không phải kéo `searchParams` qua từng route.
 */
export const PARTNER_VISUAL_DEVICE_HEADER = 'x-pw-device'

export function readPartnerVisualDeviceFromHeaders(get: (name: string) => string | null): string {
  return get(PARTNER_VISUAL_DEVICE_HEADER)?.trim().toLowerCase() || ''
}

export function readLoginNextFromHeaders(get: (name: string) => string | null): string {
  const v = get(APP_LOGIN_NEXT_HEADER)?.trim() || get(APP_LOGIN_NEXT_HEADER_LEGACY)?.trim()
  return v || ''
}

export function readPartnerCustomDomainFromHeaders(get: (name: string) => string | null): string {
  return get(PARTNER_CUSTOM_DOMAIN_HEADER)?.trim().toLowerCase() || ''
}
