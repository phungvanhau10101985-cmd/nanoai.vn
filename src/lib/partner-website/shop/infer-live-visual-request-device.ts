import { PARTNER_LIVE_DEVICE_COOKIE } from '@/lib/auth/app-request-headers'
import {
  parseVisualDeviceQuery,
  type VisualDeviceVariant,
} from '@/lib/partner-website/visual-editor/visual-editor-pages'
import {
  PW_SCALED_FHD_CSS_MIN,
  pwResolveCoordinateDevice,
} from '@/lib/partner-website/visual-editor/pw-coordinate-space'

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

/** Pure: `?pw-device=` wins; phone/tablet UA wins; a truly narrow window wins over leftover desktop cookie. */
export function resolveLiveVisualRequestDevice(input: {
  queryOrHeader?: string | null
  cookieDevice?: string | null
  viewportWidth?: number
  screenWidth?: number
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
  const screenWidth = Number(input.screenWidth || 0)
  let fromCh =
    Number.isFinite(width) && width > 0
      ? pwResolveCoordinateDevice({
          outerWidth: width,
          layoutWidth: width,
          screenWidth: screenWidth || width,
          devicePixelRatio: Number(input.devicePixelRatio || 0),
        })
      : null
  if (fromCh === 'tablet' && width >= PW_SCALED_FHD_CSS_MIN && !(Number(input.devicePixelRatio || 0) > 0)) {
    fromCh = null
  } else if (fromCh === 'mobile' || fromCh === 'tablet') {
    return fromCh
  }
  const fromCookie = parseVisualDeviceQuery(input.cookieDevice)
  if (fromCookie === 'mobile' || fromCookie === 'tablet') {
    return fromCh || 'desktop'
  }
  if (fromCookie) return fromCookie
  return fromCh || 'desktop'
}

/**
 * Device lock for a desktop OS window uses `outerWidth` (plus screen + DPR).
 * Phone/tablet UA (F12 device mode) uses `innerWidth`. A scrollbar that drops
 * CSS px just under 1280 must not switch a Windows FHD desktop to tablet.
 */
export function resolveLiveVisualDeviceFromViewport(input: {
  forceDevice?: VisualDeviceVariant | null
  userAgent?: string | null
  innerWidth?: number
  outerWidth?: number
  screenWidth?: number
  devicePixelRatio?: number
  maxTouchPoints?: number
}): VisualDeviceVariant {
  if (input.forceDevice) return input.forceDevice
  const ua = String(input.userAgent || '')
  const fromUa = liveVisualDeviceVisibleInUserAgent(ua)
  const cssWidth = Number(input.innerWidth || 0)
  const outer = Number(input.outerWidth || 0)
  const screen = Number(input.screenWidth || 0)
  const lockWidth =
    fromUa === 'mobile' || fromUa === 'tablet'
      ? cssWidth || outer || screen
      : outer || screen || cssWidth
  return resolveLiveVisualRequestDevice({
    viewportWidth: lockWidth,
    screenWidth: screen || outer || cssWidth,
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

/**
 * Injected into live HTML runtimes. Stamp / `?pw-device=` win; else `__pwCoordinate`
 * (FHD-aware). Phone UA still uses innerWidth via the same resolver on the next hop.
 */
export const PW_LIVE_DOM_DEVICE_JS = `
function pwLiveDomDevice(){
  var html=document.documentElement;
  var q='';
  try{q=new URLSearchParams(location.search).get('pw-device')||'';}catch(e){}
  var d=String(q||(html&&html.getAttribute('data-pw-edit-device'))||(html&&html.getAttribute('data-pw-scene-lock'))||'').toLowerCase();
  if(d==='mobile'||d==='tablet'||d==='laptop'||d==='desktop')return d;
  var inner=window.innerWidth||0;
  var outer=window.outerWidth||0;
  var scr=window.screen||{};
  var screenW=Math.max(Number(scr.width)||0,Number(scr.availWidth)||0)||0;
  var dpr=window.devicePixelRatio||0;
  var ua=String((navigator&&navigator.userAgent)||'');
  if(/ipad|tablet|kindle|silk/i.test(ua))return 'tablet';
  if(/iphone|ipod/i.test(ua))return 'mobile';
  if(/android/i.test(ua))return /mobile/i.test(ua)?'mobile':'tablet';
  if(/mobile/i.test(ua))return 'mobile';
  var C=window.__pwCoordinate;
  if(C&&typeof C.resolveDevice==='function'){
    return C.resolveDevice({outerWidth:outer||screenW||inner,layoutWidth:inner,screenWidth:screenW||outer||inner,devicePixelRatio:dpr});
  }
  var w=outer||screenW||inner;
  if(dpr>=1.25&&dpr<2&&w>=1080)return 'desktop';
  if(w<768)return 'mobile';
  if(w<1280)return 'tablet';
  if(w<1440)return 'laptop';
  return 'desktop';
}
`.trim()

/** Browser: stamp / query / viewport (FHD-aware). */
export function readLiveDomDeviceFromWindow(): VisualDeviceVariant {
  if (typeof window === 'undefined' || typeof document === 'undefined') return 'desktop'
  let queryDevice = ''
  try {
    queryDevice = new URLSearchParams(window.location.search).get('pw-device') || ''
  } catch {
    queryDevice = ''
  }
  const stamped = parseVisualDeviceQuery(
    queryDevice ||
      document.documentElement.getAttribute('data-pw-edit-device') ||
      document.documentElement.getAttribute('data-pw-scene-lock')
  )
  if (stamped) return stamped
  return resolveLiveVisualDeviceFromViewport({
    userAgent: navigator.userAgent || '',
    innerWidth: window.innerWidth || 0,
    outerWidth: window.outerWidth || 0,
    screenWidth: Math.max(window.screen?.width || 0, window.screen?.availWidth || 0),
    devicePixelRatio: window.devicePixelRatio || 0,
    maxTouchPoints: navigator.maxTouchPoints || 0,
  })
}
