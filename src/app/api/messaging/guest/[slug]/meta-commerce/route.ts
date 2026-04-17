import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import {
  fetchPartnerInventoryRowByIdForPartnerFromPg,
  fetchPartnerInventoryRowByProductUrlNormKeyFromPg,
} from '@/lib/db/messaging-partner-inventory-pg'
import { fetchMessagingPartnerFacebookMetaSecretsByPartnerIdFromPg } from '@/lib/db/messaging-partners-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { resolveActiveMessagingPartnerBySlug } from '@/lib/messaging/resolve-active-messaging-partner'
import {
  buildMetaCommerceCustomDataFromInventoryRow,
  sendMetaConversionsApiBatch,
} from '@/lib/tracking/meta-view-content'

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

export const dynamic = 'force-dynamic'

/**
 * Khách bấm «Mua ngay» — ViewContent + AddToCart (CAPI) + payload cho Pixel (client gọi fbq).
 * Body: `inventoryId` (UUID) **hoặc** `productUrl` (HTTP) để tra kho — ít nhất một trong hai.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  if (!isPgConfigured()) {
    return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503 })
  }

  let body: { inventoryId?: string; productUrl?: string; eventSourceUrl?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const inventoryId = String(body.inventoryId ?? '').trim()
  const productUrlRaw = String(body.productUrl ?? '').trim()
  const hasUuid = UUID_RE.test(inventoryId)
  const hasProductUrl = /^https?:\/\//i.test(productUrlRaw)
  if (!hasUuid && !hasProductUrl) {
    return NextResponse.json({ ok: false, error: 'missing_inventory_id_or_product_url' }, { status: 400 })
  }

  const eventSourceUrl = String(body.eventSourceUrl ?? '').trim().slice(0, 2000) || ''

  const partner = await resolveActiveMessagingPartnerBySlug(slug)
  if (!partner) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  let row = null as Awaited<ReturnType<typeof fetchPartnerInventoryRowByIdForPartnerFromPg>>
  if (hasUuid) {
    row = await fetchPartnerInventoryRowByIdForPartnerFromPg(partner.id, inventoryId)
  } else {
    row = await fetchPartnerInventoryRowByProductUrlNormKeyFromPg(partner.id, productUrlRaw)
  }
  if (!row) {
    return NextResponse.json({ ok: false, error: 'inventory_not_found' }, { status: 404 })
  }

  const secrets = await fetchMessagingPartnerFacebookMetaSecretsByPartnerIdFromPg(partner.id)
  const pixelId = secrets?.facebook_pixel_id?.trim() ?? ''
  if (!pixelId) {
    return NextResponse.json({ ok: false, skipped: true, reason: 'no_pixel' }, { status: 200 })
  }

  const custom = buildMetaCommerceCustomDataFromInventoryRow(row)
  const viewContentEventId = randomUUID()
  const addToCartEventId = randomUUID()

  const capi = secrets?.facebook_capi_access_token?.trim() ?? ''
  if (capi && eventSourceUrl) {
    void sendMetaConversionsApiBatch({
      pixelId,
      accessToken: capi,
      eventSourceUrl,
      clientIp: clientIpFromRequest(request),
      userAgent: request.headers.get('user-agent'),
      events: [
        { event_name: 'ViewContent', event_id: viewContentEventId, custom_data: custom },
        { event_name: 'AddToCart', event_id: addToCartEventId, custom_data: custom },
      ],
    }).then((r) => {
      if (!r.ok) console.warn('[Meta CAPI buy now]', r.error)
    })
  }

  return NextResponse.json({
    ok: true,
    pixelId,
    viewContentEventId,
    addToCartEventId,
    ...custom,
  })
}
