import { headers } from 'next/headers'
import { readPartnerVisualDeviceFromHeaders } from '@/lib/auth/app-request-headers'
import {
  parseVisualDeviceQuery,
  type VisualDeviceVariant,
} from '@/lib/partner-website/visual-editor/visual-editor-pages'
import { pwResolveCoordinateDevice } from '@/lib/partner-website/visual-editor/pw-coordinate-space'

/** UA / Client Hints when `?pw-device=` is absent. Live loads only this machine's HTML. */
export function inferLiveVisualRequestDevice(): VisualDeviceVariant {
  const headerStore = headers()
  const fromHeader = parseVisualDeviceQuery(readPartnerVisualDeviceFromHeaders((name) => headerStore.get(name)))
  if (fromHeader) return fromHeader
  const requestViewportWidth = Number(
    headerStore.get('sec-ch-viewport-width') || headerStore.get('viewport-width') || 0
  )
  const requestDpr = Number(headerStore.get('sec-ch-dpr') || 0)
  const userAgent = headerStore.get('user-agent') || ''
  if (Number.isFinite(requestViewportWidth) && requestViewportWidth > 0) {
    return pwResolveCoordinateDevice({
      outerWidth: requestViewportWidth,
      layoutWidth: requestViewportWidth,
      devicePixelRatio: requestDpr,
    })
  }
  if (/ipad|tablet|kindle|silk/i.test(userAgent)) return 'tablet'
  if (/mobile|iphone|ipod|android/i.test(userAgent)) return 'mobile'
  return 'desktop'
}
