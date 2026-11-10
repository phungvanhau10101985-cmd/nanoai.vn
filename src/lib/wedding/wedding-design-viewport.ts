/** Khổ giấy cố định. Sửa, xem thử và khách xem cùng một bề ngang. */
export const WEDDING_DESKTOP_WIDTH = 1440
export const WEDDING_MOBILE_WIDTH = 390
/** Chiều một khổ giấy. Vỏ thiệp bám khổ này. Nội dung thiệp lặp hoa văn theo từng khổ, từ trên xuống dưới. */
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

/**
 * Điện thoại rộng hơn khổ giấy mà trình duyệt không tự phóng thì khổ 390 dồn sát trái,
 * ảnh to bị cắt mép trái và còn khe bên phải. Phóng vừa bề ngang máy, không phóng màn hình máy tính.
 */
export function weddingDesignFillScale(designWidth: number, visualWidth: number, layoutWidth: number): number {
  if (designWidth <= 0 || visualWidth <= 0) return 1
  if (visualWidth <= designWidth * 1.01) return 1
  if (visualWidth > designWidth * 1.35) return 1
  if (layoutWidth > 0 && visualWidth <= layoutWidth + 1) return 1
  const scale = visualWidth / designWidth
  if (!Number.isFinite(scale) || scale <= 1) return 1
  return Math.round(scale * 1000) / 1000
}

/** Meta viewport để media query và vw thấy đúng khổ giấy, giống iframe sửa. */
export function weddingDesignViewportContent(device: WeddingDesignDevice, scale = 1): string {
  const width = weddingDesignWidth(device)
  const zoom = scale > 1.01 ? `, initial-scale=${scale}` : ''
  return `width=${width}${zoom}, viewport-fit=cover`
}

export function shouldLockWeddingDesignViewport(search: string): boolean {
  const params = new URLSearchParams(search.replace(/^\?/, ''))
  if (params.get('layout') === 'full') return false
  if (params.get('demo') === '1') return false
  return true
}

/** Xem thử giữ pixel thật, không phóng khổ giấy ra cả màn hình. */
export function weddingNaturalViewportContent(): string {
  return 'width=device-width, initial-scale=1, viewport-fit=cover'
}

export function weddingDesignDeviceFromSearch(search: string, fallbackWidth: number): WeddingDesignDevice {
  const params = new URLSearchParams(search.replace(/^\?/, ''))
  if (!shouldLockWeddingDesignViewport(search)) return weddingDesignDeviceFromWidth(fallbackWidth)
  const forced = params.get('device')
  if (forced === 'desktop') return 'desktop'
  return 'mobile'
}

export function weddingDesignViewportBootScript(): string {
  // visualViewport, không innerWidth: bề ngang khổ giấy vẫn khóa, chỉ phóng cho vừa máy.
  // Nhân thêm scale để script chạy lần hai (sau khi đã phóng) không xóa initial-scale.
  return `(function(){try{var q=new URLSearchParams(location.search);if(q.get('layout')==='full')return;var desktop=q.get('device')==='desktop';var meta=document.querySelector('meta[name="viewport"]');if(!meta){meta=document.createElement('meta');meta.setAttribute('name','viewport');document.head.appendChild(meta)}if(q.get('demo')==='1'){meta.setAttribute('content','${weddingNaturalViewportContent()}');document.documentElement.setAttribute('data-wedding-design',desktop?'desktop':'mobile');return}var width=desktop?${WEDDING_DESKTOP_WIDTH}:${WEDDING_MOBILE_WIDTH};var device=0;try{var vv=window.visualViewport;if(vv&&vv.width){var pinch=vv.scale||1;device=vv.width*(pinch>0?pinch:1)}}catch(e){}var scale=1;if(!desktop&&width>0&&device>width*1.01&&device<=width*1.35){scale=Math.round(device/width*1000)/1000}var zoom=scale>1.01?', initial-scale='+scale:'';meta.setAttribute('content','width='+width+zoom+', viewport-fit=cover');document.documentElement.setAttribute('data-wedding-design',desktop?'desktop':'mobile')}catch(e){}})();`
}

/**
 * Tỉ lệ vỏ. Android và trang trong thiệp chỉ theo bề ngang.
 * Vỏ iOS (`fitSafeHeight`) co vừa vùng an toàn, chữ và nút không chui vào tai thỏ hay thanh home.
 */
export function weddingIosCoverFitScale(input: {
  fitSafeHeight: boolean
  fitHeight: boolean
  viewWidth: number
  safeHeight: number
  contentHeight: number
  designWidth: number
  maxScale?: number
}): number {
  if (input.designWidth <= 0) return 1
  const widthScale = input.viewWidth > 0 ? input.viewWidth / input.designWidth : 1
  const heightScale = input.safeHeight > 0 && input.contentHeight > 0 ? input.safeHeight / input.contentHeight : widthScale
  const raw = input.fitHeight || input.fitSafeHeight ? Math.min(widthScale, heightScale) : widthScale
  if (!Number.isFinite(raw) || raw <= 0) return 1
  return Math.min(raw, input.maxScale ?? Number.POSITIVE_INFINITY)
}

export function isIosWeddingWebKit(): boolean {
  if (typeof navigator === 'undefined') return false
  if (/iP(hone|ad|od)/.test(navigator.userAgent)) return true
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
}

function weddingFillVisualWidth(designWidth: number): number {
  const cap = designWidth * 1.35
  const viewport = window.visualViewport
  const width = viewport?.width || window.innerWidth || 0
  const pinch = viewport?.scale || 1
  const visual = width * (pinch > 0 ? pinch : 1)
  if (visual > designWidth && visual <= cap) return visual
  return designWidth
}

export function applyWeddingDesignViewport(device: WeddingDesignDevice, options?: { natural?: boolean }) {
  if (typeof document === 'undefined') return
  let meta = document.querySelector('meta[name="viewport"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('name', 'viewport')
    document.head.appendChild(meta)
  }
  document.documentElement.setAttribute('data-wedding-design', device)
  const designWidth = weddingDesignWidth(device)
  const scale = options?.natural ? 1 : weddingDesignFillScale(designWidth, weddingFillVisualWidth(designWidth), 0)
  const next = options?.natural ? weddingNaturalViewportContent() : weddingDesignViewportContent(device, scale)
  const current = meta.getAttribute('content') || ''
  // Script đầu trang ghi meta trước khi trình duyệt chịu áp. Ghi lại một lần nếu khổ giấy chưa khớp.
  const layoutMiss = !options?.natural && scale > 1.01 && Math.abs(document.documentElement.clientWidth - designWidth) > 1
  if (current !== next || layoutMiss) meta.setAttribute('content', next)
}
