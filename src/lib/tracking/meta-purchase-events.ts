import type { MessagingPartnerInventoryRow } from '@/lib/db/messaging-partner-inventory-pg'
import type { PartnerOrderRow } from '@/lib/db/messaging-partner-orders-pg'
import { decodeHtmlEntitiesLite } from '@/lib/tracking/decode-html-entities-lite'

const GRAPH_VERSION = 'v21.0'

function uniqueIds(ids: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const x of ids) {
    const t = x.trim()
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

/** Purchase — Meta Pixel + CAPI (value = tổng đơn VND). */
export type MetaPurchaseClientPayload = {
  pixelId: string
  eventId: string
  value: number
  currency: 'VND'
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
}): Omit<MetaPurchaseClientPayload, 'pixelId' | 'eventId'> {
  const order = params.order
  const value = Math.max(0, Math.round(Number(order.subtotal_amount) || 0))
  const qty = Math.max(1, Math.min(99, Math.floor(Number(order.quantity) || 1)))
  const unit = Math.max(0, Math.round(Number(order.unit_price) || 0))

  const inv = params.inventory
  let lineId = order.product_inventory_id?.trim() || order.id
  const ids: string[] = []
  if (inv) {
    const sku = (inv.sku ?? '').trim()
    const remark = (inv.remarketing_id ?? '').trim()
    ids.push(...uniqueIds([sku, remark, inv.id].filter(Boolean) as string[]))
    lineId = ids[0] || inv.id
  } else {
    ids.push(lineId)
  }
  if (ids.length === 0) ids.push(order.id)

  const title = decodeHtmlEntitiesLite((order.product_name ?? '').trim()).slice(0, 500)

  return {
    value,
    currency: 'VND',
    content_ids: ids,
    content_type: 'product',
    num_items: qty,
    contents: [{ id: lineId, quantity: qty, item_price: unit, ...(title ? { title } : {}) }],
    order_id: order.id,
    ...(inv && (inv.remarketing_id ?? '').trim()
      ? { remarketing_id: (inv.remarketing_id ?? '').trim() }
      : {}),
  }
}

export async function sendMetaPurchaseConversionsApi(params: {
  pixelId: string
  accessToken: string
  eventId: string
  eventSourceUrl: string
  clientIp: string | null
  userAgent: string | null
  customData: Omit<MetaPurchaseClientPayload, 'pixelId' | 'eventId'>
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = params.accessToken.trim()
  if (!token) return { ok: false, error: 'missing_token' }
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(params.pixelId.trim())}/events`
  const eventTime = Math.floor(Date.now() / 1000)
  const user_data: Record<string, string> = {}
  if (params.clientIp && /^[\d.:a-fA-Fx]+$/.test(params.clientIp.trim())) {
    user_data.client_ip_address = params.clientIp.trim()
  }
  if (params.userAgent && params.userAgent.trim()) {
    user_data.client_user_agent = params.userAgent.trim().slice(0, 512)
  }
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
