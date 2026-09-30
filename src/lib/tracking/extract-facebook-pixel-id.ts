/**
 * Pixel ID thuần hoặc snippet Meta dán tay — cùng cách 188 `_extract_facebook_pixel_id`.
 * Trả số (≥ 10 chữ số). Chuỗi rỗng = chưa nhập.
 */
export function extractFacebookPixelId(raw: string | null | undefined): string | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const init = s.match(/fbq\s*\(\s*['"]init['"]\s*,\s*['"](\d+)['"]/i)
  if (init?.[1] && init[1].length >= 10) return init[1]
  const tr = s.match(/facebook\.com\/tr\?[^"'\\\s]*\bid=(\d+)/i)
  if (tr?.[1] && tr[1].length >= 10) return tr[1]
  const digits = s.replace(/\D/g, '')
  return digits.length >= 10 ? digits : null
}
