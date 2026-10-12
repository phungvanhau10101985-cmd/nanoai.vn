import { upsertConsultedProductKeyForConversationFromPg } from '@/lib/db/customer-care-pg'
import { fetchPartnerInventoryRowByProductUrlFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import { getPublicAppUrlForServer } from '@/lib/auth/public-app-url'
import { normalizeProductUrlKey } from '@/lib/messaging/normalize-product-url-key'
import type { PartnerAiProductCard } from '@/lib/messaging/partner-ai-product-cards'

export type ItFeatureProductContext = {
  inventory_id: string
  sku: string
  name: string
  description: string
  consult_note: string
  price_hint: string
  product_url: string
  image_url: string
  features: string[]
}

function featureLines(raw: unknown): string[] {
  const value = typeof raw === 'string' ? safeJson(raw) : raw
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item ?? '').trim()).filter(Boolean).slice(0, 12)
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function featureUrls(href: string): string[] {
  const raw = href.trim()
  const origin = getPublicAppUrlForServer().replace(/\/$/, '')
  const path = raw.startsWith('http')
    ? (() => {
        try {
          return new URL(raw).pathname
        } catch {
          return raw
        }
      })()
    : raw.startsWith('/')
      ? raw
      : `/${raw}`
  const absolute = `${origin}${path}`
  const catalog = `https://nanoai.vn${path}`
  return [...new Set([absolute, catalog, raw, path].map((item) => item.trim()).filter(Boolean))]
}

/** Sản phẩm kho đúng href tính năng. Tin chat nhận cả thẻ sản phẩm và nút mở. */
export async function loadItFeatureProductContext(input: {
  partnerId: string
  conversationId: string
  sourceMessageId: string
  href: string
  /** Menu nhiều tính năng không ghim một sản phẩm đã tư vấn. */
  pinConsulted?: boolean
}): Promise<{ card: PartnerAiProductCard; product: ItFeatureProductContext } | null> {
  let row: Awaited<ReturnType<typeof fetchPartnerInventoryRowByProductUrlFromPg>> = null
  for (const url of featureUrls(input.href)) {
    row = await fetchPartnerInventoryRowByProductUrlFromPg(input.partnerId, url)
    if (row) break
  }
  if (!row?.id || !row.product_url || !row.image_url || !row.name) return null
  const product: ItFeatureProductContext = {
    inventory_id: row.id,
    sku: String(row.sku ?? '').trim(),
    name: row.name.trim(),
    description: String(row.description ?? '').trim(),
    consult_note: String(row.consult_note ?? '').trim(),
    price_hint: String(row.price_hint ?? '').trim(),
    product_url: row.product_url.trim(),
    image_url: row.image_url.trim(),
    features: featureLines((row as { features_json?: unknown }).features_json),
  }
  const card: PartnerAiProductCard = {
    name: product.name,
    image_url: product.image_url,
    product_url: product.product_url,
    ...(product.price_hint ? { price_hint: product.price_hint } : {}),
    ...(product.sku ? { sku: product.sku } : {}),
    inventory_id: product.inventory_id,
  }
  const key = normalizeProductUrlKey(product.product_url)
  if (key && input.pinConsulted !== false) {
    await upsertConsultedProductKeyForConversationFromPg(input.conversationId, input.sourceMessageId, key)
  }
  return { card, product }
}

export async function loadStudyHelpProductCards(input: {
  partnerId: string
  conversationId: string
  sourceMessageId: string
  hrefs: string[]
}): Promise<PartnerAiProductCard[]> {
  const cards: PartnerAiProductCard[] = []
  for (const href of input.hrefs) {
    const ctx = await loadItFeatureProductContext({
      partnerId: input.partnerId,
      conversationId: input.conversationId,
      sourceMessageId: input.sourceMessageId,
      href,
      pinConsulted: false,
    })
    if (ctx) cards.push(ctx.card)
  }
  return cards
}
