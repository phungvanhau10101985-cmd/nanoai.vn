/** Khổ giấy cố định. Sửa, xem thử và khách xem cùng một bề ngang. */
export const WEDDING_DESKTOP_WIDTH = 1440
export const WEDDING_MOBILE_WIDTH = 390
/** Chiều khổ giấy. Hoa văn bám khổ này, không bám chiều nội dung. */
export const WEDDING_DESKTOP_HEIGHT = 900
export const WEDDING_MOBILE_HEIGHT = 844
export const WEDDING_DESKTOP_MIN_PX = 1024

export type WeddingDesignDevice = 'desktop' | 'mobile'

export function weddingDesignWidth(device: WeddingDesignDevice): number {
  return device === 'desktop' ? WEDDING_DESKTOP_WIDTH : WEDDING_MOBILE_WIDTH
}

export function weddingDesignDeviceFromWidth(width: number): WeddingDesignDevice {
  return width >= WEDDING_DESKTOP_MIN_PX ? 'desktop' : 'mobile'
}

/** Meta viewport để media query và vw thấy đúng khổ giấy, giống iframe sửa. */
export function weddingDesignViewportContent(device: WeddingDesignDevice): string {
  return `width=${weddingDesignWidth(device)}, viewport-fit=cover`
}

export function shouldLockWeddingDesignViewport(search: string): boolean {
  const params = new URLSearchParams(search.replace(/^\?/, ''))
  return params.get('layout') !== 'full'
}

export function weddingDesignDeviceFromSearch(search: string, fallbackWidth: number): WeddingDesignDevice {
  const params = new URLSearchParams(search.replace(/^\?/, ''))
  if (!shouldLockWeddingDesignViewport(search)) return weddingDesignDeviceFromWidth(fallbackWidth)
  const forced = params.get('device')
  if (forced === 'desktop' || forced === 'mobile') return forced
  return weddingDesignDeviceFromWidth(fallbackWidth)
}

export function weddingDesignViewportBootScript(): string {
  return `(function(){try{var q=new URLSearchParams(location.search);if(q.get('layout')==='full')return;var forced=q.get('device');var desktop=forced==='desktop'||(forced!=='mobile'&&window.innerWidth>=${WEDDING_DESKTOP_MIN_PX});var width=desktop?${WEDDING_DESKTOP_WIDTH}:${WEDDING_MOBILE_WIDTH};var meta=document.querySelector('meta[name="viewport"]');if(!meta){meta=document.createElement('meta');meta.setAttribute('name','viewport');document.head.appendChild(meta)}meta.setAttribute('content','width='+width+', viewport-fit=cover');document.documentElement.setAttribute('data-wedding-design',desktop?'desktop':'mobile')}catch(e){}})();`
}

export function applyWeddingDesignViewport(device: WeddingDesignDevice) {
  if (typeof document === 'undefined') return
  let meta = document.querySelector('meta[name="viewport"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('name', 'viewport')
    document.head.appendChild(meta)
  }
  meta.setAttribute('content', weddingDesignViewportContent(device))
  document.documentElement.setAttribute('data-wedding-design', device)
}
