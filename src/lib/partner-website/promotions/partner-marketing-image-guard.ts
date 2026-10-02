/** Paid marketing images (banner + sale icon). One engine, every shop. */

export const PARTNER_MARKETING_IMAGE_MAX_ATTEMPTS = 3

export const PARTNER_MARKETING_IMAGE_SHOP_NOT_LIVE_ERROR =
  'Shop phải public web và gắn tên miền riêng (SSL đã hoạt động) rồi mới tạo ảnh.'

export const PARTNER_MARKETING_IMAGE_ATTEMPT_CAP_ERROR =
  'Đã tạo ảnh 3 lần nhưng không lưu được. Cron đã dừng và báo admin NanoAI.'

export function partnerMarketingImageAttemptsExhausted(failedCount: number, force = false): boolean {
  if (force) return false
  const n = Number(failedCount)
  if (!Number.isFinite(n) || n < 0) return false
  return n >= PARTNER_MARKETING_IMAGE_MAX_ATTEMPTS
}

export function partnerMarketingImageKindLabel(kind: string): string {
  if (kind === 'birthday') return 'banner sinh nhật'
  if (kind === 'sale') return 'banner sale ngày trùng tháng'
  if (kind === 'warehouse') return 'banner sale kho'
  if (kind === 'regular') return 'banner thường'
  if (kind === 'sale-icon') return 'icon sale'
  return 'ảnh khuyến mãi'
}
