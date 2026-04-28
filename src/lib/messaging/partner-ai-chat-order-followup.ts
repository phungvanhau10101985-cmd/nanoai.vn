import type { Json } from '@/types/database.types'
import type { PartnerAiProductCard } from '@/lib/messaging/partner-ai-product-cards'
import { aiProductCardsFromPayload } from '@/lib/messaging/partner-ai-product-cards'
import { partnerAiProductCardFromInventoryRow } from '@/lib/messaging/partner-ai-followup-product-cards-clamp'
import { normalizeCustomerMessageForInventorySearch } from '@/lib/messaging/partner-inventory-ai-search'
import { fetchLatestConsultedProductUrlKeyForConversationFromPg } from '@/lib/db/customer-care-pg'
import { fetchPartnerInventoryRowByProductUrlNormKeyFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import { enrichPartnerAiProductCardsWithInventoryVideoFromPg } from '@/lib/messaging/partner-ai-product-cards-enrich-pg'
import type { WebLocale } from '@/lib/i18n/config'

/**
 * Than phiền không đặt / không checkout được **trên web hoặc online** shop ngoài chat.
 */
export function inboundTextLooksLikeCannotOrderOnWebIntent(raw: string): boolean {
  const msg = normalizeCustomerMessageForInventorySearch(raw).trim()
  if (!msg || msg.length > 2400) return false

  const webOrOnlineOutsideChat =
    /\b(web|website)\b/i.test(msg) ||
    /\bonline\b/i.test(msg) ||
    /đặt\s+hàng\s+(?:trên|ở\s+ngoài\s+)?(?:web|website|site|shop\b)/iu.test(msg)

  /** «ko đặt đc», «không đặt được trên…». */
  const lc = msg.toLowerCase()
  const frustratedCheckout =
    /(?:^|[\s,;.])(ko|không)\s+đặt/ui.test(msg) ||
    /đặt\s+[dđ](?:ct|c)(?!\p{L})/iu.test(msg) ||
    /\b(?:không|ko)\s+đặt\s+(?:được|dc\b)/iu.test(msg) ||
    /(?:checkout|đặt|order)[^.\n]{0,60}(fail|broken|lỗi|ko|không|can't|cannot)/iu.test(lc) ||
    /(?:can't|cannot)\s+order\b/i.test(lc)

  return Boolean(webOrOnlineOutsideChat && frustratedCheckout)
}

function outboundFashionProductAdviceSignals(
  direction: string,
  raw: Json | null
): boolean {
  if (direction !== 'outbound') return false
  if (aiProductCardsFromPayload(raw).length > 0) return true
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
  const src = String((raw as Record<string, unknown>).source ?? '').trim()
  return src === 'ai_llm' || src === 'gender_product_cache' || src === 'ai_purchase_pick_list'
}

/**
 * Hai tin ngay trước tin khách có **ít nhất một** tin shop chứa tư vấn SP (AI / thẻ).
 */
export function precedingPairHasFashionProductAdvice(
  ms: Array<{ direction: string; raw_payload: Json | null }> | null
): boolean {
  if (!ms || ms.length !== 2) return false
  return ms.some((m) => outboundFashionProductAdviceSignals(m.direction, m.raw_payload))
}

export async function resolveChatOrderFollowupCards(
  partnerId: string,
  conversationId: string,
  pair: Array<{ direction: string; body: string; raw_payload: Json | null }>
): Promise<PartnerAiProductCard[]> {
  const newestFirst = [...pair].reverse()
  const picked: PartnerAiProductCard[] = []
  for (const m of newestFirst) {
    if (m.direction !== 'outbound') continue
    const fromPayload = aiProductCardsFromPayload(m.raw_payload)
    if (fromPayload.length > 0) {
      picked.push(fromPayload[0])
      break
    }
  }
  if (picked.length > 0) {
    return enrichPartnerAiProductCardsWithInventoryVideoFromPg(partnerId, picked)
  }
  const fallbackKey = await fetchLatestConsultedProductUrlKeyForConversationFromPg(conversationId)
  if (!fallbackKey?.trim()) return []
  const row = await fetchPartnerInventoryRowByProductUrlNormKeyFromPg(partnerId, fallbackKey.trim())
  const c = row ? partnerAiProductCardFromInventoryRow(row) : null
  if (!c) return []
  const enriched = await enrichPartnerAiProductCardsWithInventoryVideoFromPg(partnerId, [c])
  return enriched.length ? enriched : []
}

/** Hướng dẫn mua trong chat + thẻ — trung tính (anh/chị) trước khi chỉnh theo giới tính DB. */
export function chatOrderFollowupGuideMessageNeutral(uiLocale: WebLocale | null | undefined): string {
  const loc = String(uiLocale ?? '')
    .trim()
    .toLowerCase()
    .slice(0, 8)
  if (loc.startsWith('en')) {
    return 'You can buy right here in this chat. Tap **Buy now** on the product card below and complete your order.'
  }
  if (loc.startsWith('zh') || loc === 'ch') {
    return '您可以直接在本对话框内购买。**立即购买** 请点卡片上的按钮并完成下单即可。'
  }
  if (loc.startsWith('ja')) {
    return 'チャット画面のままでご購入いただけます。下の商品カードから**今すぐ購入**をタップしてご注文に進んでください。'
  }
  if (loc.startsWith('ko')) {
    return '채팅에서 바로 구매할 수 있어요. 아래 상품 카드에서 **바로구매**를 누르고 주문을 완료해 주세요.'
  }
  return 'Anh/chị có thể mua hàng ngay trong chat này ạ. Anh/chị bấm **Mua ngay** trên thẻ và lên đơn nhé.'
}
