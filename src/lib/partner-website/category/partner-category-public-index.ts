/**
 * Index công khai trang `/c/{path}` — không 301 cluster 188.
 * Mọi cấp: cần SP trong nhánh (rollup). L3 thêm: đã sinh SEO.
 */

export function partnerCategoryHasGeneratedSeo(row: {
  seoTitle?: string | null
  seoDescription?: string | null
  seoBody?: string | null
}): boolean {
  return Boolean(row.seoTitle?.trim() && row.seoDescription?.trim() && row.seoBody?.trim())
}

/** Mega / hub / pill: hiện khi nhánh còn hàng. `productCount` = rollup, không chỉ gán trực tiếp. */
export function isPartnerCategoryStorefrontVisible(input: {
  productCount: number
  isNavJunk?: boolean
}): boolean {
  if (input.isNavJunk) return false
  return input.productCount > 0
}

export function isPartnerCategoryPublicIndexable(input: {
  depth: number
  seoIndex: boolean
  productCount: number
  hasGeneratedSeo: boolean
  isNavJunk?: boolean
}): boolean {
  if (!isPartnerCategoryStorefrontVisible(input)) return false
  if (!input.seoIndex) return false
  if (input.depth >= 3) return input.hasGeneratedSeo
  return true
}

/**
 * File 188 ghi cat3 `noindex` (gom cluster). NanoAI không có landing cluster —
 * lưu L3 `index` rồi live/sitemap tự noindex khi 0 SP hoặc thiếu SEO.
 */
export function storedSeoIndexForTaxonomyCategory(level: number, fileSeoIndex: boolean): boolean {
  if (level >= 3) return true
  return fileSeoIndex
}

/** robots meta / Next Metadata — L3 trống: noindex,follow. */
export function partnerCategoryRobotsContent(indexable: boolean, followWhenNoIndex = false): string {
  if (indexable) return 'index, follow, max-image-preview:large, max-snippet:-1'
  return followWhenNoIndex ? 'noindex, follow' : 'noindex, nofollow'
}
