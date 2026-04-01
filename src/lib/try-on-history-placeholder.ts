/**
 * Ảnh placeholder cho cột `original_image_url` / `garment_image_url` khi không có ảnh thật.
 * Không dùng URL trang (vd. /flow-nhac-video-veo) — `next/image` cần file ảnh.
 */
export const TRY_ON_HISTORY_INPUT_PLACEHOLDER_SRC = '/placeholders/veo-music-placeholder.svg'

const BAD_PATHNAMES = new Set(['/tao-video-tu-anh', '/flow-nhac-video-veo'])

/** Chuẩn hóa URL đã lưu sai (trang app thay vì ảnh) — dùng trên dashboard/history. */
export function normalizeTryOnHistoryInputImageUrl(url: string | null | undefined): string {
  const fallback = TRY_ON_HISTORY_INPUT_PLACEHOLDER_SRC
  if (!url?.trim()) return fallback
  const t = url.trim()
  try {
    const u = t.startsWith('http') || t.startsWith('//') ? new URL(t.startsWith('//') ? `https:${t}` : t) : new URL(t, 'https://placeholder.local')
    const path = (u.pathname || '/').replace(/\/$/, '') || '/'
    if (BAD_PATHNAMES.has(path)) return fallback
  } catch {
    /* ignore */
  }
  if (BAD_PATHNAMES.has(t.replace(/\/$/, '') || '/')) return fallback
  return t
}
