/**
 * Khớp 188 `compact_product_info_for_web` — thu gọn cột AK sau taxonomy.
 * Bỏ pairs / vipomall_rows / CJK spec / market_info scrape.
 */

const INNER_WEB_KEYS = [
  'sku',
  'name',
  'brand',
  'category',
  'target_audience_suggestion_vi',
  'name_vi',
  'display_name_vi',
  'material_vi',
] as const

const SPEC_WEB_KEYS = [
  'upper_material',
  'lining_material',
  'outsole_material',
  'style',
  'occasion',
  'heel_height',
  'thong_so_kich_thuoc_vi',
  'weight_note_vi',
  'weight_grams',
] as const

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function truthy(val: unknown): boolean {
  if (val == null) return false
  if (typeof val === 'string') return Boolean(val.trim())
  if (Array.isArray(val)) return val.length > 0
  if (typeof val === 'object') return Object.keys(val as object).length > 0
  return true
}

function shouldCompactImportStyleProductInfo(pi: Record<string, unknown>): boolean {
  const inner = asRecord(pi.product_info)
  if (inner) {
    const src = String(inner.source || '').toLowerCase()
    if (src === 'vipomall' || src === 'pandamall') return true
    if (String(inner.origin || '').toLowerCase() === '1688' && inner.listing_sku_hint) return true
  }
  const variants = asRecord(pi.variants)
  if (variants) {
    const src = String(variants.source || '').toLowerCase()
    if (src === 'vipomall' || src === 'pandamall') return true
  }
  const mk = asRecord(pi.market_info)
  if (mk && String(mk.currency || '').trim().toUpperCase() === 'MNT') return true
  return false
}

function pickKeys(
  src: Record<string, unknown> | null,
  keys: readonly string[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (!src) return out
  for (const k of keys) {
    if (!(k in src)) continue
    const v = src[k]
    if (!truthy(v)) continue
    if (k === 'category' && v && typeof v === 'object' && !Array.isArray(v)) {
      const rec = v as Record<string, unknown>
      if (!Object.values(rec).some((vv) => vv != null && String(vv).trim())) continue
    }
    out[k] = v
  }
  return out
}

/** Mutate `product_data.product_info` thành JSON web gọn như 188. */
export function compactListingImportProductInfoForWeb(productData: Record<string, unknown>): void {
  const pi = asRecord(productData.product_info)
  if (!pi) return
  if (!shouldCompactImportStyleProductInfo(pi)) return

  const slimInner = pickKeys(asRecord(pi.product_info), INNER_WEB_KEYS)
  const slimSpec = pickKeys(asRecord(pi.specifications), SPEC_WEB_KEYS)
  const varSrc = asRecord(pi.variants)
  const slimVar: Record<string, unknown> = {}
  if (varSrc) {
    for (const k of ['colors', 'sizes'] as const) {
      if (!(k in varSrc)) continue
      const v = varSrc[k]
      if (!truthy(v)) continue
      slimVar[k] = v
    }
  }

  const next: Record<string, unknown> = {}
  if (Object.keys(slimInner).length) next.product_info = slimInner
  if (Object.keys(slimSpec).length) next.specifications = slimSpec
  if (Object.keys(slimVar).length) next.variants = slimVar
  const ta = asRecord(pi.target_audience)
  if (ta && Object.keys(ta).length) next.target_audience = ta
  productData.product_info = Object.keys(next).length ? next : {}
}
