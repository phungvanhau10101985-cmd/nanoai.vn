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
    String.raw`kiểm\s*tra.{0,48}(?:đơn|don|sđt|sdt)`,
    String.raw`kiem\s*tra.{0,48}(?:don|sdt)`,
    String.raw`(?:đơn|don).{0,40}(?:gửi|gui|giao)\s*(?:chưa|chua|đến|den|tới|toi|đâu|dau)?`,
    String.raw`gửi\s*chưa`,
    String.raw`gui\s*chua`,
    String.raw`gửi\s*(?:đến|tới|toi)\s*đâu`,
    String.raw`gui\s*(?:den|toi)\s*dau`,
    String.raw`đơn\s+của\s+(?:mình|tôi|em|anh|chị)`,
    String.raw`don\s+cua\s+(?:minh|toi)`,
    String.raw`\b(?:sđt|sdt)\b.{0,32}(?:đơn|don|kiểm|kiem)`,
    String.raw`(?:đơn|don).{0,32}(?:sđt|sdt|điện\s*thoại|dien\s*thoai)`,
    String.raw`\btrack(?:ing)?\s+(?:my\s+)?order\b`,
    String.raw`\bwhere\s+is\s+my\s+order\b`,
    String.raw`hàng.{0,40}(?:đến|den|tới|toi)\s*đâu`,
    String.raw`hang.{0,40}(?:den|toi)\s*dau`,
    String.raw`hàng.{0,40}gửi\s*chưa`,
    String.raw`hang.{0,40}gui\s*chua`,
    String.raw`chưa\s*nhận\s*được`,
    String.raw`chua\s*nhan\s*duoc`,
    String.raw`sao\s+chưa\s+nhận`,
    String.raw`đến\s*đâu\s*rồi`,
    String.raw`den\s*dau\s*roi`,
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

/**
 * Hỏi chính sách hoàn / hủy / không ưng — **không** phải «đơn đi đâu».
 * Tách khỏi regex hậu mãi rộng (`cọc…ko` từng khớp «cọc rồi khi nhận hàng ko ưng»).
 */
const POLICY_REFUND_OR_CANCEL_RE = new RegExp(
  [
    String.raw`hoàn\s*(?:lại\s*)?(?:tiền|cọc|coc)`,
    String.raw`hoan\s*(?:lai\s*)?(?:tien|coc)`,
    String.raw`refund`,
    String.raw`hủy.{0,40}(?:đơn|don|hàng|hang|cọc|coc|hoàn|hoan)`,
    String.raw`\bhủy\b`,
    String.raw`huy.{0,40}(?:don|hang|coc|hoan)`,
    String.raw`(?:không|ko|khong)\s*ưng`,
    String.raw`(?:không|ko|khong)\s*đúng\s*ý`,
    String.raw`(?:không|ko|khong)\s*dung\s*y`,
    String.raw`đổi\s*trả`,
    String.raw`doi\s*tra`,
    String.raw`(?<!kiểm\s)(?<!kiem\s)trả\s*hàng`,
    String.raw`(?<!kiểm\s)(?<!kiem\s)tra\s*hang`,
    String.raw`cancel.{0,20}(?:order|refund)`,
  ].join('|'),
  'i'
)

/** Câu hỏi tình trạng / tracking rõ — vẫn đi nhánh tra cứu. */
const EXPLICIT_ORDER_TRACK_RE = new RegExp(
  [
    String.raw`gửi\s*chưa`,
    String.raw`gui\s*chua`,
    String.raw`gửit\s*(?:đến|den|tới|toi)`,
    String.raw`đến\s*đâu`,
    String.raw`den\s*dau`,
    String.raw`tới\s*đâu`,
    String.raw`toi\s*dau`,
    String.raw`tình\s*trạng\s*(?:đơn|don)`,
    String.raw`tinh\s*trang\s*don`,
    String.raw`kiểm\s*tra.{0,48}(?:đơn|don|sđt|sdt)`,
    String.raw`kiem\s*tra.{0,48}(?:don|sdt)`,
    String.raw`theo\s*dõi`,
    String.raw`theo\s*doi`,
    String.raw`tra\s*cứu`,
    String.raw`tra\s*cuu`,
    String.raw`mã\s*vận`,
    String.raw`ma\s*van`,
    String.raw`where\s+is\s+my\s+order`,
    String.raw`track(?:ing)?\s+(?:my\s+)?order`,
    String.raw`chưa\s*nhận`,
    String.raw`chua\s*nhan`,
    String.raw`chưa\s*giao`,
    String.raw`chua\s*giao`,
    String.raw`không\s*giao`,
    String.raw`ko\s*giao`,
    String.raw`check\s*(?:giúp|đơn|don|order|sđt|sdt)`,
  ].join('|'),
  'i'
)

export function inboundTextLooksLikePolicyRefundOrCancelAsk(raw: string): boolean {
  const msg = normalizeCustomerMessageForInventorySearch(raw)
  if (!msg) return false
  return POLICY_REFUND_OR_CANCEL_RE.test(msg)
}

export function inboundTextLooksLikeExplicitOrderTrackAsk(raw: string): boolean {
  const msg = normalizeCustomerMessageForInventorySearch(raw)
  if (!msg) return false
  return EXPLICIT_ORDER_TRACK_RE.test(msg)
}

/** Tin gần như chỉ mã DH / vận đơn / SĐT — vẫn tra cứu. */
export function inboundTextLooksLikeBareShippingId(raw: string): boolean {
  const t = normalizeCustomerMessageForInventorySearch(raw).trim()
  if (!t || t.length > 48) return false
  if (
    /^(?:(?:mã|ma)\s*)?(?:(?:đơn|don)\s*)?(?:là|la)?\s*(?:dh|đh|dc|đc)\s*[-_]?\s*\d{2,}\s*[.!?]*$/i.test(t)
  ) {
    return true
  }
  if (/^(?:(?:mã|ma)\s*(?:vận|van)?\s*(?:đơn|don)?\s*)?[a-z]{2}\d{8,}vn\s*[.!?]*$/i.test(t)) {
    return true
  }
  if (/^ho\d{6,}\s*[.!?]*$/i.test(t)) return true
  const digits = t.replace(/\D+/g, '')
  const local = digits.startsWith('84') && digits.length === 11 ? `0${digits.slice(2)}` : digits
  if (!/^0(?:3|5|7|8|9)\d{8}$/.test(local)) return false
  /** SĐT kèm nhãn — không coi dãy số trần (có thể đang chốt đơn). */
  return /sđt|sdt|đt|điện\s*thoại|dien\s*thoai|phone/i.test(t)
}

/**
 * Hỏi tình trạng hàng/đơn — kể cả chưa nêu mã DH (dùng SĐT tin này hoặc tin trước).
 * Không gồm hỏi hoàn/hủy/không ưng (đi job `policy_or_order_support`).
 */
export function inboundTextLooksLikeOrderStatusAsk(raw: string): boolean {
  if (inboundTextLooksLikeBareShippingId(raw)) return true
  if (inboundTextLooksLikePolicyRefundOrCancelAsk(raw) && !inboundTextLooksLikeExplicitOrderTrackAsk(raw)) {
    return false
  }
  return inboundTextLooksLikeAfterSalesNotCheckout(raw)
}

export function inboundTextLooksLikePurchasePickListIntent(raw: string): boolean {
  const msg = normalizeCustomerMessageForInventorySearch(raw)
  if (!msg || msg.length > 2000) return false
  if (inboundTextLooksLikeAfterSalesNotCheckout(msg)) return false
  return PURCHASE_PICK_LIST_INTENT_RE.test(msg)
    || looksLikeCheckoutPhoneSignal(msg)
    || looksLikeFashionCheckoutPhrase(msg)
}
