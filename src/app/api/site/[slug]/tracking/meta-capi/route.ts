import { NextRequest, NextResponse } from 'next/server'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { resolveSiteVisitorEmail } from '@/lib/partner-website/shop/partner-site-personalization'
import { fetchMessagingPartnerFacebookMetaSecretsByPartnerIdFromPg } from '@/lib/db/messaging-partners-pg'
import { normalizeMetaExternalId, normalizeMetaFbc, normalizeMetaFbp } from '@/lib/tracking/meta-click-ids'
import { metaCapiCustomerFromPartner } from '@/lib/tracking/meta-capi-customer-match'
import { metaClientIpFromHeaders } from '@/lib/tracking/meta-client-ip'
import { type MetaCapiCustomerInfo } from '@/lib/tracking/meta-capi-user-data'
import { ensureMetaPixelAutomaticMatching } from '@/lib/tracking/meta-pixel-automatic-matching'
import { type MetaCommerceCustomData } from '@/lib/tracking/meta-view-content'

export const dynamic = 'force-dynamic'

const EVENT_NAMES = ['ViewContent', 'AddToCart', 'InitiateCheckout', 'Purchase'] as const
type EventName = (typeof EVENT_NAMES)[number]

function clientIpFromRequest(request: NextRequest): string | null {
  return metaClientIpFromHeaders(request.headers)
}

function firstMetaId(
  normalize: (raw: string | null | undefined) => string | null,
  ...candidates: Array<string | null | undefined>
): string | null {
  for (const raw of candidates) {
    const hit = normalize(raw)
    if (hit) return hit
  }
  return null
}

/**
 * S0.3 — CAPI proxy 2 lớp cho sự kiện thương mại chuẩn (ViewContent/AddToCart/InitiateCheckout/
 * Purchase) trên trang shop công khai. Browser gọi route nội bộ này (secret Meta không lộ ra
 * client), route tự điền fbp/fbc/IP/UA rồi forward tới Graph API Meta. Credentials tách theo từng
 * `partner_id` (khác 188 dùng 1 cặp global). Hỗ trợ `navigator.sendBeacon` (Content-Type
 * `text/plain`) để không mất event khi khách rời trang ngay sau khi mua — xem
 * docs/188_BEHAVIOR_SPEC.md mục E.3.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  try {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })

  let body: {
    eventName?: string
    eventId?: string
    eventSourceUrl?: string
    customData?: MetaCommerceCustomData
    customerEmail?: string
    customerPhone?: string
    externalId?: string
    customerInfo?: MetaCapiCustomerInfo
    fbc?: string
    fbp?: string
  }
  try {
    // sendBeacon gửi Content-Type `text/plain` — body vẫn là JSON string, parse thủ công.
    const raw = await request.text()
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const eventName = String(body.eventName ?? '')
  if (!EVENT_NAMES.includes(eventName as EventName)) {
    return NextResponse.json({ ok: false, error: 'invalid_event_name' }, { status: 400 })
  }
  const eventId = String(body.eventId ?? '').trim()
  if (!eventId) return NextResponse.json({ ok: false, error: 'missing_event_id' }, { status: 400 })
  const customData = body.customData
  if (!customData || !Array.isArray(customData.content_ids)) {
    return NextResponse.json({ ok: false, error: 'missing_custom_data' }, { status: 400 })
  }

  const secrets = await fetchMessagingPartnerFacebookMetaSecretsByPartnerIdFromPg(shop.partnerId)
  const pixelId = secrets?.facebook_pixel_id?.trim() ?? ''
  const capiToken = secrets?.facebook_capi_access_token?.trim() ?? ''
  if (!pixelId || !capiToken) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'not_configured' })
  }
  void ensureMetaPixelAutomaticMatching(pixelId, capiToken)

  const eventSourceUrl =
    String(body.eventSourceUrl ?? '').trim().slice(0, 2000) ||
    request.headers.get('referer')?.trim().slice(0, 2000) ||
    ''

  let sessionEmail = ''
  try {
    sessionEmail = (await resolveSiteVisitorEmail(request, shop.partnerId)) || ''
  } catch {
    sessionEmail = ''
  }
  const customer = await metaCapiCustomerFromPartner({
    partnerId: shop.partnerId,
    email: body.customerEmail || sessionEmail,
    phone: body.customerPhone,
    externalId: body.externalId,
    clientInfo: body.customerInfo,
  })

  const { sendMetaConversionsApiBatchWithOutbox } = await import('@/lib/tracking/meta-view-content')
  const result = await sendMetaConversionsApiBatchWithOutbox({
    partnerId: shop.partnerId,
    pixelId,
    accessToken: capiToken,
    eventSourceUrl,
    clientIp: clientIpFromRequest(request),
    userAgent: request.headers.get('user-agent'),
    fbc: firstMetaId(normalizeMetaFbc, request.cookies.get('_fbc')?.value, body.fbc),
    fbp: firstMetaId(normalizeMetaFbp, request.cookies.get('_fbp')?.value, body.fbp),
    customerEmail: customer.customerEmail,
    customerPhone: customer.customerPhone,
    externalId: normalizeMetaExternalId(customer.externalId),
    customerInfo: customer.customerInfo,
    events: [{ event_name: eventName as EventName, event_id: eventId, custom_data: customData }],
  })

  if (!result.ok) {
    console.warn('[site tracking meta-capi]', shop.partnerId, eventName, result.error)
    return NextResponse.json({ ok: false, error: result.error }, { status: 200 })
  }
  return NextResponse.json({ ok: true })
  } catch (e) {
    console.warn('[site tracking meta-capi] failed', e instanceof Error ? e.message : e)
    return NextResponse.json({ ok: false, error: 'capi_failed' }, { status: 200 })
  }
}
