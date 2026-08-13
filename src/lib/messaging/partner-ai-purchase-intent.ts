import { normalizeCustomerMessageForInventorySearch } from '@/lib/messaging/partner-inventory-message-normalize'

/**
 * Hậu mãi / tra đơn / chính sách — **không** phải ý chốt mua.
 * Ưu tiên hơn regex mua: «chưa nhận hàng», «đơn DH309», «đổi size áo đã mua», hỏi cọc.
 */
const AFTER_SALES_NOT_CHECKOUT_RE = new RegExp(
  [
    String.raw`\b(?:dh|đh)\s*[-_]?\s*\d{2,}\b`,
    String.raw`#\s*(?:dh|đh)\s*\d+`,
    String.raw`\bmã\s*đơn\b`,
    String.raw`\bma\s*don\b`,
    String.raw`\btheo\s*dõi\b`,
    String.raw`\btheo\s*doi\b`,
    String.raw`\btra\s*cứu\b`,
    String.raw`\btra\s*cuu\b`,
    String.raw`\bvận\s*đơn\b`,
    String.raw`\bvan\s*don\b`,
    String.raw`\bmã\s*vận\b`,
    String.raw`\bchưa\s*nhận\b`,
    String.raw`\bchua\s*nhan\b`,
    String.raw`\bchưa\s*giao\b`,
    String.raw`\bkhông\s*giao\b`,
    String.raw`\bko\s*giao\b`,
    String.raw`đổi\s*(?:size|hàng|hang)`,
    String.raw`doi\s*(?:size|hang)`,
    String.raw`đổi\s+cho`,
    String.raw`doi\s+cho`,
    String.raw`đoi\s+cho`,
    String.raw`trả\s*hàng`,
    String.raw`tra\s*hang`,
    String.raw`hoàn\s*(?:tiền|coc|cọc)`,
    String.raw`đã\s*(?:đặt|cọc|thanh\s*toán|mua|gửi)`,
    String.raw`đa\s*(?:đặt|dat|cọc|coc|mua|gửi|gui)`,
    String.raw`da\s*(?:dat|coc|thanh\s*toan|mua|gui)`,
    String.raw`\bnhận\s*hàng\s*(?:không|ko|sai|nhầm)`,
    String.raw`\bnhan\s*hang\s*(?:khong|ko|sai)\b`,
    String.raw`\b(?:có|phải|cần)\s+.{0,32}cọc`,
    String.raw`cọc.{0,20}(?:không|ko|nhỉ)`,
    String.raw`\bcheck\s*(?:giúp|đơn|don|order|sđt|sdt)\b`,
    String.raw`\btình\s*trạng\s*(?:đơn|don)\b`,
    String.raw`\btrack(?:ing)?\s+(?:my\s+)?order\b`,
    String.raw`\bwhere\s+is\s+my\s+order\b`,
  ].join('|'),
  'i'
)

/**
 * Khách muốn **mua / đặt / chốt đơn** — nhánh gửi danh sách SP đã tư vấn (không gồm «chỉ xem / báo giá / tư vấn chung»).
 * Không dùng «nhận hàng» — cụm đó gần như luôn là COD / hậu mãi, không phải chốt mua.
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
    String.raw`\bcho\s+(?:mình|em|anh|chị|tôi)\s+(?:đặt|mua|lấy)\b`,
    String.raw`\blấy\s*hàng\b`,
    String.raw`\bthanh\s+toán\s+luôn\b`,
    String.raw`\bgửi\s+đơn\b`,
    // English — «order» trần dễ dính «order DH309»; chỉ cụm chốt mua.
    String.raw`\bplace\s+an?\s+order\b`,
    String.raw`\bcheckout\b`,
    String.raw`\bbuy\s+now\b`,
    String.raw`\bwant\s+to\s+(?:buy|order|purchase)\b`,
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
  let hasVnMobile = false
  for (const candidate of candidates) {
    const digitsOnly = candidate.replace(/\D+/g, '')
    // 84xxxxxxxxx -> đổi về 0xxxxxxxxx để chuẩn cùng định dạng nội địa.
    const localDigits = digitsOnly.startsWith('84') && digitsOnly.length === 11
      ? `0${digitsOnly.slice(2)}`
      : digitsOnly
    // Mobile VN hiện tại: 10 số, bắt đầu bằng 03/05/07/08/09.
    if (/^0(?:3|5|7|8|9)\d{8}$/.test(localDigits)) {
      hasVnMobile = true
      break
    }
  }
  if (!hasVnMobile) return false
  // SĐT trần / «SĐT của mình» thường là tra đơn, không phải chốt mua. Chỉ khi kèm động từ mua/đặt.
  return /\b(?:đặt|dat|mua|chốt|chot|order|checkout|buy)\b/i.test(message)
}

/** «Mua/lấy mẫu trong ảnh / hình này» — khách gửi ảnh kèm chú thích. */
function looksLikeBuyingModelInPhotoPhrase(message: string): boolean {
  if (!message) return false
  const hasCheckoutVerb = /\b(?:lấy|lay|đặt|dat|chốt|chot|mua|muốn|order|buy)\b/i.test(message)
  if (!hasCheckoutVerb) return false
  return /\b(?:trong\s*(?:ảnh|hình)|ảnh\s*(?:này|gửi)|hình\s*(?:này|gửi)|theo\s*ảnh|như\s*ảnh)\b/i.test(
    message
  )
}

function looksLikeFashionCheckoutPhrase(message: string): boolean {
  if (!message) return false
  if (QUICK_FASHION_CHECKOUT_RE.test(message)) return true
  if (looksLikeBuyingModelInPhotoPhrase(message)) return true
  // Mẫu tự do: có động từ mua/chốt + đồng thời có số lượng hoặc size/mẫu cụ thể.
  const hasCheckoutVerb = /\b(?:lấy|lay|đặt|dat|chốt|chot|mua|order)\b/i.test(message)
  if (!hasCheckoutVerb) return false
  const hasQuantity = /\b\d+\b/.test(message)
  const hasVariantSignal = /\b(?:size|sz|mẫu|mau|cái|bộ|bo|set|sp|sản\s*phẩm)\b/i.test(message)
  const hasDeixis = /\b(?:này|nay|kia|đó|do)\b/i.test(message)
  return hasQuantity || hasVariantSignal || hasDeixis
}

export function inboundTextLooksLikeAfterSalesNotCheckout(raw: string): boolean {
  const msg = normalizeCustomerMessageForInventorySearch(raw)
  if (!msg) return false
  return AFTER_SALES_NOT_CHECKOUT_RE.test(msg)
}

export function inboundTextLooksLikePurchasePickListIntent(raw: string): boolean {
  const msg = normalizeCustomerMessageForInventorySearch(raw)
  if (!msg || msg.length > 2000) return false
  if (inboundTextLooksLikeAfterSalesNotCheckout(msg)) return false
  return PURCHASE_PICK_LIST_INTENT_RE.test(msg)
    || looksLikeCheckoutPhoneSignal(msg)
    || looksLikeFashionCheckoutPhrase(msg)
}
