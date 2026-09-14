/**
 * Khớp 188 `apply_listing_year_sanitize_to_product_data` — bỏ năm marketing
 * trên trường Việt. Không đụng `chinese_name`.
 */
const YEAR = '(?:19|20)\\d{2}'
const YEAR_RES = [
  new RegExp(`${YEAR}\\s*年\\s*(?:春|夏|秋|冬)?(?:季)?(?:新)?(?:款|品|货)?`, 'giu'),
  new RegExp(`(?:hàng|model|collection|xuất\\s*xưởng|ra\\s*mắt|sản\\s*xuất)\\s*(?:năm\\s*)?${YEAR}\\b`, 'giu'),
  new RegExp(`\\bnăm\\s*(?:sản\\s*xuất|ra\\s*mắt|sx)?\\s*${YEAR}\\b`, 'giu'),
  new RegExp(`\\bnăm\\s+${YEAR}\\b`, 'giu'),
  new RegExp(`\\b${YEAR}\\s+mới\\b`, 'giu'),
  new RegExp(`\\bmới\\s+${YEAR}\\b`, 'giu'),
  new RegExp(`\\b${YEAR}\\s*(?:新款|新品|新货)\\b`, 'giu'),
]

function collapseWs(s: string): string {
  return s.replace(/\s{2,}/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim()
}

function sanitizeViListingField(text: string): string {
  let t = text
  for (const rx of YEAR_RES) t = t.replace(rx, ' ')
  t = t.replace(new RegExp(`\\b${YEAR}\\b`, 'g'), ' ')
  return collapseWs(t)
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

export function applyListingYearSanitizeToProductData(productData: Record<string, unknown>): void {
  const limits: Record<string, number> = {
    name: 500,
    description: 20000,
    material: 500,
    style: 500,
    occasion: 500,
  }
  for (const [key, maxLen] of Object.entries(limits)) {
    const cur = productData[key]
    if (!cur) continue
    const cleaned = sanitizeViListingField(String(cur))
    if (cleaned) productData[key] = cleaned.slice(0, maxLen)
  }
  const pi = asRecord(productData.product_info)
  if (!pi) return
  const inner = asRecord(pi.product_info)
  if (inner) {
    for (const key of ['name', 'material_vi', 'target_audience_suggestion_vi', 'brand', 'origin']) {
      if (inner[key]) inner[key] = sanitizeViListingField(String(inner[key])).slice(0, 500)
    }
  }
  const spec = asRecord(pi.specifications)
  if (spec) {
    for (const key of ['style', 'occasion', 'upper_material']) {
      if (spec[key]) spec[key] = sanitizeViListingField(String(spec[key])).slice(0, 500)
    }
  }
}
