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

/** Thẻ SP từ dòng kho — dùng khi LLM không trả products hoặc clamp không khớp (tư vấn lại vẫn có 3 nút). */
export function partnerAiProductCardFromInventoryRow(row: InvRow): PartnerAiProductCard | null {
  const name = row.name.trim()
  const image_url = row.image_url.trim()
  const product_url = row.product_url.trim()
  if (!name || !/^https?:\/\//i.test(image_url) || !/^https?:\/\//i.test(product_url)) return null
  const price_hint = row.price_hint?.trim() || ''
  const sku = (row.sku ?? '').trim().slice(0, 128)
  let card: PartnerAiProductCard = price_hint
    ? { name, image_url, product_url, price_hint }
    : { name, image_url, product_url }
  if (sku) card = { ...card, sku }
  card = { ...card, inventory_id: row.id }
  const pv = (row.product_video_url ?? '').trim()
  if (pv && /^https?:\/\//i.test(pv) && pv.length <= 2048) {
    card = { ...card, product_video_url: pv }
  }
  return card
}
