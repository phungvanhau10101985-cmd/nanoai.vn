import { upsertConsultedProductKeyForConversationFromPg } from '@/lib/db/customer-care-pg'
import { fetchPartnerInventoryRowByProductUrlFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import { getPublicAppUrlForServer } from '@/lib/auth/public-app-url'
import { normalizeProductUrlKey } from '@/lib/messaging/normalize-product-url-key'

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

export type ItFeatureConsultCopy = {
  /** Có `{features}`. */
  includes: string
  tap: string
}

function stripFeatureUrls(text: string): string {
  return text
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/mở công cụ:\s*/gi, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function productConsultText(product: ItFeatureProductContext): string {
  const note = stripFeatureUrls(product.consult_note)
  if (note) return note
  const desc = stripFeatureUrls(product.description).split(/\n\n+/)[0]?.trim() ?? ''
  if (desc) return desc
  return [product.name.trim(), product.price_hint.trim()].filter(Boolean).join(' — ')
}

/**
 * Một tính năng: ghi chú kho + danh sách tính năng + nhắc bấm nút.
 * Nhiều tính năng: câu dẫn rồi mỗi dòng một sản phẩm có trong kho. Không có kho thì giữ câu dẫn.
 */
export function composeItFeatureConsultMessage(input: {
  products: ItFeatureProductContext[]
  fallback: string
  many: boolean
  copy: ItFeatureConsultCopy
}): string {
  const fallback = input.fallback.trim()
  const products = input.products.filter((product) => productConsultText(product))
  if (!products.length) return fallback
  if (!input.many) {
    const product = products[0]
    const features = product.features.map((item) => item.trim()).filter(Boolean)
    const includes = features.length
      ? input.copy.includes.replaceAll('{features}', features.join('; ')).trim()
      : ''
    return [productConsultText(product), includes, input.copy.tap.trim()].filter(Boolean).join('\n')
  }
  const lines = products.map((product) => {
    const text = productConsultText(product)
    const name = product.name.trim()
    if (!name) return text
    const folded = text.toLowerCase()
    if (folded.startsWith(name.toLowerCase())) return text
    return `${name}: ${text}`
  })
  return [fallback, ...lines].filter(Boolean).join('\n\n')
}

/** Sản phẩm kho đúng href tính năng. Tin chat dùng chữ tư vấn và nút mở, không thẻ. */
export async function loadItFeatureProductContext(input: {
  partnerId: string
  conversationId: string
  sourceMessageId: string
  href: string
  /** Menu nhiều tính năng không ghim một sản phẩm đã tư vấn. */
  pinConsulted?: boolean
}): Promise<ItFeatureProductContext | null> {
  let row: Awaited<ReturnType<typeof fetchPartnerInventoryRowByProductUrlFromPg>> = null
  for (const url of featureUrls(input.href)) {
    row = await fetchPartnerInventoryRowByProductUrlFromPg(input.partnerId, url)
    if (row) break
  }
  if (!row?.id || !row.product_url || !row.name) return null
  const product: ItFeatureProductContext = {
    inventory_id: row.id,
    sku: String(row.sku ?? '').trim(),
    name: row.name.trim(),
    description: String(row.description ?? '').trim(),
    consult_note: String(row.consult_note ?? '').trim(),
    price_hint: String(row.price_hint ?? '').trim(),
    product_url: row.product_url.trim(),
    image_url: String(row.image_url ?? '').trim(),
    features: featureLines((row as { features_json?: unknown }).features_json),
  }
  const key = normalizeProductUrlKey(product.product_url)
  if (key && input.pinConsulted !== false) {
    await upsertConsultedProductKeyForConversationFromPg(input.conversationId, input.sourceMessageId, key)
  }
  return product
}

export async function loadItFeatureProducts(input: {
  partnerId: string
  conversationId: string
  sourceMessageId: string
  hrefs: string[]
}): Promise<ItFeatureProductContext[]> {
  const products: ItFeatureProductContext[] = []
  for (const href of input.hrefs) {
    const product = await loadItFeatureProductContext({
      partnerId: input.partnerId,
      conversationId: input.conversationId,
      sourceMessageId: input.sourceMessageId,
      href,
      pinConsulted: false,
    })
    if (product) products.push(product)
  }
  return products
}
