import {
  parseVisualDeviceQuery,
  type VisualDeviceVariant,
} from '@/lib/partner-website/visual-editor/visual-editor-pages'
import { pwResolveCoordinateDevice } from '@/lib/partner-website/visual-editor/pw-coordinate-space'

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

/** Pure: `?pw-device=` wins; phone/tablet UA wins over cookie and viewport (landscape iPhone ≠ tablet). */
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
  const fromCookie = parseVisualDeviceQuery(input.cookieDevice)
  if (fromCookie) return fromCookie
  const width = Number(input.viewportWidth || 0)
  const fromCh =
    Number.isFinite(width) && width > 0
      ? pwResolveCoordinateDevice({
          outerWidth: width,
          layoutWidth: width,
          devicePixelRatio: Number(input.devicePixelRatio || 0),
        })
      : null
  return fromCh || 'desktop'
}
