import { NextRequest, NextResponse } from 'next/server'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { fetchMessagingPartnerFacebookMetaSecretsByPartnerIdFromPg } from '@/lib/db/messaging-partners-pg'
import { type MetaCommerceCustomData } from '@/lib/tracking/meta-view-content'

export const dynamic = 'force-dynamic'

const EVENT_NAMES = ['ViewContent', 'AddToCart', 'InitiateCheckout', 'Purchase'] as const
type EventName = (typeof EVENT_NAMES)[number]

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

function normalizeFbc(raw: string | null | undefined): string | null {
  const v = String(raw ?? '').trim()
  return /^fb\.1\.\d+\.[A-Za-z0-9_-]+$/.test(v) ? v : null
}

function normalizeFbp(raw: string | null | undefined): string | null {
  const v = String(raw ?? '').trim()
  return /^fb\.1\.\d+\.\d+$/.test(v) ? v : null
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

  const eventSourceUrl =
    String(body.eventSourceUrl ?? '').trim().slice(0, 2000) ||
    request.headers.get('referer')?.trim().slice(0, 2000) ||
    ''

  const { sendMetaConversionsApiBatchWithOutbox } = await import('@/lib/tracking/meta-view-content')
  const result = await sendMetaConversionsApiBatchWithOutbox({
    partnerId: shop.partnerId,
    pixelId,
    accessToken: capiToken,
    eventSourceUrl,
    clientIp: clientIpFromRequest(request),
    userAgent: request.headers.get('user-agent'),
    fbc: normalizeFbc(request.cookies.get('_fbc')?.value),
    fbp: normalizeFbp(request.cookies.get('_fbp')?.value),
    customerEmail: body.customerEmail,
    customerPhone: body.customerPhone,
    events: [{ event_name: eventName as EventName, event_id: eventId, custom_data: customData }],
  })

  if (!result.ok) {
    console.warn('[site tracking meta-capi]', shop.partnerId, eventName, result.error)
    return NextResponse.json({ ok: false, error: result.error }, { status: 200 })
  }
  return NextResponse.json({ ok: true })
}
