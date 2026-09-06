import { cookies, headers } from 'next/headers'
import {
  PARTNER_LIVE_DEVICE_COOKIE,
  readPartnerVisualDeviceFromHeaders,
} from '@/lib/auth/app-request-headers'
import { resolveLiveVisualRequestDevice } from '@/lib/partner-website/shop/infer-live-visual-request-device'
import type { VisualDeviceVariant } from '@/lib/partner-website/visual-editor/visual-editor-pages'

/** UA / Client Hints / cookie when `?pw-device=` is absent. Live loads only this machine's HTML. */
export function inferLiveVisualRequestDevice(): VisualDeviceVariant {
  const headerStore = headers()
  return resolveLiveVisualRequestDevice({
    queryOrHeader: readPartnerVisualDeviceFromHeaders((name) => headerStore.get(name)),
    cookieDevice: cookies().get(PARTNER_LIVE_DEVICE_COOKIE)?.value || '',
    viewportWidth: Number(
      headerStore.get('sec-ch-viewport-width') || headerStore.get('viewport-width') || 0
    ),
    devicePixelRatio: Number(headerStore.get('sec-ch-dpr') || 0),
    userAgent: headerStore.get('user-agent') || '',
  })
}
