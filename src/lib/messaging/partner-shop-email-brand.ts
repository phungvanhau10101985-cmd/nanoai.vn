/** Tên thương hiệu hiện trên From / tiêu đề mail shop SaaS — không dùng NanoAI. */
export function partnerShopEmailBrandName(input?: {
  brand_name?: string | null
  display_name?: string | null
  title?: string | null
} | null): string {
  const brand = String(input?.brand_name ?? '').trim()
  const display = String(input?.display_name ?? '').trim()
  const title = String(input?.title ?? '').trim()
  return brand || display || title || 'Shop'
}

export function shopBrandFromNotificationMeta(meta?: Record<string, unknown> | null): string {
  const v = meta?.shop_display_name
  return typeof v === 'string' ? v.trim() : ''
}

/** Tiêu đề mail shop luôn mở bằng tên shop; không thêm lần hai nếu đã có. */
export function shopEmailSubject(shopName: string, rest: string): string {
  const shop = shopName.trim() || 'Shop'
  const restTrim = String(rest || '').trim()
  if (!restTrim) return shop
  if (restTrim === shop) return shop
  if (restTrim.startsWith(`${shop} —`) || restTrim.startsWith(`${shop} -`)) return restTrim
  return `${shop} — ${restTrim}`
}
