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

export function inboundTextLooksLikePurchasePickListIntent(raw: string): boolean {
  const msg = normalizeCustomerMessageForInventorySearch(raw)
  if (!msg || msg.length > 2000) return false
  return PURCHASE_PICK_LIST_INTENT_RE.test(msg)
}
