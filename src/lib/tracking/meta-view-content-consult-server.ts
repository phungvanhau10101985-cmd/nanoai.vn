import { randomUUID } from 'node:crypto'
import { cookies, headers } from 'next/headers'
import type { MessagingPartnerInventoryRow } from '@/lib/db/messaging-partner-inventory-pg'
import { fetchMessagingPartnerFacebookMetaSecretsByPartnerIdFromPg } from '@/lib/db/messaging-partners-pg'
import {
  buildMetaCommerceCustomDataFromInventoryRow,
  buildMetaViewContentFromInventoryRow,
  sendMetaViewContentConversionsApi,
  type MetaViewContentClientPayload,
} from '@/lib/tracking/meta-view-content'

function buildEventSourceUrlFromHeaders(pathWithLeadingSlash: string): string {
  const h = headers()
  const host = (h.get('x-forwarded-host') ?? h.get('host') ?? '').split(',')[0]?.trim() ?? ''
  const rawProto = h.get('x-forwarded-proto') ?? 'https'
  const proto = rawProto.split(',')[0]?.trim() || 'https'
  const path = pathWithLeadingSlash.startsWith('/') ? pathWithLeadingSlash : `/${pathWithLeadingSlash}`
  if (!host) return path
  return `${proto}://${host}${path}`
}

function getClientIpFromHeaders(): string | null {
  const h = headers()
  const xff = h.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first && /^[\d.:a-fA-Fx]+$/.test(first)) return first
  }
  const xr = h.get('x-real-ip')?.trim()
  if (xr && /^[\d.:a-fA-Fx]+$/.test(xr)) return xr
  return null
}

function normalizeFbc(raw: string | null | undefined): string | null {
  const v = String(raw ?? '').trim()
  if (/^fb\.1\.\d+\.[A-Za-z0-9_-]+$/.test(v)) return v
  return null
}

function normalizeFbp(raw: string | null | undefined): string | null {
  const v = String(raw ?? '').trim()
  if (/^fb\.1\.\d+\.\d+$/.test(v)) return v
  return null
}

function buildFbcFromPathFbclid(pathWithQuery: string): string | null {
  const qIndex = pathWithQuery.indexOf('?')
  if (qIndex < 0) return null
  const qs = pathWithQuery.slice(qIndex + 1)
  const params = new URLSearchParams(qs)
  const fbclid = String(params.get('fbclid') ?? '').trim()
  if (!/^[A-Za-z0-9_-]{8,}$/.test(fbclid)) return null
  return `fb.1.${Date.now()}.${fbclid}`
}

/**
 * ViewContent (Pixel + CAPI dedupe qua `eventId`) khi khách mở trang tư vấn theo kho hàng.
 */
export async function runMetaViewContentForConsultInventoryPage(params: {
  partnerId: string
  inventoryRow: MessagingPartnerInventoryRow
  /** Đường dẫn đầy đủ gồm query nếu cần, ví dụ `/messaging/p/shop/tu-van/uuid` */
  eventSourcePath: string
  /** Optional from client side cookie `_fbc` */
  fbc?: string | null
  /** Optional from client side cookie `_fbp` */
  fbp?: string | null
}): Promise<MetaViewContentClientPayload | null> {
  const secrets = await fetchMessagingPartnerFacebookMetaSecretsByPartnerIdFromPg(params.partnerId)
  const pixelId = secrets?.facebook_pixel_id?.trim() ?? ''
  if (!pixelId) return null

  const eventId = randomUUID()
  const payload = buildMetaViewContentFromInventoryRow(params.inventoryRow, eventId, pixelId)
  if (!payload) return null

  const eventSourceUrl = buildEventSourceUrlFromHeaders(params.eventSourcePath)
  const clientIp = getClientIpFromHeaders()
  const ck = cookies()
  const cookieFbc = normalizeFbc(ck.get('_fbc')?.value ?? null)
  const cookieFbp = normalizeFbp(ck.get('_fbp')?.value ?? null)
  const fbc =
    normalizeFbc(params.fbc) ??
    cookieFbc ??
    buildFbcFromPathFbclid(params.eventSourcePath)
  const fbp = normalizeFbp(params.fbp) ?? cookieFbp
  const h2 = headers()
  const userAgent = h2.get('user-agent')

  const capi = secrets?.facebook_capi_access_token?.trim() ?? ''
  if (capi) {
    void sendMetaViewContentConversionsApi({
      pixelId,
      accessToken: capi,
      eventId,
      eventSourceUrl,
      clientIp,
      userAgent,
      fbc,
      fbp,
      customData: buildMetaCommerceCustomDataFromInventoryRow(params.inventoryRow),
    }).then((r) => {
      if (!r.ok) console.warn('[Meta CAPI ViewContent]', r.error)
    })
  }

  return payload
}
