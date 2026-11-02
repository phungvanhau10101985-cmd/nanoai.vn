import { extractExplicitSkuCandidates } from '@/lib/messaging/partner-inventory-ai-search'
import { normalizeCustomerMessageForInventorySearch } from '@/lib/messaging/partner-inventory-message-normalize'
import {
  inboundTextLooksLikeOrderStatusAsk,
  inboundTextLooksLikeShopPolicyAsk,
} from '@/lib/messaging/partner-ai-purchase-intent'
import { isSequentialShopOrderCode } from '@/lib/messaging/shop-payment-reference'

/**
 * Mã mẫu trần kiểu K4627 / A6009 — một hoặc hai chữ cái rồi số.
 * Không phải DH/DC, vận đơn, mã CK shop (từ 3 chữ cái), hay số điện thoại.
 */
const BARE_PRODUCT_SKU_RE = /^[A-Za-z]{1,2}\d{2,8}[A-Za-z0-9]{0,6}$/
const ORDER_OR_TRACK_RE = /^(?:dh|đh|dc|đc)\d{2,}$|^[a-z]{2}\d{8,}vn$|^ho\d{6,}$/i
const PRODUCT_HINT_RE =
  /\b(?:váy|đầm|áo|quần|giày|dép|túi|chân\s*váy|set|combo|bộ|dam)\b|(?:^|[\s,.])(?:s|m|l|xl|xxl|xxxl)\b/i

function skuKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s._-]+/g, '')
}

function firstVnMobile(raw: string): { phone: string; start: number; end: number } | null {
  const re = /(?:\+?84|0)(?:3|5|7|8|9)(?:[\s.\-()]*\d){8,10}/g
  let match: RegExpExecArray | null
  while ((match = re.exec(raw))) {
    const digits = match[0].replace(/\D+/g, '')
    const local =
      digits.startsWith('84') && digits.length === 11 ? `0${digits.slice(2)}` : digits
    if (!/^0(?:3|5|7|8|9)\d{8}$/.test(local)) continue
    return { phone: local, start: match.index, end: match.index + match[0].length }
  }
  return null
}

/**
 * Tin gần như chỉ một mã mẫu. «mã K4627» thì được. «K4627 còn hàng không» thì không.
 */
export function extractBareProductSku(raw: string): string | null {
  const text = normalizeCustomerMessageForInventorySearch(raw)
  if (!text || text.length > 40) return null
  if (firstVnMobile(text)) return null
  const stripped = text
    .replace(/^(?:mã|ma|sku|code)\s*[:#-]?\s*/i, '')
    .replace(/[.!?…]+$/g, '')
    .trim()
  if (!stripped || /\s/.test(stripped)) return null
  if (!BARE_PRODUCT_SKU_RE.test(stripped)) return null
  if (ORDER_OR_TRACK_RE.test(stripped) || isSequentialShopOrderCode(stripped)) return null
  const candidates = extractExplicitSkuCandidates(stripped)
  if (candidates.length !== 1) return null
  if (skuKey(candidates[0]) !== skuKey(stripped)) return null
  return stripped
}

const CONSULT_ONLY_RE =
  /^(?:(?:shop|em|mình|minh|anh|chị|chi)\s+)*(?:(?:cho|giup|giúp)\s+(?:em|mình|minh|shop)\s+)?(?:cần|can|nhờ|nho|muốn|muon|xin)\s+tư\s*vấn(?:\s+giúp)?(?:\s+(?:ạ|a|nha|nhé|nhe|shop|với|voi|em|mình|minh))*[.!?…]*$/i

/**
 * «Cần tư vấn» + đúng một SĐT, không kèm loại hàng và không phải câu tra đơn.
 * Trả số nội địa 10 số, hoặc null.
 */
export function extractConsultCallbackPhone(raw: string): string | null {
  if (inboundTextLooksLikeOrderStatusAsk(raw)) return null
  if (inboundTextLooksLikeShopPolicyAsk(raw)) return null
  const text = normalizeCustomerMessageForInventorySearch(raw)
  if (!text || text.length > 80) return null
  if (PRODUCT_HINT_RE.test(text)) return null
  const hit = firstVnMobile(text)
  if (!hit) return null
  const rest = `${text.slice(0, hit.start)} ${text.slice(hit.end)}`.replace(/\s+/g, ' ').trim()
  if (!CONSULT_ONLY_RE.test(rest)) return null
  return hit.phone
}

/**
 * Tin mới nhất trước. Bỏ qua chính câu «cần tư vấn + SĐT».
 * Gặp câu khác (không phải mã mẫu trần) thì dừng — không kéo mã cũ sau khi khách đã đổi ý.
 */
export function inheritBareProductSkuFromPriorInbounds(bodiesNewestFirst: string[]): string | null {
  for (const body of bodiesNewestFirst) {
    const sku = extractBareProductSku(body)
    if (sku) return sku
    if (extractConsultCallbackPhone(body)) continue
    const text = normalizeCustomerMessageForInventorySearch(body)
    if (!text) continue
    return null
  }
  return null
}

export function consultCallbackPhoneFromRaw(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const v = (raw as { consult_callback_phone?: unknown }).consult_callback_phone
  if (typeof v !== 'string') return null
  const phone = v.trim()
  return /^0(?:3|5|7|8|9)\d{8}$/.test(phone) ? phone : null
}
