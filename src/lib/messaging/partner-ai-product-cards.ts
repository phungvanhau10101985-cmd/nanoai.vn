import type { Json } from '@/types/database.types'

export type PartnerAiProductCard = {
  name: string
  image_url: string
  product_url: string
  price_hint?: string
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
  return price_hint
    ? { name, image_url, product_url, price_hint }
    : { name, image_url, product_url }
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
      if (products.length >= 4) break
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
  if (o.source !== 'ai_llm') return []
  const arr = o.ai_product_cards
  if (!Array.isArray(arr)) return []
  const products: PartnerAiProductCard[] = []
  for (const item of arr) {
    const c = sanitizeProductCard(item)
    if (c) products.push(c)
    if (products.length >= 4) break
  }
  return products
}
