import { fetchPartnerInventoryRowByProductUrlFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import type { PartnerAiProductCard } from '@/lib/messaging/partner-ai-product-cards'

/**
 * Gắn `product_video_url` từ kho (theo link trang SP) để khách xem video trên thẻ — không phụ thuộc LLM.
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
      const row = await fetchPartnerInventoryRowByProductUrlFromPg(partnerId, pu)
      const vid = (row?.product_video_url ?? '').trim()
      if (vid && /^https?:\/\//i.test(vid)) {
        out.push({ ...c, product_video_url: vid })
        continue
      }
    } catch {
      /* giữ card gốc */
    }
    out.push(c)
  }
  return out
}
