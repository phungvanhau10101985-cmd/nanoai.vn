import type { Database } from '@/types/database.types'
import { fetchOutboundRawPayloadsNewestFirstPg } from '@/lib/db/customer-care-pg'
import {
  fetchPartnerInventoryRowByComparableSkuFromPg,
  fetchPartnerInventoryRowByImageUrlFromPg,
} from '@/lib/db/messaging-partner-inventory-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { aiProductCardsFromPayload } from '@/lib/messaging/partner-ai-product-cards'

type InvRow = Database['public']['Tables']['messaging_partner_inventory']['Row']

/**
 * Mặt hàng shop vừa đưa vào thẻ/carousel gần nhất (tin AI có `ai_product_cards`).
 * Dùng khi khách hỏi chung (vd. "có ảnh thực tế không") mà không nhắn lại mã — neo đúng ảnh `image_url` làm tham chiếu NanoAI.
 */
export async function fetchLastConsultedInventoryRowFromConversationPg(
  partnerId: string,
  conversationId: string
): Promise<InvRow | null> {
  if (!isPgConfigured()) return null
  try {
    const payloads = await fetchOutboundRawPayloadsNewestFirstPg(conversationId, 40)
    for (const raw of payloads) {
      const cards = aiProductCardsFromPayload(raw)
      if (!cards.length) continue
      const c = cards[0]
      const sku = c.sku?.trim()
      if (sku) {
        const row = await fetchPartnerInventoryRowByComparableSkuFromPg(partnerId, sku)
        if (row && /^https?:\/\//i.test((row.image_url ?? '').trim())) return row
      }
      const iu = c.image_url?.trim()
      if (iu) {
        const row = await fetchPartnerInventoryRowByImageUrlFromPg(partnerId, iu)
        if (row && /^https?:\/\//i.test((row.image_url ?? '').trim())) return row
      }
    }
  } catch (e) {
    console.warn('[partner-ai-last-consulted-inventory]', e)
  }
  return null
}
