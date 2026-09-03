import { headers } from 'next/headers'
import { readPartnerVisualDeviceFromHeaders } from '@/lib/auth/app-request-headers'
import {
  parseVisualDeviceQuery,
  type VisualDeviceVariant,
} from '@/lib/partner-website/visual-editor/visual-editor-pages'
import { pwResolveCoordinateDevice } from '@/lib/partner-website/visual-editor/pw-coordinate-space'

function deviceFromUserAgent(userAgent: string): VisualDeviceVariant | null {
  if (/ipad|tablet|kindle|silk/i.test(userAgent)) return 'tablet'
  if (/mobile|iphone|ipod|android/i.test(userAgent)) return 'mobile'
  return null
}

/** Pure: query/header lock wins; phone UA wins over a wide Client Hint (DevTools). */
export function resolveLiveVisualRequestDevice(input: {
  queryOrHeader?: string | null
  viewportWidth?: number
  devicePixelRatio?: number
  userAgent?: string
}): VisualDeviceVariant {
  const locked = parseVisualDeviceQuery(input.queryOrHeader)
  if (locked) return locked
  const fromUa = deviceFromUserAgent(input.userAgent || '')
  const width = Number(input.viewportWidth || 0)
  const fromCh =
    Number.isFinite(width) && width > 0
      ? pwResolveCoordinateDevice({
          outerWidth: width,
          layoutWidth: width,
          devicePixelRatio: Number(input.devicePixelRatio || 0),
        })
      : null
  if (fromUa === 'mobile' || fromUa === 'tablet') {
    if (fromCh === 'mobile' || fromCh === 'tablet') return fromCh
    return fromUa
  }
  return fromCh || 'desktop'
}

/** UA / Client Hints / `x-pw-device` when `?pw-device=` is absent. Live loads only this machine's HTML. */
export function inferLiveVisualRequestDevice(): VisualDeviceVariant {
  const headerStore = headers()
  return resolveLiveVisualRequestDevice({
    queryOrHeader: readPartnerVisualDeviceFromHeaders((name) => headerStore.get(name)),
    viewportWidth: Number(
      headerStore.get('sec-ch-viewport-width') || headerStore.get('viewport-width') || 0
    ),
    devicePixelRatio: Number(headerStore.get('sec-ch-dpr') || 0),
    userAgent: headerStore.get('user-agent') || '',
  })
}
