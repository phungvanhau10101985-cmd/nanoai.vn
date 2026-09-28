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

function escapeShopEmailHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** OTP thao tác nhạy cảm trên dashboard shop — From / tiêu đề / nội dung theo tên shop. */
export function formatShopSensitiveOtpMail(shopName: string, otp: string): {
  fromName: string
  subject: string
  text: string
  html: string
} {
  const shop = partnerShopEmailBrandName({ brand_name: shopName })
  const intro = `Bạn vừa yêu cầu xác minh OTP để thực hiện thao tác nhạy cảm trên ${shop}.`
  const text = `${intro}\n\nMã OTP của bạn: ${otp}\n\nMã có hiệu lực 10 phút. Nếu không phải bạn yêu cầu, hãy bỏ qua email này.\n\n— ${shop}`
  const html = `<p>${escapeShopEmailHtml(intro)}</p><p>Mã OTP của bạn: <b>${escapeShopEmailHtml(otp)}</b></p><p>Mã có hiệu lực 10 phút. Nếu không phải bạn yêu cầu, hãy bỏ qua email này.</p><p>— ${escapeShopEmailHtml(shop)}</p>`
  return {
    fromName: shop,
    subject: shopEmailSubject(shop, 'Mã OTP xác minh tài khoản'),
    text,
    html,
  }
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
