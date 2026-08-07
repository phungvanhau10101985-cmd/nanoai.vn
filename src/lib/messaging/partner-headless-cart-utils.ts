import type { Json } from '@/types/database.types'
import type { PartnerAiProductCard } from '@/lib/messaging/partner-ai-product-cards'

const CUSTOMER_REF_RE = /^[a-zA-Z0-9._-]{1,120}$/

export function parseHeadlessCustomerRef(raw: string | null | undefined): string | null {
  const t = String(raw ?? '').trim()
  if (!CUSTOMER_REF_RE.test(t)) return null
  return t
}

export function headlessCustomerRefFromRequest(req: Request, url: URL): string | null {
  const fromQuery = url.searchParams.get('customer_ref')
  const fromHeader = req.headers.get('x-customer-ref')
  return parseHeadlessCustomerRef(fromHeader ?? fromQuery)
}

export function headlessAccountKey(customerRef: string): string {
  return `headless:${customerRef}`
}

export function headlessExternalThreadId(customerRef: string): string {
  return `headless:${customerRef}`
}

export function asPartnerProductCard(x: unknown): PartnerAiProductCard | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null
  const o = x as Record<string, unknown>
  const name = typeof o.name === 'string' ? o.name.trim() : ''
  const image_url = typeof o.image_url === 'string' ? o.image_url.trim() : ''
  const product_url = typeof o.product_url === 'string' ? o.product_url.trim() : ''
  const price_hint = typeof o.price_hint === 'string' ? o.price_hint.trim() : ''
  const sku = typeof o.sku === 'string' ? o.sku.trim().slice(0, 128) : ''
  const inventoryId = typeof o.inventory_id === 'string' ? o.inventory_id.trim() : ''
  if (!name || !/^https?:\/\//i.test(image_url) || !/^https?:\/\//i.test(product_url)) return null
  const base = price_hint ? { name, image_url, product_url, price_hint } : { name, image_url, product_url }
  const withSku = sku ? { ...base, sku } : base
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(inventoryId)
    ? { ...withSku, inventory_id: inventoryId }
    : withSku
}

export function sanitizeHeadlessCartItems(raw: unknown): Json {
  if (!Array.isArray(raw)) return []
  const out: unknown[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const o = item as Record<string, unknown>
    const card = asPartnerProductCard(o.card)
    if (!card) continue
    out.push({
      id: typeof o.id === 'string' && o.id.trim() ? o.id.trim().slice(0, 120) : crypto.randomUUID(),
      card,
      quantity: Math.max(1, Math.min(99, Math.floor(Number(o.quantity) || 1))),
      color: typeof o.color === 'string' ? o.color.trim().slice(0, 240) : '',
      size: typeof o.size === 'string' ? o.size.trim().slice(0, 120) : '',
      note: typeof o.note === 'string' ? o.note.trim().slice(0, 500) : '',
      variantLineImages: Array.isArray(o.variantLineImages)
        ? o.variantLineImages
            .filter((u): u is string => typeof u === 'string' && /^https?:\/\//i.test(u.trim()))
            .map((u) => u.trim().slice(0, 1000))
            .slice(0, 24)
        : undefined,
    })
    if (out.length >= 50) break
  }
  return out as Json
}

export type HeadlessCartCheckoutLine = {
  card: PartnerAiProductCard
  color: string
  size: string
  quantity: number
  note: string
  variantLineImages?: string[]
}

export function parseHeadlessCartCheckoutLines(raw: unknown): HeadlessCartCheckoutLine[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((x): HeadlessCartCheckoutLine | null => {
      if (!x || typeof x !== 'object' || Array.isArray(x)) return null
      const o = x as Record<string, unknown>
      const card = asPartnerProductCard(o.card)
      if (!card) return null
      const variantLineImages = Array.isArray(o.variantLineImages)
        ? o.variantLineImages.filter((v): v is string => typeof v === 'string').slice(0, 24)
        : undefined
      return {
        card,
        color: String(o.color ?? '').trim(),
        size: String(o.size ?? '').trim(),
        quantity: Math.max(1, Math.min(99, Math.floor(Number(o.quantity) || 1))),
        note: String(o.note ?? '').trim(),
        ...(variantLineImages ? { variantLineImages } : {}),
      }
    })
    .filter((x): x is HeadlessCartCheckoutLine => Boolean(x))
    .slice(0, 20)
}
