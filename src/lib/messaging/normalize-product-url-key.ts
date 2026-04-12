/** Chuẩn hoá URL trang sản phẩm để so khớp «đã tư vấn» / gộp trùng. */
export function normalizeProductUrlKey(productUrl: string): string {
  const raw = (productUrl || '').trim()
  if (!raw) return ''
  try {
    const u = new URL(raw)
    const normalizedPath = u.pathname.replace(/\/+$/, '')
    return `${u.origin.toLowerCase()}${normalizedPath.toLowerCase()}`
  } catch {
    return raw.toLowerCase()
  }
}
