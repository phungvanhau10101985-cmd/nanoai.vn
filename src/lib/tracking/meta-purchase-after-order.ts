import type { NextRequest } from 'next/server'
import { fetchPartnerInventoryRowByIdForPartnerFromPg, fetchPartnerRemarketingIdsByInventoryIdsFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import { fetchPartnerOrderLinesFromPg, type PartnerOrderRow } from '@/lib/db/messaging-partner-orders-pg'
import {
  fetchMessagingPartnerDefaultCurrencyFromPg,
  fetchMessagingPartnerFacebookMetaSecretsByPartnerIdFromPg,
} from '@/lib/db/messaging-partners-pg'
import { fetchPartnerWebsiteByPartnerIdPg } from '@/lib/db/messaging-partner-websites-pg'
import { readPartnerOrderMetaMatch, savePartnerOrderMetaMatch } from '@/lib/db/messaging-partner-order-meta-match-pg'
import { normalizePartnerShopCurrency } from '@/lib/partner-website/shop/partner-shop-currency'
import { defaultPublicOrigin } from '@/lib/public-app-origin'
import { metaCapiCustomerFromPartner } from '@/lib/tracking/meta-capi-customer-match'
import { metaClientIpFromHeaders } from '@/lib/tracking/meta-client-ip'
import { normalizeMetaFbc, normalizeMetaFbp } from '@/lib/tracking/meta-click-ids'
import {
  buildMetaPurchaseCustomDataFromOrder,
  sendMetaPurchaseConversionsApi,
  type MetaPurchaseClientPayload,
} from '@/lib/tracking/meta-purchase-events'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function purchaseLineItems(partnerId: string, order: PartnerOrderRow) {
  const lines = await fetchPartnerOrderLinesFromPg(order.id)
  if (!lines.length) return undefined
  const map = await fetchPartnerRemarketingIdsByInventoryIdsFromPg(
    partnerId,
    lines.map((line) => line.product_inventory_id || '')
  )
  return lines.map((line) => ({
    inventoryId: line.product_inventory_id,
    remarketingId: line.product_inventory_id ? map.get(line.product_inventory_id) : '',
    name: line.product_name,
    quantity: line.quantity,
    unitPrice: line.unit_price,
  }))
}

function clientIpFromRequest(request: NextRequest): string | null {
  return metaClientIpFromHeaders(request.headers)
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
  return normalizeMetaFbc(raw)
}

function normalizeFbp(raw: string | null | undefined): string | null {
  return normalizeMetaFbp(raw)
}

/**
 * Sau «Tạo đơn và QR» / tạo đơn — Purchase (CAPI + payload Pixel).
 */
export async function runMetaPurchaseAfterOrderComplete(params: {
  partnerId: string
  order: PartnerOrderRow
  request: NextRequest
  /** ID khách thô (user hoặc guest account). */
  externalId?: string | null
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
  const lineItems = await purchaseLineItems(params.partnerId, params.order)
  const base = buildMetaPurchaseCustomDataFromOrder({
    order: params.order,
    inventory,
    currency,
    lineItems,
  })
  // ID ổn định theo đơn (không phải UUID ngẫu nhiên) — bắt buộc để Meta dedupe đúng với Purchase
  // gửi lại sau khi xác nhận thanh toán (`sendPartnerMetaPurchaseCapiOnPaymentConfirmed`), dù 2 lần
  // gửi tách biệt hoàn toàn về thời điểm. Xem docs/188_BEHAVIOR_SPEC.md mục E.1.
  const eventId = `Purchase_${params.order.id}`
  const eventSourceUrl = eventSourceUrlFromRequest(params.request)

  const capi = secrets?.facebook_capi_access_token?.trim() ?? ''
  const clientIp = clientIpFromRequest(params.request)
  const userAgent = params.request.headers.get('user-agent')
  const fbc = normalizeFbc(params.request.cookies.get('_fbc')?.value)
  const fbp = normalizeFbp(params.request.cookies.get('_fbp')?.value)
  const customer = await metaCapiCustomerFromPartner({
    partnerId: params.partnerId,
    email: params.order.customer_email,
    phone: params.order.customer_phone,
    fullName: params.order.customer_name,
    shippingAddress: params.order.shipping_address,
    externalId: params.externalId,
  })
  await savePartnerOrderMetaMatch({
    orderId: params.order.id,
    partnerId: params.partnerId,
    clientIp,
    userAgent,
    fbp,
    fbc,
    externalId: customer.externalId,
  })
  if (capi && eventSourceUrl) {
    void sendMetaPurchaseConversionsApi({
      pixelId,
      accessToken: capi,
      eventId,
      eventSourceUrl,
      clientIp,
      userAgent,
      fbc,
      fbp,
      customerEmail: customer.customerEmail,
      customerPhone: customer.customerPhone,
      externalId: customer.externalId,
      customerInfo: customer.customerInfo,
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
  externalId?: string | null
  fbc?: string | null
  fbp?: string | null
  clientIp?: string | null
  userAgent?: string | null
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
  const lineItems = await purchaseLineItems(params.partnerId, params.order)
  const customData = buildMetaPurchaseCustomDataFromOrder({
    order: params.order,
    inventory,
    currency,
    lineItems,
  })
  const eventId = `Purchase_${params.order.id}`
  let eventSourceUrl = (params.eventSourceUrl ?? '').trim()
  if (!eventSourceUrl) {
    const site = await fetchPartnerWebsiteByPartnerIdPg(params.partnerId)
    eventSourceUrl = site?.siteSlug ? `${defaultPublicOrigin()}/site/${site.siteSlug}` : defaultPublicOrigin()
  }

  const saved = await readPartnerOrderMetaMatch(params.order.id)
  const customer = await metaCapiCustomerFromPartner({
    partnerId: params.partnerId,
    email: params.order.customer_email,
    phone: params.order.customer_phone,
    fullName: params.order.customer_name,
    shippingAddress: params.order.shipping_address,
    externalId: params.externalId || saved?.externalId,
  })
  return sendMetaPurchaseConversionsApi({
    pixelId,
    accessToken: capi,
    eventId,
    eventSourceUrl,
    clientIp: params.clientIp || saved?.clientIp || null,
    userAgent: params.userAgent || saved?.userAgent || null,
    fbc: normalizeFbc(params.fbc) || normalizeFbc(saved?.fbc),
    fbp: normalizeFbp(params.fbp) || normalizeFbp(saved?.fbp),
    customerEmail: customer.customerEmail,
    customerPhone: customer.customerPhone,
    externalId: customer.externalId,
    customerInfo: customer.customerInfo,
    customData,
  })
}
