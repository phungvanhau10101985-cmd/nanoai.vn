const GESTURE_ATTR = 'data-wedding-ornament-gesture'

/** Cú chạm đang nằm trên hoa văn. Khung ảnh và trang không được ăn vuốt đó. */
export function markWeddingOrnamentGesture(active: boolean) {
  if (typeof document === 'undefined') return
  if (active) document.documentElement.setAttribute(GESTURE_ATTR, '')
  else document.documentElement.removeAttribute(GESTURE_ATTR)
}

export function weddingOrnamentGestureActive() {
  return typeof document !== 'undefined' && document.documentElement.hasAttribute(GESTURE_ATTR)
}
