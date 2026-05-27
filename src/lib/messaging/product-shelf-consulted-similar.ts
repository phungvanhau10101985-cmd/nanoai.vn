import type { Database } from '@/types/database.types'
import { isPgConfigured } from '@/lib/db/pool'
import { normalizeProductUrlKey } from '@/lib/messaging/normalize-product-url-key'
import { fetchRecentChatMentionedInventoryAnchorRows } from '@/lib/messaging/partner-ai-purchase-pick-list'
import { fetchInventoryRowsSimilarToAnchorProductImage } from '@/lib/messaging/partner-gemini-image-search'
import type { PartnerAiProductCard } from '@/lib/messaging/partner-ai-product-cards'

type InvRow = Database['public']['Tables']['messaging_partner_inventory']['Row']

/** Số SP nhắc trong chat gần nhất làm neo tìm tương tự. */
export const PRODUCT_SHELF_CHAT_ANCHOR_LIMIT = 5
/** @deprecated alias — giữ tương thích import cũ */
export const PRODUCT_SHELF_CONSULTED_ANCHOR_LIMIT = PRODUCT_SHELF_CHAT_ANCHOR_LIMIT
/** Mỗi neo — số dòng kho tương tự tối đa (trước gộp / xáo trộn). */
const SIMILAR_PER_ANCHOR = 12
/** Số thẻ trả về sau gộp + xáo trộn. */
export const PRODUCT_SHELF_SIMILAR_RESULT_CAP = 48

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const a = arr[i]!
    arr[i] = arr[j]!
    arr[j] = a
  }
}

function inventoryRowToProductCard(row: InvRow): PartnerAiProductCard | null {
  const name = (row.name ?? '').trim() || 'Sản phẩm'
  const image_url = (row.image_url ?? '').trim()
  const product_url = (row.product_url ?? '').trim()
  if (!/^https?:\/\//i.test(image_url) || !/^https?:\/\//i.test(product_url)) return null
  const out: PartnerAiProductCard = {
    name,
    image_url,
    product_url,
    inventory_id: row.id,
  }
  const ph = (row.price_hint ?? '').trim()
  if (ph) out.price_hint = ph
  const sku = (row.sku ?? '').trim()
  if (sku) out.sku = sku.slice(0, 128)
  return out
}

function registerAnchorExclusions(
  row: InvRow,
  excludeInvIds: Set<string>,
  excludeUrlKeys: Set<string>
): void {
  const id = row.id?.trim()
  if (id) excludeInvIds.add(id)
  const norm = normalizeProductUrlKey(row.product_url ?? '')
  if (norm) excludeUrlKeys.add(norm)
}

/**
 * Gom SP tương tự (vector ảnh kho) từ tối đa 5 mẫu **đã nhắc trong chat** gần nhất
 * (thẻ AI, gợi ý ảnh, ngữ cảnh trang — không cần bấm «Tư vấn»);
 * loại trừ mẫu neo; xáo trộn ngẫu nhiên trước khi trả về.
 */
export async function buildProductShelfSimilarToConsultedProducts(
  partnerId: string,
  conversationId: string
): Promise<PartnerAiProductCard[]> {
  if (!isPgConfigured()) return []

  const anchorRows = await fetchRecentChatMentionedInventoryAnchorRows(
    partnerId,
    conversationId,
    PRODUCT_SHELF_CHAT_ANCHOR_LIMIT
  )
  if (!anchorRows.length) return []

  const excludeInvIds = new Set<string>()
  const excludeUrlKeys = new Set<string>()
  for (const row of anchorRows) {
    registerAnchorExclusions(row, excludeInvIds, excludeUrlKeys)
  }

  shuffleInPlace(anchorRows)

  const similarBatches = await Promise.all(
    anchorRows.map((anchor) =>
      fetchInventoryRowsSimilarToAnchorProductImage(partnerId, anchor, { limit: SIMILAR_PER_ANCHOR })
    )
  )

  const merged: PartnerAiProductCard[] = []
  const seenInv = new Set<string>()
  const seenUrl = new Set<string>()

  for (const rows of similarBatches) {
    for (const row of rows) {
      const id = row.id?.trim()
      const urlKey = normalizeProductUrlKey(row.product_url ?? '')
      if (id && (excludeInvIds.has(id) || seenInv.has(id))) continue
      if (urlKey && (excludeUrlKeys.has(urlKey) || seenUrl.has(urlKey))) continue
      const card = inventoryRowToProductCard(row)
      if (!card) continue
      if (id) seenInv.add(id)
      if (urlKey) seenUrl.add(urlKey)
      merged.push(card)
    }
  }

  shuffleInPlace(merged)
  return merged.slice(0, PRODUCT_SHELF_SIMILAR_RESULT_CAP)
}
