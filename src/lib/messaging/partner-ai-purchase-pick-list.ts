import type { Database } from '@/types/database.types'
import { fetchConsultedProductUrlKeysByRecencyFromPg } from '@/lib/db/customer-care-pg'
import { fetchPartnerInventoryRowByProductUrlNormKeyFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import { isPgConfigured } from '@/lib/db/pool'
import {
  PARTNER_AI_PRODUCT_CARDS_DISPLAY_MAX,
  type PartnerAiProductCard,
} from '@/lib/messaging/partner-ai-product-cards'
import { enrichPartnerAiProductCardsWithInventoryVideoFromPg } from '@/lib/messaging/partner-ai-product-cards-enrich-pg'

type InvRow = Database['public']['Tables']['messaging_partner_inventory']['Row']

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
    id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
      ? { ...withSku, inventory_id: id }
      : withSku
  return withInv
}

/**
 * Tối đa `PARTNER_AI_PRODUCT_CARDS_DISPLAY_MAX` mẫu đã bấm «Tư vấn», **mới nhất trước**.
 */
export async function buildPurchasePickListCardsFromConversation(
  partnerId: string,
  conversationId: string
): Promise<PartnerAiProductCard[]> {
  if (!isPgConfigured()) return []
  const keys = await fetchConsultedProductUrlKeysByRecencyFromPg(
    conversationId,
    PARTNER_AI_PRODUCT_CARDS_DISPLAY_MAX
  )
  if (!keys?.length) return []

  const seen = new Set<string>()
  const cards: PartnerAiProductCard[] = []
  for (const k of keys) {
    const row = await fetchPartnerInventoryRowByProductUrlNormKeyFromPg(partnerId, k)
    if (!row) continue
    const rid = row.id?.trim()
    if (rid && seen.has(rid)) continue
    if (rid) seen.add(rid)
    const c = inventoryRowToCard(row)
    if (c) cards.push(c)
    if (cards.length >= PARTNER_AI_PRODUCT_CARDS_DISPLAY_MAX) break
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
    return 'Please tap **Buy** on the product card you want to order. Below are up to 10 items we recently showed you (newest first).'
  }
  if (loc.startsWith('zh') || loc === 'ch') {
    return '请在您要下单的商品卡片上点击**购买**。以下最多 10 款为近期向您展示的商品（最新的在前）。'
  }
  if (loc.startsWith('ja')) {
    return 'ご注文したい商品カードの**購入**をタップしてください。直近にご案内した商品を最大10点、新しい順に並べています。'
  }
  if (loc.startsWith('ko')) {
    return '주문하실 상품 카드에서 **구매**를 눌러 주세요. 아래는 최근 안내드린 상품입니다(최신순, 최대 10개).'
  }
  return 'Dạ, anh/chị vui lòng bấm **Mua** trên thẻ sản phẩm mình muốn đặt. Dưới đây là tối đa 10 mẫu shop đã tư vấn (mới xem gần nhất trước).'
}
