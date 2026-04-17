import type { MessagingPartnerInventoryRow } from '@/lib/db/messaging-partner-inventory-pg'
import { decodeHtmlEntitiesLite } from '@/lib/tracking/decode-html-entities-lite'
import { parseVndAmountFromPriceHint } from '@/lib/tracking/parse-vnd-from-price-hint'

export type MetaViewContentClientPayload = {
  eventId: string
  pixelId: string
  content_ids: string[]
  content_name: string
  content_type: 'product'
  currency: 'VND'
  value: number
  /** Meta custom — id remarketing / nội bộ */
  remarketing_id?: string
}

/** Tham số chung ViewContent / AddToCart (CAPI + Pixel). */
export type MetaCommerceCustomData = {
  content_ids: string[]
  content_name: string
  content_type: 'product'
  currency: 'VND'
  value: number
  remarketing_id?: string
}

/** Trả về từ API «Mua ngay» — hai event_id khác nhau để dedupe CAPI/Pixel từng loại. */
export type MetaBuyNowClientPayload = MetaCommerceCustomData & {
  pixelId: string
  viewContentEventId: string
  addToCartEventId: string
}

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

export function buildMetaCommerceCustomDataFromInventoryRow(
  row: MessagingPartnerInventoryRow
): MetaCommerceCustomData {
  const sku = (row.sku ?? '').trim()
  const remarketing = (row.remarketing_id ?? '').trim()
  const ids = uniqueIds([sku, remarketing, row.id].filter(Boolean) as string[])
  if (ids.length === 0) ids.push(row.id)
  const name = decodeHtmlEntitiesLite((row.name ?? '').trim()) || 'Product'
  const value = parseVndAmountFromPriceHint(row.price_hint)
  return {
    content_ids: ids,
    content_name: name,
    content_type: 'product',
    currency: 'VND',
    value: value > 0 ? value : 0,
    ...(remarketing ? { remarketing_id: remarketing } : {}),
  }
}

export function buildMetaViewContentFromInventoryRow(
  row: MessagingPartnerInventoryRow,
  eventId: string,
  pixelId: string
): MetaViewContentClientPayload | null {
  const pid = pixelId.trim()
  if (!pid) return null
  const base = buildMetaCommerceCustomDataFromInventoryRow(row)
  return {
    eventId,
    pixelId: pid,
    ...base,
  }
}

function capiCustomDataPayload(data: MetaCommerceCustomData) {
  return {
    content_ids: data.content_ids,
    content_name: data.content_name.slice(0, 500),
    content_type: data.content_type,
    currency: data.currency,
    value: data.value,
    ...(data.remarketing_id ? { remarketing_id: data.remarketing_id.slice(0, 128) } : {}),
  }
}

/** Một hoặc nhiều sự kiện (ViewContent, AddToCart, …) trong một lần gọi Graph API. */
export async function sendMetaConversionsApiBatch(params: {
  pixelId: string
  accessToken: string
  eventSourceUrl: string
  clientIp: string | null
  userAgent: string | null
  events: Array<{
    event_name: 'ViewContent' | 'AddToCart'
    event_id: string
    custom_data: MetaCommerceCustomData
  }>
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = params.accessToken.trim()
  if (!token) return { ok: false, error: 'missing_token' }
  if (params.events.length === 0) return { ok: false, error: 'no_events' }
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(params.pixelId.trim())}/events`
  const eventTime = Math.floor(Date.now() / 1000)
  const user_data: Record<string, string> = {}
  if (params.clientIp && /^[\d.:a-fA-Fx]+$/.test(params.clientIp.trim())) {
    user_data.client_ip_address = params.clientIp.trim()
  }
  if (params.userAgent && params.userAgent.trim()) {
    user_data.client_user_agent = params.userAgent.trim().slice(0, 512)
  }
  const body = {
    data: params.events.map((ev) => ({
      event_name: ev.event_name,
      event_time: eventTime,
      event_id: ev.event_id,
      action_source: 'website' as const,
      event_source_url: params.eventSourceUrl.slice(0, 2000),
      user_data,
      custom_data: capiCustomDataPayload(ev.custom_data),
    })),
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

/** Gửi ViewContent lên Meta Conversions API (máy chủ). */
export async function sendMetaViewContentConversionsApi(params: {
  pixelId: string
  accessToken: string
  eventId: string
  eventSourceUrl: string
  clientIp: string | null
  userAgent: string | null
  customData: MetaCommerceCustomData
}): Promise<{ ok: true } | { ok: false; error: string }> {
  return sendMetaConversionsApiBatch({
    pixelId: params.pixelId,
    accessToken: params.accessToken,
    eventSourceUrl: params.eventSourceUrl,
    clientIp: params.clientIp,
    userAgent: params.userAgent,
    events: [
      {
        event_name: 'ViewContent',
        event_id: params.eventId,
        custom_data: params.customData,
      },
    ],
  })
}
