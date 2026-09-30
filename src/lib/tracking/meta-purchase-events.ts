import type { MessagingPartnerInventoryRow } from '@/lib/db/messaging-partner-inventory-pg'
import type { PartnerOrderRow } from '@/lib/db/messaging-partner-orders-pg'
import { catalogContentId } from '@/lib/messaging/catalog-content-id'
import { decodeHtmlEntitiesLite } from '@/lib/tracking/decode-html-entities-lite'
import { hashMetaCapiEmail, hashMetaCapiPhone } from '@/lib/tracking/meta-capi-hash'

const GRAPH_VERSION = 'v21.0'

/** Purchase — Meta Pixel + CAPI (value = tổng đơn theo currency shop). */
export type MetaPurchaseClientPayload = {
  pixelId: string
  eventId: string
  value: number
  currency: string
  content_ids: string[]
  content_type: 'product'
  num_items: number
  contents: Array<{ id: string; quantity: number; item_price: number; title?: string }>
  order_id: string
  remarketing_id?: string
}

export function buildMetaPurchaseCustomDataFromOrder(params: {
  order: PartnerOrderRow
  inventory: MessagingPartnerInventoryRow | null
  currency?: string | null
  /** Dòng đơn — content id từng SP khớp cột `id` feed. */
  lineItems?: Array<{
    inventoryId?: string | null
    remarketingId?: string | null
    name?: string | null
    quantity?: number | null
    unitPrice?: number | null
  }>
}): Omit<MetaPurchaseClientPayload, 'pixelId' | 'eventId'> {
  const order = params.order
  const value = Math.max(0, Math.round(Number(order.subtotal_amount) || 0))
  const currency =
    String(params.currency ?? 'VND')
      .trim()
      .toUpperCase() || 'VND'
  const headerRemarketing = (params.inventory?.remarketing_id ?? '').trim()
  const sources = params.lineItems?.length
    ? params.lineItems
    : [
        {
          inventoryId: params.inventory?.id || order.product_inventory_id,
          remarketingId: headerRemarketing,
          name: order.product_name,
          quantity: order.quantity,
          unitPrice: order.unit_price,
        },
      ]
  const contents: MetaPurchaseClientPayload['contents'] = []
  const ids: string[] = []
  for (const line of sources) {
    const contentId = catalogContentId({
      remarketingId: line.remarketingId,
      inventoryId: line.inventoryId,
    })
    if (!contentId) continue
    if (!ids.includes(contentId)) ids.push(contentId)
    const qty = Math.max(1, Math.min(99, Math.floor(Number(line.quantity) || 1)))
    const unit = Math.max(0, Math.round(Number(line.unitPrice) || 0))
    const title = decodeHtmlEntitiesLite(String(line.name ?? '').trim()).slice(0, 500)
    contents.push({ id: contentId, quantity: qty, item_price: unit, ...(title ? { title } : {}) })
  }
  if (ids.length === 0) {
    const fallback = catalogContentId({ inventoryId: order.product_inventory_id })
    if (fallback) {
      ids.push(fallback)
      contents.push({
        id: fallback,
        quantity: Math.max(1, Math.min(99, Math.floor(Number(order.quantity) || 1))),
        item_price: Math.max(0, Math.round(Number(order.unit_price) || 0)),
      })
    }
  }
  const numItems = contents.reduce((sum, line) => sum + line.quantity, 0) || 1

  return {
    value,
    currency,
    content_ids: ids,
    content_type: 'product',
    num_items: numItems,
    contents,
    order_id: order.id,
    ...(headerRemarketing ? { remarketing_id: headerRemarketing } : {}),
  }
}

export async function sendMetaPurchaseConversionsApi(params: {
  pixelId: string
  accessToken: string
  eventId: string
  eventSourceUrl: string
  clientIp: string | null
  userAgent: string | null
  /** Meta CAPI dedupe `_fbc`/`_fbp` — xem docs/188_BEHAVIOR_SPEC.md mục E.1/E.4. */
  fbc?: string | null
  fbp?: string | null
  /** Hash SHA-256 nội bộ trước khi gửi (Advanced Matching) — không gửi plaintext. */
  customerEmail?: string | null
  customerPhone?: string | null
  customData: Omit<MetaPurchaseClientPayload, 'pixelId' | 'eventId'>
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = params.accessToken.trim()
  if (!token) return { ok: false, error: 'missing_token' }
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(params.pixelId.trim())}/events`
  const eventTime = Math.floor(Date.now() / 1000)
  const user_data: Record<string, string | string[]> = {}
  if (params.clientIp && /^[\d.:a-fA-Fx]+$/.test(params.clientIp.trim())) {
    user_data.client_ip_address = params.clientIp.trim()
  }
  if (params.userAgent && params.userAgent.trim()) {
    user_data.client_user_agent = params.userAgent.trim().slice(0, 512)
  }
  const fbc = String(params.fbc ?? '').trim()
  if (/^fb\.1\.\d+\.[A-Za-z0-9_-]+$/.test(fbc)) user_data.fbc = fbc
  const fbp = String(params.fbp ?? '').trim()
  if (/^fb\.1\.\d+\.\d+$/.test(fbp)) user_data.fbp = fbp
  const emHash = hashMetaCapiEmail(params.customerEmail)
  if (emHash) user_data.em = [emHash]
  const phHash = hashMetaCapiPhone(params.customerPhone)
  if (phHash) user_data.ph = [phHash]
  const cd = params.customData
  const custom_data: Record<string, unknown> = {
    value: cd.value,
    currency: cd.currency,
    content_ids: cd.content_ids,
    content_type: cd.content_type,
    num_items: cd.num_items,
    contents: cd.contents,
    order_id: cd.order_id,
  }
  if (cd.remarketing_id) custom_data.remarketing_id = cd.remarketing_id.slice(0, 128)

  const body = {
    data: [
      {
        event_name: 'Purchase' as const,
        event_time: eventTime,
        event_id: params.eventId,
        action_source: 'website' as const,
        event_source_url: params.eventSourceUrl.slice(0, 2000),
        user_data,
        custom_data,
      },
    ],
    access_token: token,
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const j = (await res.json().catch(() => null)) as { events_received?: number; error?: { message?: string } } | null
    if (!res.ok) {
      const msg = j?.error?.message || res.statusText || 'capi_error'
      return { ok: false, error: msg }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'fetch_failed' }
  }
}
