/**
 * Khớp ảnh màu/mẫu trong palette với URL đã chọn (tránh lệch do http/https, query, dấu / cuối).
 */
export function normalizeColorImageUrlForMatch(raw: string): string {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  try {
    const u = new URL(s)
    u.hash = ''
    const path = u.pathname.replace(/\/+$/, '') || '/'
    return `${u.protocol}//${u.host}${path}${u.search}`.toLowerCase()
  } catch {
    return s.toLowerCase()
  }
}

export function findPaletteColorByImageUrl<T extends { img: string; name: string }>(
  palette: T[] | undefined | null,
  selectedImg: string
): T | undefined {
  if (!palette?.length) return undefined
  const direct = palette.find((x) => x.img === selectedImg)
  if (direct) return direct
  const want = normalizeColorImageUrlForMatch(selectedImg)
  return palette.find((x) => normalizeColorImageUrlForMatch(x.img) === want)
}
