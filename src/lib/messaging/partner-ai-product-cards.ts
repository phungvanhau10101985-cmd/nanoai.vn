import type { Json } from '@/types/database.types'

/** Số thẻ sản phẩm tối đa trong một tin AI (JSON `products` + carousel từ LLM). */
export const PARTNER_AI_PRODUCT_CARDS_MAX = 8

/** Số thẻ tối đa đọc từ payload / nhánh chọn mua (có thể lớn hơn giới hạn LLM). */
export const PARTNER_AI_PRODUCT_CARDS_DISPLAY_MAX = 10

/** Tin `source: ai_purchase_pick_list` — gom SP đã hiện trong chat (có thể tới 30 thẻ). */
export const PARTNER_AI_PURCHASE_PICK_LIST_CARD_CAP = 30

export type PartnerAiProductCard = {
  name: string
  image_url: string
  product_url: string
  price_hint?: string
  /** Màu + ảnh từ cột kho (JSON stock_note) — cùng schema form Mua ngay. */
  color_variants?: Array<{ name: string; img: string }>
  /** Ảnh phụ từ kho: material_detail + real_use. */
  color_image_urls?: string[]
  /** Mã kho — dùng khi khách bấm Tư vấn để gửi đúng ngữ cảnh cho AI. */
  sku?: string
  /** UUID dòng `messaging_partner_inventory` — gắn từ kho khi lưu tin; neo «Tư vấn» không cần embed lại ảnh. */
  inventory_id?: string
  /** YouTube hoặc URL video trực tiếp — từ kho hoặc JSON LLM. */
  product_video_url?: string
}

const URL_RE = /^https?:\/\//i

function sanitizeProductCard(x: unknown): PartnerAiProductCard | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null
  const o = x as Record<string, unknown>
  const name = typeof o.name === 'string' ? o.name.trim() : ''
  const image_url = typeof o.image_url === 'string' ? o.image_url.trim() : ''
  const product_url = typeof o.product_url === 'string' ? o.product_url.trim() : ''
  if (!name || !URL_RE.test(image_url) || !URL_RE.test(product_url)) return null
  const price_hint = typeof o.price_hint === 'string' ? o.price_hint.trim() : ''
  const skuRaw = typeof o.sku === 'string' ? o.sku.trim().slice(0, 128) : ''
  const sku = skuRaw.length > 0 ? skuRaw : ''
  const invIdRaw = typeof o.inventory_id === 'string' ? o.inventory_id.trim() : ''
  const inventory_id =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invIdRaw) ? invIdRaw : ''
  let product_video_url = typeof o.product_video_url === 'string' ? o.product_video_url.trim() : ''
  if (product_video_url && !URL_RE.test(product_video_url)) product_video_url = ''
  if (product_video_url.length > 2048) product_video_url = product_video_url.slice(0, 2048)

  const base: PartnerAiProductCard = price_hint
    ? { name, image_url, product_url, price_hint }
    : { name, image_url, product_url }
  const withSku = sku ? { ...base, sku } : base
  const withInv = inventory_id ? { ...withSku, inventory_id } : withSku
  return product_video_url ? { ...withInv, product_video_url } : withInv
}

/** Parse DeepSeek output: JSON with message + products, or fall back to plain text. */
export function parsePartnerAiLlmStructured(raw: string): { message: string; products: PartnerAiProductCard[] } {
  const fallbackMessage = raw.trim()
  let s = fallbackMessage
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  }
  try {
    const j = JSON.parse(s) as unknown
    if (!j || typeof j !== 'object' || Array.isArray(j)) {
      return { message: fallbackMessage, products: [] }
    }
    const o = j as Record<string, unknown>
    const message = typeof o.message === 'string' ? o.message.trim() : ''
    const arr = Array.isArray(o.products) ? o.products : []
    const products: PartnerAiProductCard[] = []
    for (const item of arr) {
      const c = sanitizeProductCard(item)
      if (c) products.push(c)
      if (products.length >= PARTNER_AI_PRODUCT_CARDS_MAX) break
    }
    if (!message && products.length === 0) {
      return { message: fallbackMessage, products: [] }
    }
    return { message: message || fallbackMessage, products }
  } catch {
    return { message: fallbackMessage, products: [] }
  }
}

/** Cards stored on outbound AI messages (validated again for display). */
export function aiProductCardsFromPayload(raw: Json | null): PartnerAiProductCard[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
  const o = raw as Record<string, unknown>
  const arr = o.ai_product_cards
  if (!Array.isArray(arr) || arr.length === 0) return []
  const source = typeof o.source === 'string' ? o.source.trim() : ''
  const cap =
    source === 'ai_purchase_pick_list' || source === 'ai_chat_order_guidance'
      ? PARTNER_AI_PURCHASE_PICK_LIST_CARD_CAP
      : PARTNER_AI_PRODUCT_CARDS_DISPLAY_MAX
  /** Có `ai_product_cards` là đủ — một số tin lưu thiếu `source: 'ai_llm'` khiến trước đây không đọc được thẻ. */
  const products: PartnerAiProductCard[] = []
  for (const item of arr) {
    const c = sanitizeProductCard(item)
    if (c) products.push(c)
    if (products.length >= cap) break
  }
  return products
}
