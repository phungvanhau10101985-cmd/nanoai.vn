import { normalizeCustomerMessageForInventorySearch } from '@/lib/messaging/partner-inventory-ai-search'

/**
 * Khách muốn **mua / đặt / chốt đơn** — nhánh gửi danh sách SP đã tư vấn (không gồm «chỉ xem / báo giá / tư vấn chung»).
 */
const PURCHASE_PICK_LIST_INTENT_RE = new RegExp(
  [
    // tiếng Việt
    String.raw`\bđặt\s*hàng\b`,
    String.raw`\bmua\s*hàng\b`,
    String.raw`\bchốt\s*đơn\b`,
    String.raw`\bđặt\s*giúp\b`,
    String.raw`\bmua\s*giúp\b`,
    String.raw`\bmuốn\s+đặt\b`,
    String.raw`\bmuốn\s+mua\b`,
    String.raw`\bcho\s+(?:mình|em|anh|chị|tôi|mình)\s+(?:đặt|mua|lấy)\b`,
    String.raw`\blấy\s*hàng\b`,
    String.raw`\bnhận\s*hàng\b`,
    String.raw`\bthanh\s+toán\s+luôn\b`,
    String.raw`\bgửi\s+đơn\b`,
    // English
    String.raw`\b(?:place\s+an?\s+)?order\b`,
    String.raw`\bcheckout\b`,
    String.raw`\bbuy\s+now\b`,
    String.raw`\bpurchase\b`,
  ].join('|'),
  'i'
)

/**
 * Khách gửi số điện thoại (đặc biệt tin chỉ có SĐT) thường là tín hiệu chốt đơn.
 * Hỗ trợ định dạng phổ biến VN: 09xxxxxxxx, +84xxxxxxxxx, 84xxxxxxxxx, có thể có dấu cách/chấm/gạch.
 */
const PHONE_CANDIDATE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/g

function looksLikeCheckoutPhoneSignal(message: string): boolean {
  const candidates = message.match(PHONE_CANDIDATE_RE) ?? []
  for (const candidate of candidates) {
    const digitsOnly = candidate.replace(/\D+/g, '')
    // 84xxxxxxxxx -> đổi về 0xxxxxxxxx để chuẩn cùng định dạng nội địa.
    const localDigits = digitsOnly.startsWith('84') && digitsOnly.length === 11
      ? `0${digitsOnly.slice(2)}`
      : digitsOnly
    // Mobile VN hiện tại: 10 số, bắt đầu bằng 03/05/07/08/09.
    if (/^0(?:3|5|7|8|9)\d{8}$/.test(localDigits)) return true
  }
  return false
}

export function inboundTextLooksLikePurchasePickListIntent(raw: string): boolean {
  const msg = normalizeCustomerMessageForInventorySearch(raw)
  if (!msg || msg.length > 2000) return false
  return PURCHASE_PICK_LIST_INTENT_RE.test(msg) || looksLikeCheckoutPhoneSignal(msg)
}
