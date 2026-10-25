/** `window.name` / `window.open` target — đồng bộ giữa viewer và trang giáo viên. */
export const TEACHER_SLIDE_WINDOW_TARGET_NAME = 'app-teacher-view'

/**
 * Cửa sổ trình chiếu tách khỏi tab, cùng kích thước với mở slide tiết học.
 * Gọi trực tiếp trong sự kiện bấm để trình duyệt không chặn popup.
 */
export function openDetachedTeacherSlideWindow(path: string): Window | null {
  if (typeof window === 'undefined') return null
  const href = path.trim()
  if (!href) return null
  const sw = typeof screen !== 'undefined' ? screen.width || screen.availWidth || 1920 : 1920
  const sh = typeof screen !== 'undefined' ? screen.height || screen.availHeight || 1080 : 1080
  return window.open(href, `giao-vien-${Date.now()}`, `width=${sw},height=${sh},scrollbars=yes,left=0,top=0`)
}

/** Dùng cửa sổ đã mở sẵn (trước lúc chờ API), không thì mở cửa sổ mới. */
export function navigateDetachedTeacherSlideWindow(existing: Window | null, path: string): Window | null {
  const href = path.trim()
  if (!href) return existing
  if (existing && !existing.closed) {
    try {
      existing.location.href = href
      existing.focus()
      return existing
    } catch {
      /* mở cửa sổ khác */
    }
  }
  return openDetachedTeacherSlideWindow(href)
}
