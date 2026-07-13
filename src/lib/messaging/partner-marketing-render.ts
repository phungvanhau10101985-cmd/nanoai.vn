import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { isPgConfigured } from '@/lib/db/pool'
import type { MarketingSegmentRecipientRow } from '@/lib/db/messaging-partner-marketing-campaigns-pg'
import { collectInterestInventoryIdsForPartnerUserFromPg } from '@/lib/messaging/birthday-promo-interest-inventory-ids'
import { collectRecentInterestInventoryIdsFromConversationPg } from '@/lib/messaging/partner-ai-last-consulted-inventory'

export type MarketingRenderContext = {
  customerName: string
  shopName: string
  offerPercent: number | null
  interestBlock: string
  lastOrderSummary: string
  chatUrl: string
}

const MERGE_FIELD_RE = /\{([a-z_]+)\}/g

async function resolveCustomerDisplayName(recipient: MarketingSegmentRecipientRow): Promise<string> {
  const direct = recipient.customer_name?.trim()
  if (direct) return direct

  if (recipient.linked_user_id && isPgConfigured()) {
    try {
      const row = await pgQueryOne<{ display_name: string | null; full_name: string | null }>(
        `select coalesce(nullif(trim(display_name), ''), nullif(trim(full_name), '')) as display_name
         from public.profiles where id = $1::uuid limit 1`,
        [recipient.linked_user_id]
      )
      const n = row?.display_name?.trim()
      if (n) return n
    } catch {
      /* ignore */
    }
  }

  if (recipient.guest_account_id && isPgConfigured()) {
    try {
      const row = await pgQueryOne<{ email_raw: string | null }>(
        `select email_raw from public.messaging_guest_accounts where id = $1::uuid limit 1`,
        [recipient.guest_account_id]
      )
      const email = row?.email_raw?.trim()
      if (email) return email.split('@')[0] || email
    } catch {
      /* ignore */
    }
  }

  return 'bạn'
}

/** Gom mã kho SP khách quan tâm — ưu tiên hội thoại marketing hiện tại, rồi mới đơn/hội thoại cũ. */
async function collectMarketingInterestInventoryIds(input: {
  partnerId: string
  recipient: MarketingSegmentRecipientRow
  max: number
}): Promise<string[]> {
  const max = Math.max(1, Math.min(6, Math.floor(input.max)))
  const ids: string[] = []
  const seen = new Set<string>()
  const push = (id: string) => {
    if (!id || seen.has(id)) return
    seen.add(id)
    ids.push(id)
  }

  const fromConversation = await collectRecentInterestInventoryIdsFromConversationPg(
    input.partnerId,
    input.recipient.conversation_id,
    max
  )
  for (const id of fromConversation) push(id)

  if (ids.length < max && input.recipient.linked_user_id) {
    const fromUser = await collectInterestInventoryIdsForPartnerUserFromPg({
      partnerId: input.partnerId,
      userId: input.recipient.linked_user_id,
      limit: max,
    })
    for (const id of fromUser) {
      push(id)
      if (ids.length >= max) break
    }
  }

  return ids.slice(0, max)
}

export type MarketingInterestProduct = {
  id: string
  name: string
  sku: string | null
  imageUrl: string | null
  productUrl: string | null
  priceHint: string | null
  stockQty: number | null
  lowStock: boolean
}

/** Ngưỡng coi là «sắp hết hàng» — chỉ khi kho thật sự thấp (tránh khan hiếm giả). */
export const MARKETING_LOW_STOCK_THRESHOLD = 5

/** Danh sách SP quan tâm có cấu trúc (ảnh + link + kho) — dùng cho email card. */
export async function fetchMarketingInterestProducts(input: {
  partnerId: string
  recipient: MarketingSegmentRecipientRow
  maxProducts?: number
}): Promise<MarketingInterestProduct[]> {
  const max = Math.max(1, Math.min(4, Math.floor(input.maxProducts ?? 2)))
  if (!isPgConfigured()) return []
  const ids = await collectMarketingInterestInventoryIds({
    partnerId: input.partnerId,
    recipient: input.recipient,
    max,
  })
  if (!ids.length) return []

  try {
    const rows = await pgQuery<{
      id: string
      name: string
      sku: string | null
      image_url: string | null
      product_url: string | null
      price_hint: string | null
      stock_qty: number | null
    }>(
      `select id::text,
              coalesce(nullif(trim(name), ''), 'Sản phẩm') as name,
              nullif(trim(sku), '') as sku,
              nullif(trim(image_url), '') as image_url,
              nullif(trim(product_url), '') as product_url,
              nullif(trim(price_hint), '') as price_hint,
              stock_qty
       from public.messaging_partner_inventory
       where partner_id = $1::uuid and id = any($2::uuid[])
       order by sort_order asc`,
      [input.partnerId, ids.slice(0, max)]
    )
    const byId = new Map(rows.map((r) => [r.id, r]))
    const out: MarketingInterestProduct[] = []
    for (const id of ids) {
      const r = byId.get(id)
      if (!r) continue
      const stockQty = r.stock_qty != null ? Number(r.stock_qty) : null
      out.push({
        id: r.id,
        name: r.name,
        sku: r.sku,
        imageUrl: r.image_url,
        productUrl: r.product_url,
        priceHint: r.price_hint,
        stockQty: Number.isFinite(stockQty as number) ? (stockQty as number) : null,
        lowStock:
          stockQty != null && Number.isFinite(stockQty) && stockQty > 0 && stockQty <= MARKETING_LOW_STOCK_THRESHOLD,
      })
      if (out.length >= max) break
    }
    return out
  } catch (e) {
    console.warn('[fetchMarketingInterestProducts]', e)
    return []
  }
}

/** Sản phẩm mẫu (kho đang bật) — dùng cho email thử khi chưa có SP quan tâm thật. */
export async function fetchSampleMarketingProducts(input: {
  partnerId: string
  maxProducts?: number
}): Promise<MarketingInterestProduct[]> {
  const max = Math.max(1, Math.min(4, Math.floor(input.maxProducts ?? 2)))
  if (!isPgConfigured()) return []
  try {
    const rows = await pgQuery<{
      id: string
      name: string
      sku: string | null
      image_url: string | null
      product_url: string | null
      price_hint: string | null
      stock_qty: number | null
    }>(
      `select id::text,
              coalesce(nullif(trim(name), ''), 'Sản phẩm') as name,
              nullif(trim(sku), '') as sku,
              nullif(trim(image_url), '') as image_url,
              nullif(trim(product_url), '') as product_url,
              nullif(trim(price_hint), '') as price_hint,
              stock_qty
       from public.messaging_partner_inventory
       where partner_id = $1::uuid and coalesce(is_active, true) = true
       order by sort_order asc, created_at desc
       limit $2`,
      [input.partnerId, max]
    )
    return rows.map((r) => {
      const stockQty = r.stock_qty != null ? Number(r.stock_qty) : null
      return {
        id: r.id,
        name: r.name,
        sku: r.sku,
        imageUrl: r.image_url,
        productUrl: r.product_url,
        priceHint: r.price_hint,
        stockQty: Number.isFinite(stockQty as number) ? (stockQty as number) : null,
        lowStock:
          stockQty != null && Number.isFinite(stockQty) && stockQty > 0 && stockQty <= MARKETING_LOW_STOCK_THRESHOLD,
      }
    })
  } catch (e) {
    console.warn('[fetchSampleMarketingProducts]', e)
    return []
  }
}

async function buildInterestBlock(input: {
  partnerId: string
  recipient: MarketingSegmentRecipientRow
  maxProducts?: number
}): Promise<string> {
  const max = Math.max(1, Math.min(5, Math.floor(input.maxProducts ?? 3)))
  const ids = await collectMarketingInterestInventoryIds({
    partnerId: input.partnerId,
    recipient: input.recipient,
    max,
  })

  if (!ids.length || !isPgConfigured()) return ''

  try {
    const rows = await pgQuery<{ name: string; sku: string | null }>(
      `select coalesce(nullif(trim(name), ''), 'Sản phẩm') as name,
              nullif(trim(sku), '') as sku
       from public.messaging_partner_inventory
       where partner_id = $1::uuid and id = any($2::uuid[])
       order by sort_order asc`,
      [input.partnerId, ids.slice(0, max)]
    )
    if (!rows.length) return ''
    const lines = rows.map((r) => {
      const sku = r.sku?.trim()
      return sku ? `• ${r.name} (${sku})` : `• ${r.name}`
    })
    return ['Sản phẩm bạn đã quan tâm:', ...lines].join('\n')
  } catch {
    return ''
  }
}

async function buildLastOrderSummary(partnerId: string, conversationId: string): Promise<string> {
  if (!isPgConfigured()) return ''
  try {
    const row = await pgQueryOne<{ summary: string | null }>(
      `select coalesce(
         nullif(trim(o.product_name), ''),
         nullif(trim(i.name), ''),
         'Đơn hàng'
       ) || case when o.quantity > 1 then ' x' || o.quantity::text else '' end as summary
       from public.messaging_partner_orders o
       left join public.messaging_partner_inventory i on i.id = o.product_inventory_id
       where o.partner_id = $1::uuid and o.conversation_id = $2::uuid
       order by o.updated_at desc nulls last
       limit 1`,
      [partnerId, conversationId]
    )
    const s = row?.summary?.trim()
    return s ? `Đơn gần nhất: ${s}` : ''
  } catch {
    return ''
  }
}

export async function buildMarketingRenderContext(input: {
  partnerId: string
  shopName: string
  shopSlug: string
  offerPercent: number | null
  recipient: MarketingSegmentRecipientRow
  appOrigin: string
}): Promise<MarketingRenderContext> {
  const customerName = await resolveCustomerDisplayName(input.recipient)
  const interestBlock = await buildInterestBlock({
    partnerId: input.partnerId,
    recipient: input.recipient,
  })
  const lastOrderSummary = await buildLastOrderSummary(input.partnerId, input.recipient.conversation_id)
  const origin = input.appOrigin.replace(/\/$/, '')
  const chatUrl = `${origin}/messaging/p/${encodeURIComponent(input.shopSlug)}`

  return {
    customerName,
    shopName: input.shopName.trim() || 'Cửa hàng',
    offerPercent: input.offerPercent,
    interestBlock,
    lastOrderSummary,
    chatUrl,
  }
}

export function renderMarketingTemplate(template: string, ctx: MarketingRenderContext): string {
  const pct = ctx.offerPercent != null && ctx.offerPercent > 0 ? ctx.offerPercent : null
  const offerLine = pct ? ` — giảm ${pct}%` : ''
  const replacements: Record<string, string> = {
    customer_name: ctx.customerName,
    shop_name: ctx.shopName,
    offer_line: offerLine,
    offer_percent: pct != null ? String(pct) : '',
    interest_block: ctx.interestBlock,
    last_order_summary: ctx.lastOrderSummary,
    chat_url: ctx.chatUrl,
  }

  let out = template.replace(MERGE_FIELD_RE, (_m, key: string) => {
    return replacements[key] ?? ''
  })

  out = out
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim()

  return out.slice(0, 8000)
}
