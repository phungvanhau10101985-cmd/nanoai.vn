import { PARTNER_LIVE_DEVICE_COOKIE } from '@/lib/auth/app-request-headers'
import {
  parseVisualDeviceQuery,
  type VisualDeviceVariant,
} from '@/lib/partner-website/visual-editor/visual-editor-pages'
import { pwResolveCoordinateDevice } from '@/lib/partner-website/visual-editor/pw-coordinate-space'

/** Keep the last live machine so the *next* navigation serves that HTML file. Never F5 the open tab. */
export const PARTNER_LIVE_DEVICE_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 7

/**
 * Phone vs tablet from UA. Android tablets usually omit "Mobile"; phones include it.
 * iPadOS 13+ desktop UA (`Macintosh` + touch) needs `maxTouchPoints` on the client.
 */
export function inferVisualDeviceFromUserAgent(
  userAgent: string,
  maxTouchPoints = 0
): VisualDeviceVariant | null {
  const ua = String(userAgent || '')
  if (/ipad|tablet|kindle|silk/i.test(ua)) return 'tablet'
  if (/iphone|ipod/i.test(ua)) return 'mobile'
  if (/android/i.test(ua)) return /mobile/i.test(ua) ? 'mobile' : 'tablet'
  if (/mobile/i.test(ua)) return 'mobile'
  if (Number(maxTouchPoints) > 1 && /macintosh/i.test(ua)) return 'tablet'
  return null
}

/** UA the server can see without Client Hints or touch points — cookie must not override these. */
export function liveVisualDeviceVisibleInUserAgent(userAgent: string): VisualDeviceVariant | null {
  return inferVisualDeviceFromUserAgent(userAgent, 0)
}

/** Pure: `?pw-device=` wins; phone/tablet UA wins; narrow viewport (F12) wins over leftover desktop cookie. */
export function resolveLiveVisualRequestDevice(input: {
  queryOrHeader?: string | null
  cookieDevice?: string | null
  viewportWidth?: number
  devicePixelRatio?: number
  userAgent?: string
  maxTouchPoints?: number
}): VisualDeviceVariant {
  const locked = parseVisualDeviceQuery(input.queryOrHeader)
  if (locked) return locked
  const fromUa = inferVisualDeviceFromUserAgent(
    input.userAgent || '',
    Number(input.maxTouchPoints || 0)
  )
  if (fromUa === 'mobile' || fromUa === 'tablet') return fromUa
  const width = Number(input.viewportWidth || 0)
  const fromCh =
    Number.isFinite(width) && width > 0
      ? pwResolveCoordinateDevice({
          outerWidth: width,
          layoutWidth: width,
          devicePixelRatio: Number(input.devicePixelRatio || 0),
        })
      : null
  if (fromCh === 'mobile' || fromCh === 'tablet') return fromCh
  const fromCookie = parseVisualDeviceQuery(input.cookieDevice)
  if (fromCookie) return fromCookie
  return fromCh || 'desktop'
}

/** Same width rule as live HTML client: phone UA / F12 <1280 uses innerWidth; desktop window uses outerWidth. */
export function resolveLiveVisualDeviceFromViewport(input: {
  forceDevice?: VisualDeviceVariant | null
  userAgent?: string | null
  innerWidth?: number
  outerWidth?: number
  devicePixelRatio?: number
  maxTouchPoints?: number
}): VisualDeviceVariant {
  if (input.forceDevice) return input.forceDevice
  const ua = String(input.userAgent || '')
  const fromUa = liveVisualDeviceVisibleInUserAgent(ua)
  const cssWidth = Number(input.innerWidth || 0)
  return resolveLiveVisualRequestDevice({
    viewportWidth:
      fromUa === 'mobile' || fromUa === 'tablet' || (cssWidth > 0 && cssWidth < 1280)
        ? cssWidth
        : Number(input.outerWidth || cssWidth),
    devicePixelRatio: Number(input.devicePixelRatio || 0),
    userAgent: ua,
    maxTouchPoints: Number(input.maxTouchPoints || 0),
  })
}

export function partnerLiveVisualDeviceCookieAssignment(
  device: VisualDeviceVariant,
  userAgent: string
): string {
  const uaVisible = liveVisualDeviceVisibleInUserAgent(userAgent)
  if (uaVisible === 'mobile' || uaVisible === 'tablet') {
    return `${PARTNER_LIVE_DEVICE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
  }
  return `${PARTNER_LIVE_DEVICE_COOKIE}=${device}; Path=/; Max-Age=${PARTNER_LIVE_DEVICE_COOKIE_MAX_AGE_SEC}; SameSite=Lax`
}

/** Write `pw-live-device` for the next request. Must not `location.reload` — deposit / editor / cart stay on screen. */
export function persistPartnerLiveVisualDeviceCookie(
  device: VisualDeviceVariant,
  userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''
): void {
  if (typeof document === 'undefined') return
  document.cookie = partnerLiveVisualDeviceCookieAssignment(device, userAgent)
}
