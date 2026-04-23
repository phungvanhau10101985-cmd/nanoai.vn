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

/**
 * Cụm chốt nhanh thường gặp ở shop thời trang:
 * - "lấy 2 cái size M"
 * - "chốt 1 bộ"
 * - "mình đặt mẫu này"
 */
const QUICK_FASHION_CHECKOUT_RE = new RegExp(
  [
    String.raw`\b(?:lấy|lay)\s*\d+\s*(?:cái|ao|mẫu|mau|bộ|bo|set|sp|sản\s*phẩm)\b`,
    String.raw`\b(?:chốt|chot)\s*\d+\s*(?:cái|mẫu|mau|bộ|bo|set|đơn|don)\b`,
    String.raw`\b(?:mình|minh|em|anh|chị|chi|tôi|toi)\s+(?:đặt|dat|mua|lấy|lay|chốt|chot)\s+(?:mẫu|mau|cái|bộ|bo|set|sp)\s*(?:này|nay|kia|đó|do)?\b`,
  ].join('|'),
  'i'
)

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

function looksLikeFashionCheckoutPhrase(message: string): boolean {
  if (!message) return false
  if (QUICK_FASHION_CHECKOUT_RE.test(message)) return true
  // Mẫu tự do: có động từ mua/chốt + đồng thời có số lượng hoặc size/mẫu cụ thể.
  const hasCheckoutVerb = /\b(?:lấy|lay|đặt|dat|chốt|chot|mua)\b/i.test(message)
  if (!hasCheckoutVerb) return false
  const hasQuantity = /\b\d+\b/.test(message)
  const hasVariantSignal = /\b(?:size|sz|mẫu|mau|cái|bộ|bo|set|sp|sản\s*phẩm)\b/i.test(message)
  const hasDeixis = /\b(?:này|nay|kia|đó|do)\b/i.test(message)
  return hasQuantity || hasVariantSignal || hasDeixis
}

export function inboundTextLooksLikePurchasePickListIntent(raw: string): boolean {
  const msg = normalizeCustomerMessageForInventorySearch(raw)
  if (!msg || msg.length > 2000) return false
  return PURCHASE_PICK_LIST_INTENT_RE.test(msg)
    || looksLikeCheckoutPhoneSignal(msg)
    || looksLikeFashionCheckoutPhrase(msg)
}
