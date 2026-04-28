import type { Database } from '@/types/database.types'
import {
  fetchConsultedProductUrlKeysByRecencyFromPg,
  fetchCustomerCareMessagePayloadsDescFromPg,
} from '@/lib/db/customer-care-pg'
import {
  fetchPartnerInventoryRowByIdForPartnerFromPg,
  fetchPartnerInventoryRowByProductUrlNormKeyFromPg,
} from '@/lib/db/messaging-partner-inventory-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { normalizeProductUrlKey } from '@/lib/messaging/normalize-product-url-key'
import {
  PARTNER_AI_PURCHASE_PICK_LIST_CARD_CAP,
  type PartnerAiProductCard,
} from '@/lib/messaging/partner-ai-product-cards'
import { enrichPartnerAiProductCardsWithInventoryVideoFromPg } from '@/lib/messaging/partner-ai-product-cards-enrich-pg'
import type { Json } from '@/types/database.types'

type InvRow = Database['public']['Tables']['messaging_partner_inventory']['Row']

const INV_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type ProductRef = { inv?: string; urlKey?: string }

function scanProductItemInto(item: unknown, out: ProductRef[]): void {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return
  const r = item as Record<string, unknown>
  const invRaw =
    typeof r.inventory_id === 'string'
      ? r.inventory_id.trim()
      : typeof r.inventoryId === 'string'
        ? r.inventoryId.trim()
        : ''
  if (invRaw && INV_ID_RE.test(invRaw)) {
    out.push({ inv: invRaw })
    return
  }
  const pu = typeof r.product_url === 'string' ? r.product_url.trim() : ''
  if (pu && /^https?:\/\//i.test(pu)) {
    const k = normalizeProductUrlKey(pu)
    if (k) out.push({ urlKey: k })
  }
}

/** Thứ tự trong một tin: thẻ AI → gợi ý ảnh → JSON products (nếu có) → page_context. */
function extractProductRefsFromPayload(raw: Json | null): ProductRef[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
  const o = raw as Record<string, unknown>
  const out: ProductRef[] = []
  for (const key of ['ai_product_cards', 'vision_candidates', 'products'] as const) {
    const arr = o[key]
    if (Array.isArray(arr)) {
      for (const x of arr) scanProductItemInto(x, out)
    }
  }
  const pc = o.page_context
  if (pc && typeof pc === 'object' && !Array.isArray(pc)) {
    const p = pc as Record<string, unknown>
    const iid = typeof p.inventory_id === 'string' ? p.inventory_id.trim() : ''
    if (iid && INV_ID_RE.test(iid)) out.push({ inv: iid })
    const pu = typeof p.product_url === 'string' ? p.product_url.trim() : ''
    if (pu && /^https?:\/\//i.test(pu)) {
      const k = normalizeProductUrlKey(pu)
      if (k) out.push({ urlKey: k })
    }
  }
  return out
}

function inventoryRowToCard(row: InvRow): PartnerAiProductCard | null {
  const name = (row.name ?? '').trim()
  const image_url = (row.image_url ?? '').trim()
  const product_url = (row.product_url ?? '').trim()
  if (!name || !/^https?:\/\//i.test(image_url) || !/^https?:\/\//i.test(product_url)) return null
  const price_hint = (row.price_hint ?? '').trim()
  const skuRaw = (row.sku ?? '').trim().slice(0, 128)
  const id = row.id?.trim()
  const base: PartnerAiProductCard = price_hint
    ? { name, image_url, product_url, price_hint }
    : { name, image_url, product_url }
  const withSku = skuRaw ? { ...base, sku: skuRaw } : base
  const withInv =
    id && INV_ID_RE.test(id) ? { ...withSku, inventory_id: id } : withSku
  return withInv
}

/**
 * Tối đa `PARTNER_AI_PURCHASE_PICK_LIST_CARD_CAP` mẫu đã **xuất hiện trên thẻ / ngữ cảnh** trong chat (tin mới → cũ),
 * kể cả chưa bấm «Tư vấn». Nếu không trích được từ payload, fallback «đã tư vấn» trong DB.
 */
export async function buildPurchasePickListCardsFromConversation(
  partnerId: string,
  conversationId: string
): Promise<PartnerAiProductCard[]> {
  if (!isPgConfigured()) return []

  const rows = await fetchCustomerCareMessagePayloadsDescFromPg(conversationId, 500)
  const orderedRefs: ProductRef[] = []
  const seenInv = new Set<string>()
  const seenUrl = new Set<string>()

  if (rows?.length) {
    for (const row of rows) {
      for (const ref of extractProductRefsFromPayload(row.raw_payload)) {
        if (ref.inv) {
          if (seenInv.has(ref.inv)) continue
          seenInv.add(ref.inv)
          orderedRefs.push(ref)
        } else if (ref.urlKey) {
          if (seenUrl.has(ref.urlKey)) continue
          seenUrl.add(ref.urlKey)
          orderedRefs.push(ref)
        }
        if (orderedRefs.length >= PARTNER_AI_PURCHASE_PICK_LIST_CARD_CAP * 3) break
      }
      if (orderedRefs.length >= PARTNER_AI_PURCHASE_PICK_LIST_CARD_CAP * 3) break
    }
  }

  if (orderedRefs.length === 0) {
    const keys = await fetchConsultedProductUrlKeysByRecencyFromPg(
      conversationId,
      PARTNER_AI_PURCHASE_PICK_LIST_CARD_CAP
    )
    if (keys?.length) {
      for (const k of keys) {
        const t = String(k ?? '').trim()
        if (!t || seenUrl.has(t)) continue
        seenUrl.add(t)
        orderedRefs.push({ urlKey: t })
      }
    }
  }

  if (!orderedRefs.length) return []

  const cards: PartnerAiProductCard[] = []
  const resolvedInv = new Set<string>()

  for (const ref of orderedRefs) {
    let invRow: InvRow | null = null
    if (ref.inv) {
      invRow = await fetchPartnerInventoryRowByIdForPartnerFromPg(partnerId, ref.inv)
    } else if (ref.urlKey) {
      invRow = await fetchPartnerInventoryRowByProductUrlNormKeyFromPg(partnerId, ref.urlKey)
    }
    if (!invRow) continue
    const rid = invRow.id?.trim()
    if (!rid || resolvedInv.has(rid)) continue
    resolvedInv.add(rid)
    const c = inventoryRowToCard(invRow)
    if (c) cards.push(c)
    if (cards.length >= PARTNER_AI_PURCHASE_PICK_LIST_CARD_CAP) break
  }

  if (!cards.length) return []
  return enrichPartnerAiProductCardsWithInventoryVideoFromPg(partnerId, cards)
}

export function purchasePickListMessageBody(uiLocale: string | null | undefined): string {
  const loc = String(uiLocale ?? '')
    .trim()
    .toLowerCase()
    .slice(0, 8)
  if (loc.startsWith('en')) {
    return 'Please tap **Buy** on the product card you want to order, or **Consult** if you need more help.'
  }
  if (loc.startsWith('zh') || loc === 'ch') {
    return '请在您要下单的商品卡片上点击**购买**；如需更多帮助可点**咨询**。'
  }
  if (loc.startsWith('ja')) {
    return 'ご注文したい商品カードの**購入**をタップしてください。詳しくは**相談**もご利用ください。'
  }
  if (loc.startsWith('ko')) {
    return '주문하실 상품 카드에서 **구매**를 눌러 주세요. 더 필요하시면 **상담**을 이용해 주세요.'
  }
  return 'Dạ, anh/chị vui lòng bấm **Mua** trên thẻ sản phẩm mình muốn đặt, hoặc bấm **Tư vấn** nếu cần hỗ trợ thêm ạ.'
}
