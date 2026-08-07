import type { MessagingPartnerInventoryRow } from '@/lib/db/messaging-partner-inventory-pg'
import { decodeHtmlEntitiesLite } from '@/lib/tracking/decode-html-entities-lite'
import { parseVndAmountFromPriceHint } from '@/lib/tracking/parse-vnd-from-price-hint'
import { hashMetaCapiEmail, hashMetaCapiPhone } from '@/lib/tracking/meta-capi-hash'

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

/** Tham số chung ViewContent / AddToCart / InitiateCheckout / Purchase (CAPI + Pixel). */
export type MetaCommerceCustomData = {
  content_ids: string[]
  content_name: string
  content_type: 'product'
  currency: 'VND'
  value: number
  remarketing_id?: string
  /** Chỉ Purchase — chi tiết từng dòng sản phẩm trong đơn. */
  contents?: Array<{ id: string; quantity: number; item_price: number }>
  num_items?: number
  order_id?: string
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
    ...(data.contents ? { contents: data.contents } : {}),
    ...(data.num_items != null ? { num_items: data.num_items } : {}),
    ...(data.order_id ? { order_id: data.order_id } : {}),
  }
}

/** Một hoặc nhiều sự kiện (ViewContent, AddToCart, …) trong một lần gọi Graph API. */
export async function sendMetaConversionsApiBatch(params: {
  pixelId: string
  accessToken: string
  eventSourceUrl: string
  clientIp: string | null
  userAgent: string | null
  /** Facebook click id cookie `_fbc` */
  fbc?: string | null
  /** Facebook browser id cookie `_fbp` */
  fbp?: string | null
  /** Email/SĐT thô — hash SHA-256 nội bộ trước khi gửi (Advanced Matching, xem meta-capi-hash.ts). */
  customerEmail?: string | null
  customerPhone?: string | null
  events: Array<{
    event_name: 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'Purchase'
    event_id: string
    custom_data: MetaCommerceCustomData
  }>
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = params.accessToken.trim()
  if (!token) return { ok: false, error: 'missing_token' }
  if (params.events.length === 0) return { ok: false, error: 'no_events' }
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
  if (/^fb\.1\.\d+\.[A-Za-z0-9_-]+$/.test(fbc)) {
    user_data.fbc = fbc
  }
  const fbp = String(params.fbp ?? '').trim()
  if (/^fb\.1\.\d+\.\d+$/.test(fbp)) {
    user_data.fbp = fbp
  }
  const emHash = hashMetaCapiEmail(params.customerEmail)
  if (emHash) user_data.em = [emHash]
  const phHash = hashMetaCapiPhone(params.customerPhone)
  if (phHash) user_data.ph = [phHash]
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

/** S0.3 — send CAPI and enqueue outbox on failure when partnerId provided. */
export async function sendMetaConversionsApiBatchWithOutbox(params: {
  partnerId?: string | null
  pixelId: string
  accessToken: string
  eventSourceUrl: string
  clientIp: string | null
  userAgent: string | null
  fbc?: string | null
  fbp?: string | null
  customerEmail?: string | null
  customerPhone?: string | null
  events: Array<{
    event_name: 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'Purchase'
    event_id: string
    custom_data: MetaCommerceCustomData
  }>
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await sendMetaConversionsApiBatch(params)
  if (result.ok || !params.partnerId) return result
  try {
    const { enqueuePartnerMetaCapiOutboxFromPg } = await import(
      '@/lib/db/messaging-partner-meta-capi-outbox-pg'
    )
    for (const ev of params.events) {
      await enqueuePartnerMetaCapiOutboxFromPg({
        partnerId: params.partnerId,
        eventId: ev.event_id,
        eventName: ev.event_name,
        payload: {
          pixelId: params.pixelId,
          accessToken: params.accessToken,
          eventSourceUrl: params.eventSourceUrl,
          clientIp: params.clientIp,
          userAgent: params.userAgent,
          fbc: params.fbc ?? null,
          fbp: params.fbp ?? null,
          customerEmail: params.customerEmail ?? null,
          customerPhone: params.customerPhone ?? null,
          event: ev,
        },
        lastError: result.error,
      })
    }
  } catch {
    /* ignore outbox errors */
  }
  return result
}

/** Gửi ViewContent lên Meta Conversions API (máy chủ). */
export async function sendMetaViewContentConversionsApi(params: {
  pixelId: string
  accessToken: string
  eventId: string
  eventSourceUrl: string
  clientIp: string | null
  userAgent: string | null
  fbc?: string | null
  fbp?: string | null
  customData: MetaCommerceCustomData
}): Promise<{ ok: true } | { ok: false; error: string }> {
  return sendMetaConversionsApiBatch({
    pixelId: params.pixelId,
    accessToken: params.accessToken,
    eventSourceUrl: params.eventSourceUrl,
    clientIp: params.clientIp,
    userAgent: params.userAgent,
    fbc: params.fbc,
    fbp: params.fbp,
    events: [
      {
        event_name: 'ViewContent',
        event_id: params.eventId,
        custom_data: params.customData,
      },
    ],
  })
}
