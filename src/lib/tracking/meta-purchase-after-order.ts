import type { NextRequest } from 'next/server'
import { fetchPartnerInventoryRowByIdForPartnerFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import type { PartnerOrderRow } from '@/lib/db/messaging-partner-orders-pg'
import {
  fetchMessagingPartnerDefaultCurrencyFromPg,
  fetchMessagingPartnerFacebookMetaSecretsByPartnerIdFromPg,
} from '@/lib/db/messaging-partners-pg'
import { fetchPartnerWebsiteByPartnerIdPg } from '@/lib/db/messaging-partner-websites-pg'
import { normalizePartnerShopCurrency } from '@/lib/partner-website/shop/partner-shop-currency'
import { defaultPublicOrigin } from '@/lib/public-app-origin'
import {
  buildMetaPurchaseCustomDataFromOrder,
  sendMetaPurchaseConversionsApi,
  type MetaPurchaseClientPayload,
} from '@/lib/tracking/meta-purchase-events'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function clientIpFromRequest(request: NextRequest): string | null {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first && /^[\d.:a-fA-Fx]+$/.test(first)) return first
  }
  const xr = request.headers.get('x-real-ip')?.trim()
  if (xr && /^[\d.:a-fA-Fx]+$/.test(xr)) return xr
  return null
}

function eventSourceUrlFromRequest(request: NextRequest): string {
  const ref = request.headers.get('referer')?.trim()
  if (ref) return ref.slice(0, 2000)
  try {
    return request.nextUrl.toString().slice(0, 2000)
  } catch {
    return ''
  }
}

function normalizeFbc(raw: string | null | undefined): string | null {
  const v = String(raw ?? '').trim()
  return /^fb\.1\.\d+\.[A-Za-z0-9_-]+$/.test(v) ? v : null
}

function normalizeFbp(raw: string | null | undefined): string | null {
  const v = String(raw ?? '').trim()
  return /^fb\.1\.\d+\.\d+$/.test(v) ? v : null
}

/**
 * Sau «Tạo đơn và QR» / tạo đơn — Purchase (CAPI + payload Pixel).
 */
export async function runMetaPurchaseAfterOrderComplete(params: {
  partnerId: string
  order: PartnerOrderRow
  request: NextRequest
}): Promise<MetaPurchaseClientPayload | null> {
  const secrets = await fetchMessagingPartnerFacebookMetaSecretsByPartnerIdFromPg(params.partnerId)
  const pixelId = secrets?.facebook_pixel_id?.trim() ?? ''
  if (!pixelId) return null

  const invId = params.order.product_inventory_id?.trim() ?? ''
  const inventory =
    invId && UUID_RE.test(invId)
      ? await fetchPartnerInventoryRowByIdForPartnerFromPg(params.partnerId, invId)
      : null

  const currency = normalizePartnerShopCurrency(
    await fetchMessagingPartnerDefaultCurrencyFromPg(params.partnerId)
  )
  const base = buildMetaPurchaseCustomDataFromOrder({
    order: params.order,
    inventory,
    currency,
  })
  // ID ổn định theo đơn (không phải UUID ngẫu nhiên) — bắt buộc để Meta dedupe đúng với Purchase
  // gửi lại sau khi xác nhận thanh toán (`sendPartnerMetaPurchaseCapiOnPaymentConfirmed`), dù 2 lần
  // gửi tách biệt hoàn toàn về thời điểm. Xem docs/188_BEHAVIOR_SPEC.md mục E.1.
  const eventId = `Purchase_${params.order.id}`
  const eventSourceUrl = eventSourceUrlFromRequest(params.request)

  const capi = secrets?.facebook_capi_access_token?.trim() ?? ''
  if (capi && eventSourceUrl) {
    void sendMetaPurchaseConversionsApi({
      pixelId,
      accessToken: capi,
      eventId,
      eventSourceUrl,
      clientIp: clientIpFromRequest(params.request),
      userAgent: params.request.headers.get('user-agent'),
      fbc: normalizeFbc(params.request.cookies.get('_fbc')?.value),
      fbp: normalizeFbp(params.request.cookies.get('_fbp')?.value),
      customerEmail: params.order.customer_email,
      customerPhone: params.order.customer_phone,
      customData: base,
    }).then((r) => {
      if (!r.ok) console.warn('[Meta CAPI Purchase]', r.error)
    })
  }

  return {
    pixelId,
    eventId,
    ...base,
  }
}

/**
 * Purchase server-side sau khi thanh toán/cọc được xác nhận THẬT (webhook tự động, admin xác nhận
 * thủ công, hoặc OCR biên lai tự duyệt) — dùng CHUNG 1 hàm cho mọi luồng thanh toán, khác 188 (188
 * chỉ có bản server-side riêng cho cọc, COD chỉ có browser). Cùng `event_id` ổn định
 * `Purchase_{orderId}` với lần gửi lúc tạo đơn để Meta dedupe đúng dù gửi 2 lần tách biệt thời điểm
 * — xem docs/188_BEHAVIOR_SPEC.md mục E.1/E.4.
 */
export async function sendPartnerMetaPurchaseCapiOnPaymentConfirmed(params: {
  partnerId: string
  order: PartnerOrderRow
  eventSourceUrl?: string | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const secrets = await fetchMessagingPartnerFacebookMetaSecretsByPartnerIdFromPg(params.partnerId)
  const pixelId = secrets?.facebook_pixel_id?.trim() ?? ''
  const capi = secrets?.facebook_capi_access_token?.trim() ?? ''
  if (!pixelId || !capi) return { ok: false, error: 'not_configured' }

  const invId = params.order.product_inventory_id?.trim() ?? ''
  const inventory =
    invId && UUID_RE.test(invId)
      ? await fetchPartnerInventoryRowByIdForPartnerFromPg(params.partnerId, invId)
      : null
  const currency = normalizePartnerShopCurrency(
    await fetchMessagingPartnerDefaultCurrencyFromPg(params.partnerId)
  )
  const customData = buildMetaPurchaseCustomDataFromOrder({
    order: params.order,
    inventory,
    currency,
  })
  const eventId = `Purchase_${params.order.id}`
  let eventSourceUrl = (params.eventSourceUrl ?? '').trim()
  if (!eventSourceUrl) {
    const site = await fetchPartnerWebsiteByPartnerIdPg(params.partnerId)
    eventSourceUrl = site?.siteSlug ? `${defaultPublicOrigin()}/site/${site.siteSlug}` : defaultPublicOrigin()
  }

  return sendMetaPurchaseConversionsApi({
    pixelId,
    accessToken: capi,
    eventId,
    eventSourceUrl,
    clientIp: null,
    userAgent: null,
    customerEmail: params.order.customer_email,
    customerPhone: params.order.customer_phone,
    customData,
  })
}
