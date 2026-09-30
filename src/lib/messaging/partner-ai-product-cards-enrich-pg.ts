import {
  fetchPartnerInventoryRowByProductUrlNormKeyFromPg,
} from '@/lib/db/messaging-partner-inventory-pg'
import type { PartnerAiProductCard } from '@/lib/messaging/partner-ai-product-cards'
import { catalogContentId } from '@/lib/messaging/catalog-content-id'

/**
 * Gắn `product_video_url` và `inventory_id` từ kho (theo URL trang SP đã chuẩn hoá) — không phụ thuộc LLM.
 * `inventory_id` dùng cho «Tư vấn» (neo thẳng dòng kho, không embed lại ảnh thẻ).
 */
export async function enrichPartnerAiProductCardsWithInventoryVideoFromPg(
  partnerId: string,
  cards: PartnerAiProductCard[]
): Promise<PartnerAiProductCard[]> {
  const out: PartnerAiProductCard[] = []
  for (const c of cards) {
    const pu = (c.product_url ?? '').trim()
    if (!pu) {
      out.push(c)
      continue
    }
    try {
      const row = await fetchPartnerInventoryRowByProductUrlNormKeyFromPg(partnerId, pu)
      if (!row) {
        out.push(c)
        continue
      }
      const id = row.id?.trim()
      const vid = (row.product_video_url ?? '').trim()
      const contentId = catalogContentId({ remarketingId: row.remarketing_id, inventoryId: id })
      const withId = id ? { ...c, inventory_id: id } : c
      const withRemarketing =
        contentId && id && contentId !== id ? { ...withId, remarketing_id: contentId } : withId
      if (vid && /^https?:\/\//i.test(vid)) {
        out.push({ ...withRemarketing, product_video_url: vid })
        continue
      }
      out.push(withRemarketing)
      continue
    } catch {
      /* giữ card gốc */
    }
    out.push(c)
  }
  return out
}
