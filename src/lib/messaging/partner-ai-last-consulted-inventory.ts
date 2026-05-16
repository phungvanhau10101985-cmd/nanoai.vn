import type { Database, Json } from '@/types/database.types'
import {
  fetchCustomerCareTranscriptLinesFromPg,
  fetchLatestConsultedProductUrlKeyForConversationFromPg,
  fetchOutboundPayloadsAndBodiesNewestFirstPg,
} from '@/lib/db/customer-care-pg'
import {
  fetchPartnerInventoryRowByComparableSkuFromPg,
  fetchPartnerInventoryRowByIdForPartnerFromPg,
  fetchPartnerInventoryRowByImageUrlFromPg,
  fetchPartnerInventoryRowByProductUrlNormKeyFromPg,
} from '@/lib/db/messaging-partner-inventory-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { aiProductCardsFromPayload, type PartnerAiProductCard } from '@/lib/messaging/partner-ai-product-cards'
import { extractExplicitSkuCandidates } from '@/lib/messaging/partner-inventory-ai-search'

type InvRow = Database['public']['Tables']['messaging_partner_inventory']['Row']

function normSkuComparable(raw: string | null | undefined): string {
  return (raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s._-]+/g, '')
}

/**
 * Khớp dòng kho từ thẻ AI: SKU → ảnh (đủ biến thể URL) → trang SP (normalize key).
 * Trước đây chỉ SKU + ảnh trùng tuyệt đối — hay lệch query string / thiếu sku trên JSON.
 */
async function fetchInventoryRowFromAiProductCard(
  partnerId: string,
  card: PartnerAiProductCard
): Promise<InvRow | null> {
  const sku = card.sku?.trim()
  if (sku) {
    const row = await fetchPartnerInventoryRowByComparableSkuFromPg(partnerId, sku)
    if (row) return row
  }
  const iu = card.image_url?.trim()
  if (iu && /^https?:\/\//i.test(iu)) {
    const variants = [iu, iu.split('?')[0]].filter((u, idx, a) => u && a.indexOf(u) === idx)
    for (const u of variants) {
      const row = await fetchPartnerInventoryRowByImageUrlFromPg(partnerId, u)
      if (row) return row
    }
  }
  const pu = card.product_url?.trim()
  if (pu && /^https?:\/\//i.test(pu)) {
    const row = await fetchPartnerInventoryRowByProductUrlNormKeyFromPg(partnerId, pu)
    if (row) return row
  }
  return null
}

async function fetchInventoryRowFromInboundPageContext(
  partnerId: string,
  rawPayload: unknown
): Promise<InvRow | null> {
  if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) return null
  const pc = (rawPayload as { page_context?: unknown }).page_context
  if (!pc || typeof pc !== 'object' || Array.isArray(pc)) return null
  const p = pc as Record<string, unknown>
  const source = typeof p.source === 'string' ? p.source.trim() : ''
  const trustedSource = source === 'widget_page' || source === 'product_card_consult' || source === 'image_sku_match'
  if (!trustedSource) return null

  const inv = typeof p.inventory_id === 'string' ? p.inventory_id.trim() : ''
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(inv)) {
    const row = await fetchPartnerInventoryRowByIdForPartnerFromPg(partnerId, inv)
    if (row) return row
  }

  const sku = typeof p.sku === 'string' ? p.sku.trim() : ''
  if (sku.length >= 2) {
    const row = await fetchPartnerInventoryRowByComparableSkuFromPg(partnerId, sku)
    if (row) return row
  }

  const productUrl = typeof p.product_url === 'string' ? p.product_url.trim() : ''
  if (productUrl && /^https?:\/\//i.test(productUrl)) {
    const row = await fetchPartnerInventoryRowByProductUrlNormKeyFromPg(partnerId, productUrl)
    if (row) return row
  }

  return null
}

async function fetchInventoryRowFromOutboundProductAdvice(
  partnerId: string,
  rawPayload: Json | null | undefined,
  body: string
): Promise<InvRow | null> {
  const cards = rawPayload ? aiProductCardsFromPayload(rawPayload) : []
  const bodySkuTokens = extractExplicitSkuCandidates(body)

  if (cards.length > 1) {
    if (bodySkuTokens.length) {
      for (const tok of bodySkuTokens) {
        const row = await fetchPartnerInventoryRowByComparableSkuFromPg(partnerId, tok)
        if (row) return row
      }
      for (const tok of bodySkuTokens) {
        const nt = normSkuComparable(tok)
        const matched = cards.find((c) => normSkuComparable(c.sku) === nt && nt.length > 0)
        if (matched) {
          const row = await fetchInventoryRowFromAiProductCard(partnerId, matched)
          if (row) return row
        }
      }
    }
    return null
  }

  if (cards.length === 1) {
    const row = await fetchInventoryRowFromAiProductCard(partnerId, cards[0])
    if (row) return row
  }

  for (const tok of bodySkuTokens) {
    const row = await fetchPartnerInventoryRowByComparableSkuFromPg(partnerId, tok)
    if (row) return row
  }

  return null
}

/**
 * Mặt hàng đang tư vấn: ưu tiên URL khách vừa bấm «Tư vấn» (bảng consulted_products),
 * rồi inbound có `page_context` từ link/trang SP (`widget_page` / thẻ / ảnh khớp SKU),
 * sau đó tin Shop/AI gần nhất. **Carousel nhiều thẻ:** không lấy `cards[0]` — ưu tiên mã trong **body**
 * (vd. «mã B4669» là SP đang bàn; thẻ đầu carousel có thể là mẫu khác).
 */
export async function fetchLastConsultedInventoryRowFromConversationPg(
  partnerId: string,
  conversationId: string
): Promise<InvRow | null> {
  if (!isPgConfigured()) return null
  try {
    const consultedKey = await fetchLatestConsultedProductUrlKeyForConversationFromPg(conversationId)
    if (consultedKey) {
      const fromPick = await fetchPartnerInventoryRowByProductUrlNormKeyFromPg(partnerId, consultedKey)
      if (fromPick) return fromPick
    }

    const tl = await fetchCustomerCareTranscriptLinesFromPg(conversationId, 60)
    if (tl?.length) {
      for (let i = tl.length - 1; i >= 0; i--) {
        const m = tl[i]
        const row =
          m.direction === 'inbound'
            ? await fetchInventoryRowFromInboundPageContext(partnerId, m.raw_payload)
            : await fetchInventoryRowFromOutboundProductAdvice(partnerId, m.raw_payload, m.body)
        if (row) return row
      }
    }

    const rows = await fetchOutboundPayloadsAndBodiesNewestFirstPg(conversationId, 60)
    for (const { raw_payload, body } of rows) {
      const cards = raw_payload ? aiProductCardsFromPayload(raw_payload) : []
      const bodySkuTokens = extractExplicitSkuCandidates(body)

      if (cards.length > 1) {
        if (bodySkuTokens.length) {
          for (const tok of bodySkuTokens) {
            const row = await fetchPartnerInventoryRowByComparableSkuFromPg(partnerId, tok)
            if (row) return row
          }
          for (const tok of bodySkuTokens) {
            const nt = normSkuComparable(tok)
            const matched = cards.find((c) => normSkuComparable(c.sku) === nt && nt.length > 0)
            if (matched) {
              const row = await fetchInventoryRowFromAiProductCard(partnerId, matched)
              if (row) return row
            }
          }
        }
        continue
      }

      if (cards.length === 1) {
        const row = await fetchInventoryRowFromAiProductCard(partnerId, cards[0])
        if (row) return row
      }

      for (const tok of bodySkuTokens) {
        const row = await fetchPartnerInventoryRowByComparableSkuFromPg(partnerId, tok)
        if (row) return row
      }
    }

    /** Fallback: đọc transcript (Shop mới nhất trước) — khi payload thẻ lỗi nhưng body vẫn có «mã B4669». */
    if (tl?.length) {
      for (let i = tl.length - 1; i >= 0; i--) {
        const m = tl[i]
        if (m.direction !== 'outbound') continue
        for (const tok of extractExplicitSkuCandidates(m.body)) {
          const row = await fetchPartnerInventoryRowByComparableSkuFromPg(partnerId, tok)
          if (row) return row
        }
      }
    }
  } catch (e) {
    console.warn('[partner-ai-last-consulted-inventory]', e)
  }
  return null
}
