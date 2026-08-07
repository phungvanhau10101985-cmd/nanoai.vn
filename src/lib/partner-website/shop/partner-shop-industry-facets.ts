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

/** Same storage as getProductPurchaseOptions: sizes in description JSON array. */
export function parseInventorySizesForFacet(description: string | null | undefined): string[] {
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

/** Colors in stock_note JSON — array of {name} or strings. */
export function parseInventoryColorsForFacet(stockNote: string | null | undefined): string[] {
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
