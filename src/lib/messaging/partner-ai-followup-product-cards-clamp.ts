import type { Database } from '@/types/database.types'
import type { PartnerAiProductCard } from '@/lib/messaging/partner-ai-product-cards'
import { normalizeProductUrlKey } from '@/lib/messaging/normalize-product-url-key'

type InvRow = Database['public']['Tables']['messaging_partner_inventory']['Row']

function normSku(raw: string | null | undefined): string {
  return (raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s._-]+/g, '')
}

function normImgBase(u: string): string {
  return u.trim().split('?')[0].toLowerCase()
}

function productCardMatchesInventoryRow(card: PartnerAiProductCard, row: InvRow): boolean {
  const rowSku = normSku(row.sku)
  const cSku = normSku(card.sku)
  if (rowSku && cSku && rowSku === cSku) return true

  const rowPu = normalizeProductUrlKey(row.product_url?.trim() || '')
  const cPu = normalizeProductUrlKey(card.product_url?.trim() || '')
  if (rowPu && cPu && rowPu === cPu) return true

  const ri = row.image_url?.trim()
  const ci = card.image_url?.trim()
  if (ri && ci && /^https?:\/\//i.test(ri) && /^https?:\/\//i.test(ci) && normImgBase(ri) === normImgBase(ci)) {
    return true
  }

  return false
}

/**
 * Khi đang neo «hỏi tiếp» SP vừa tư vấn: model vẫn có thể trả nhiều thẻ — chỉ giữ thẻ khớp đúng dòng kho,
 * tối đa 1 phần tử; không khớp thì trả mảng rỗng (trả lời chữ, không carousel lạ).
 */
export function clampProductCardsToLastConsultedRow(
  cards: PartnerAiProductCard[],
  row: InvRow
): PartnerAiProductCard[] {
  if (cards.length === 0) return cards
  const matched = cards.filter((c) => productCardMatchesInventoryRow(c, row))
  if (matched.length > 0) return matched.slice(0, 1)
  return []
}
