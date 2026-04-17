import { randomUUID } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { fetchPartnerInventoryRowByIdForPartnerFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import type { PartnerOrderRow } from '@/lib/db/messaging-partner-orders-pg'
import { fetchMessagingPartnerFacebookMetaSecretsByPartnerIdFromPg } from '@/lib/db/messaging-partners-pg'
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

  const base = buildMetaPurchaseCustomDataFromOrder({
    order: params.order,
    inventory,
  })
  const eventId = randomUUID()
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
