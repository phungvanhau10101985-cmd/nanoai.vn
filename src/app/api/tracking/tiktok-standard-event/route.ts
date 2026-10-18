import { NextRequest, NextResponse } from 'next/server'
import { loadAdminIntegrationsValueJsonByKey } from '@/lib/db/admin-integrations-settings-pg'
import { sendTikTokWebEvent, type TikTokWebEventName } from '@/lib/tracking/tiktok-events-api'

export const dynamic = 'force-dynamic'

const INTEGRATIONS_KEY = 'admin_integrations_config'

const EVENT_MAP: Record<string, TikTokWebEventName> = {
  ViewContent: 'ViewContent',
  AddToCart: 'AddToCart',
  InitiateCheckout: 'InitiateCheckout',
  Purchase: 'CompletePayment',
  CompletePayment: 'CompletePayment',
}

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

function readString(body: Record<string, unknown>, key: string): string {
  return String(body[key] ?? '').trim()
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const event = EVENT_MAP[readString(body, 'eventName')]
  const eventId = readString(body, 'eventId')
  const eventSourceUrl = readString(body, 'eventSourceUrl').slice(0, 2000)
  const contentId = readString(body, 'contentId')
  if (!event) return NextResponse.json({ ok: false, error: 'invalid_event_name' }, { status: 400 })
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(eventId)) {
    return NextResponse.json({ ok: false, error: 'invalid_event_id' }, { status: 400 })
  }
  if (!eventSourceUrl || !contentId) {
    return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 })
  }

  const settingsRaw = await loadAdminIntegrationsValueJsonByKey(INTEGRATIONS_KEY)
  const settings =
    settingsRaw && typeof settingsRaw === 'object' && !Array.isArray(settingsRaw)
      ? (settingsRaw as { tiktokPixelId?: string; tiktokEventsApiToken?: string })
      : {}
  const pixelId = String(settings.tiktokPixelId ?? '').trim()
  const accessToken = String(settings.tiktokEventsApiToken ?? '').trim()
  if (!pixelId || !accessToken) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'missing_pixel_or_token' })
  }

  const sent = await sendTikTokWebEvent({
    pixelId,
    accessToken,
    event,
    eventId,
    eventTimeSec: Math.floor(Date.now() / 1000),
    eventSourceUrl,
    contentId,
    contentName: readString(body, 'contentName') || contentId,
    valueVnd: Math.round(Number(body.valueVnd) || 0),
    orderId: readString(body, 'orderId'),
    clientIp: clientIpFromRequest(request),
    userAgent: request.headers.get('user-agent'),
    ttclid: readString(body, 'ttclid'),
    ttp: readString(body, 'ttp'),
  })
  if (!sent.ok) return NextResponse.json({ ok: false, error: sent.error }, { status: 502 })
  return NextResponse.json({ ok: true })
}
