import type { Json } from '@/types/database.types'

/** Số thẻ sản phẩm tối đa trong một tin AI (JSON `products` + carousel từ LLM). */
export const PARTNER_AI_PRODUCT_CARDS_MAX = 20

/** Số thẻ tối đa đọc từ payload / nhánh chọn mua (có thể lớn hơn giới hạn LLM). */
export const PARTNER_AI_PRODUCT_CARDS_DISPLAY_MAX = 20

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

function stripJsonCodeFence(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
}

function extractBalancedJsonObjectCandidates(raw: string, cap = 8): string[] {
  const out: string[] = []
  const text = raw.trim()
  if (!text.includes('{')) return out

  for (let start = 0; start < text.length; start++) {
    if (text[start] !== '{') continue
    let depth = 0
    let inString = false
    let escaped = false
    for (let i = start; i < text.length; i++) {
      const ch = text[i]
      if (inString) {
        if (escaped) {
          escaped = false
          continue
        }
        if (ch === '\\') {
          escaped = true
          continue
        }
        if (ch === '"') inString = false
        continue
      }
      if (ch === '"') {
        inString = true
        continue
      }
      if (ch === '{') depth += 1
      else if (ch === '}') {
        depth -= 1
        if (depth === 0) {
          out.push(text.slice(start, i + 1).trim())
          if (out.length >= cap) return out
          break
        }
      }
    }
  }
  return out
}

function parseStructuredPartnerAiPayload(raw: string): { message: string; products: PartnerAiProductCard[] } | null {
  const candidates = new Set<string>()
  const trimmed = raw.trim()
  if (trimmed) candidates.add(trimmed)

  const unfenced = stripJsonCodeFence(trimmed)
  if (unfenced) candidates.add(unfenced)

  for (const m of trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi)) {
    const body = String(m[1] || '').trim()
    if (body) candidates.add(body)
  }

  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.add(trimmed.slice(firstBrace, lastBrace + 1).trim())
  }

  for (const candidate of extractBalancedJsonObjectCandidates(trimmed)) {
    candidates.add(candidate)
  }

  for (const candidate of candidates) {
    try {
      const j = JSON.parse(candidate) as unknown
      if (!j || typeof j !== 'object' || Array.isArray(j)) continue
      const o = j as Record<string, unknown>
      const message = typeof o.message === 'string' ? o.message.trim() : ''
      const arr = Array.isArray(o.products) ? o.products : []
      const products: PartnerAiProductCard[] = []
      for (const item of arr) {
        const c = sanitizeProductCard(item)
        if (c) products.push(c)
        if (products.length >= PARTNER_AI_PRODUCT_CARDS_MAX) break
      }
      if (!message && products.length === 0) continue
      return { message, products }
    } catch {
      continue
    }
  }
  return null
}

function decodeLooseJsonStringLiteral(raw: string): string {
  try {
    return JSON.parse(`"${raw}"`) as string
  } catch {
    return raw
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\\\/g, '\\')
      .trim()
  }
}

function extractMessageFieldFallback(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const candidates = new Set<string>()
  candidates.add(trimmed)
  const unfenced = stripJsonCodeFence(trimmed)
  if (unfenced) candidates.add(unfenced)
  for (const candidate of extractBalancedJsonObjectCandidates(trimmed)) {
    candidates.add(candidate)
  }

  for (const candidate of candidates) {
    const m = /"message"\s*:\s*"((?:\\.|[^"\\])*)"/is.exec(candidate)
    if (!m?.[1]) continue
    const decoded = decodeLooseJsonStringLiteral(m[1]).trim()
    if (decoded) return decoded
  }
  return null
}

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
  const colorVariants: Array<{ name: string; img: string }> = []
  if (Array.isArray(o.color_variants)) {
    for (const item of o.color_variants) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue
      const v = item as Record<string, unknown>
      const colorName = typeof v.name === 'string' ? v.name.trim() : ''
      const colorImg = typeof v.img === 'string' ? v.img.trim() : ''
      if (!colorName || !URL_RE.test(colorImg)) continue
      colorVariants.push({ name: colorName.slice(0, 120), img: colorImg.slice(0, 2048) })
      if (colorVariants.length >= 30) break
    }
  }
  const colorImageUrls = Array.isArray(o.color_image_urls)
    ? o.color_image_urls
        .map((u) => (typeof u === 'string' ? u.trim().slice(0, 2048) : ''))
        .filter((u) => URL_RE.test(u))
        .slice(0, 12)
    : []

  const base: PartnerAiProductCard = price_hint
    ? { name, image_url, product_url, price_hint }
    : { name, image_url, product_url }
  const withSku = sku ? { ...base, sku } : base
  const withInv = inventory_id ? { ...withSku, inventory_id } : withSku
  const withColors =
    colorVariants.length > 0 || colorImageUrls.length > 0
      ? {
          ...withInv,
          ...(colorVariants.length > 0 ? { color_variants: colorVariants } : {}),
          ...(colorImageUrls.length > 0 ? { color_image_urls: colorImageUrls } : {}),
        }
      : withInv
  return product_video_url ? { ...withColors, product_video_url } : withColors
}

/** Parse DeepSeek output: JSON with message + products, or fall back to plain text. */
export function parsePartnerAiLlmStructured(raw: string): { message: string; products: PartnerAiProductCard[] } {
  const fallbackMessage = raw.trim()
  const parsed = parseStructuredPartnerAiPayload(raw)
  if (!parsed) {
    const fallbackFromMessageField = extractMessageFieldFallback(raw)
    return { message: fallbackFromMessageField || fallbackMessage, products: [] }
  }
  return { message: parsed.message || fallbackMessage, products: parsed.products }
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
