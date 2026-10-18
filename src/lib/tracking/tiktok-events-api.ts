/**
 * TikTok Events API (web). Pixel id là event_source_id, token là Access-Token.
 * @see https://business-api.tiktok.com/portal/docs?id=1771100865818625
 */

const TIKTOK_TRACK_URL = 'https://business-api.tiktok.com/open_api/v1.3/event/track/'

export type TikTokWebEventName = 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'CompletePayment'

export type TikTokWebEventInput = {
  pixelId: string
  accessToken: string
  event: TikTokWebEventName
  eventId: string
  eventTimeSec: number
  eventSourceUrl: string
  contentId: string
  contentName: string
  valueVnd: number
  orderId?: string
  clientIp?: string | null
  userAgent?: string | null
  ttclid?: string | null
  ttp?: string | null
  emailSha256?: string | null
}

export function buildTikTokEventTrackBody(input: TikTokWebEventInput): Record<string, unknown> {
  const value = Math.max(0, Math.round(input.valueVnd))
  const contentId = input.contentId.trim().slice(0, 100)
  const user: Record<string, string> = {}
  const ip = String(input.clientIp || '').trim()
  const ua = String(input.userAgent || '').trim()
  const ttclid = String(input.ttclid || '').trim()
  const ttp = String(input.ttp || '').trim()
  const email = String(input.emailSha256 || '').trim().toLowerCase()
  if (ip) user.ip = ip.slice(0, 64)
  if (ua) user.user_agent = ua.slice(0, 512)
  if (ttclid) user.ttclid = ttclid.slice(0, 256)
  if (ttp) user.ttp = ttp.slice(0, 256)
  if (/^[a-f0-9]{64}$/.test(email)) user.email = email
  const properties: Record<string, unknown> = {
    currency: 'VND',
    value,
    content_type: 'product',
    contents: [
      {
        content_id: contentId,
        content_type: 'product',
        content_name: input.contentName.trim().slice(0, 200) || contentId,
        quantity: 1,
        price: value,
      },
    ],
  }
  const orderId = String(input.orderId || '').trim()
  if (orderId) properties.order_id = orderId.slice(0, 80)
  return {
    event_source: 'web',
    event_source_id: input.pixelId.trim(),
    data: [
      {
        event: input.event,
        event_time: Math.max(0, Math.floor(input.eventTimeSec)),
        event_id: input.eventId.trim().slice(0, 128),
        user,
        properties,
        page: { url: input.eventSourceUrl.trim().slice(0, 2000) },
      },
    ],
  }
}

export async function sendTikTokWebEvent(
  input: TikTokWebEventInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const pixelId = input.pixelId.trim()
  const accessToken = input.accessToken.trim()
  if (!pixelId || !accessToken) return { ok: false, error: 'missing_pixel_or_token' }
  try {
    const res = await fetch(TIKTOK_TRACK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Access-Token': accessToken,
      },
      body: JSON.stringify(buildTikTokEventTrackBody(input)),
    })
    const json = (await res.json().catch(() => null)) as { message?: string; code?: number } | null
    if (!res.ok || (json && typeof json.code === 'number' && json.code !== 0)) {
      return { ok: false, error: json?.message || res.statusText || 'tiktok_events_error' }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'fetch_failed' }
  }
}
