import type { PartnerAiProductCard } from '@/lib/messaging/partner-ai-product-cards'
import { asPartnerProductCard, sanitizeHeadlessCartItems } from '@/lib/messaging/partner-headless-cart-utils'
import { shopCardDisplaySrc } from '@/lib/partner-website/shop/inventory-shop-detail'

export type SiteCartLine = {
  id: string
  card: PartnerAiProductCard
  quantity: number
  color: string
  size: string
  note: string
  variantLineImages?: string[]
}

export function cartLineMergeKey(card: PartnerAiProductCard, color: string, size: string): string {
  const pu = (card.product_url ?? '').trim().toLowerCase()
  return `${pu}|${color.trim().toLowerCase()}|${size.trim().toLowerCase()}`
}

export function mergeSiteCartLine(items: SiteCartLine[], line: SiteCartLine): SiteCartLine[] {
  const key = cartLineMergeKey(line.card, line.color, line.size)
  const idx = items.findIndex((x) => cartLineMergeKey(x.card, x.color, x.size) === key)
  const next = [...items]
  if (idx >= 0) {
    next[idx] = {
      ...next[idx],
      quantity: Math.min(99, next[idx].quantity + line.quantity),
      note: line.note || next[idx].note,
      variantLineImages: line.variantLineImages ?? next[idx].variantLineImages,
    }
  } else {
    next.push(line)
  }
  return next
}

export function parseVndFromPriceHint(priceHint: string | undefined): number {
  if (!priceHint) return 0
  const digits = priceHint.replace(/[^\d]/g, '')
  const n = Number(digits)
  return Number.isFinite(n) ? n : 0
}

export function formatVnd(amount: number): string {
  if (amount <= 0) return '—'
  return `${new Intl.NumberFormat('vi-VN').format(amount)}đ`
}

function slimCartCardImage(card: PartnerAiProductCard): PartnerAiProductCard {
  const imageUrl = shopCardDisplaySrc(card.image_url) || card.image_url
  return {
    name: card.name,
    image_url: imageUrl,
    product_url: card.product_url,
    ...(card.price_hint ? { price_hint: card.price_hint } : {}),
    ...(card.sku ? { sku: card.sku } : {}),
    ...(card.inventory_id ? { inventory_id: card.inventory_id } : {}),
  }
}

function slimVariantLineImages(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const urls = raw
    .filter((value): value is string => typeof value === 'string' && /^https?:\/\//i.test(value.trim()))
    .map((value) => {
      const url = value.trim().slice(0, 1000)
      return shopCardDisplaySrc(url) || url
    })
    .filter(Boolean)
    .slice(0, 2)
  return urls.length ? urls : undefined
}

/** Storefront GET/SSR — card display size, no leftover PDP fields. */
export function parseSiteCartLines(raw: unknown): SiteCartLine[] {
  const sanitized = sanitizeHeadlessCartItems(raw)
  if (!Array.isArray(sanitized)) return []
  const out: SiteCartLine[] = []
  for (const item of sanitized) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const row = item as Record<string, unknown>
    const card = asPartnerProductCard(row.card)
    if (!card) continue
    const variantLineImages = slimVariantLineImages(row.variantLineImages)
    out.push({
      id: typeof row.id === 'string' && row.id.trim() ? row.id.trim().slice(0, 120) : '',
      card: slimCartCardImage(card),
      quantity: Math.max(1, Math.min(99, Math.floor(Number(row.quantity) || 1))),
      color: typeof row.color === 'string' ? row.color.trim().slice(0, 240) : '',
      size: typeof row.size === 'string' ? row.size.trim().slice(0, 120) : '',
      note: typeof row.note === 'string' ? row.note.trim().slice(0, 500) : '',
      ...(variantLineImages ? { variantLineImages } : {}),
    })
  }
  return out
}

export function cartLinesQuantity(items: SiteCartLine[]): number {
  return items.reduce((sum, item) => sum + Math.max(1, Number(item.quantity) || 1), 0)
}

export function cartLinesSignature(items: SiteCartLine[]): string {
  return items
    .map((item) => `${item.id}:${item.quantity}:${item.color}:${item.size}`)
    .join('|')
}
