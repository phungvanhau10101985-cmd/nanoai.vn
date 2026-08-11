/**
 * W4.11 — industry-gated facets. Fashion exposes size/color from inventory options JSON;
 * other industries return empty facet defs (no fashion leakage into core).
 */

export type PartnerShopFacetKey = 'size' | 'color'

export type PartnerShopFacetDef = {
  key: PartnerShopFacetKey
  /** i18n key hint for UI */
  labelKey: 'sizeLabel' | 'colorLabel'
}

export function partnerShopFacetDefsForIndustry(
  industryKey: 'fashion' | 'hotel' | 'food' | 'other' | null | undefined
): PartnerShopFacetDef[] {
  if (industryKey === 'fashion') {
    return [
      { key: 'size', labelKey: 'sizeLabel' },
      { key: 'color', labelKey: 'colorLabel' },
    ]
  }
  return []
}

/** Same storage as getProductPurchaseOptions: sizes in description JSON array.
 * PS.1 — `structured` (cột `sizes_json` mới) được ưu tiên khi có; `description` chỉ là fallback quy ước cũ. */
export function parseInventorySizesForFacet(
  description: string | null | undefined,
  structured?: string[] | null
): string[] {
  if (structured && structured.length) return structured.slice(0, 40)
  const raw = String(description ?? '').trim()
  if (!raw.startsWith('[')) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((x) => String(x ?? '').trim())
      .filter(Boolean)
      .slice(0, 40)
  } catch {
    return []
  }
}

/** Colors in stock_note JSON — array of {name} or strings.
 * PS.1 — `structured` (cột `colors_json` mới) được ưu tiên khi có; `stockNote` chỉ là fallback quy ước cũ. */
export function parseInventoryColorsForFacet(
  stockNote: string | null | undefined,
  structured?: { name: string; img?: string }[] | null
): string[] {
  if (structured && structured.length) {
    return structured
      .map((c) => c.name.trim())
      .filter(Boolean)
      .slice(0, 40)
  }
  const raw = String(stockNote ?? '').trim()
  if (!raw.startsWith('[')) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const names: string[] = []
    for (const item of parsed) {
      if (typeof item === 'string' && item.trim()) names.push(item.trim())
      else if (item && typeof item === 'object' && 'name' in item) {
        const n = String((item as { name?: unknown }).name ?? '').trim()
        if (n) names.push(n)
      }
    }
    return names.slice(0, 40)
  } catch {
    return []
  }
}
