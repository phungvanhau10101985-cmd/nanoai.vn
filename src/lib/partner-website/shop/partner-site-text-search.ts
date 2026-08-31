/**
 * Text search parity with 188-com-vn `/?q=` (word-AND on search_document).
 * Vector ANN is only the empty-catalog fallback — same role as NanoAI text-search on 188.
 */

/** Khớp frontend 188 `generateSlug` — dùng nhận diện sale + danh mục. */
export function generate188SearchSlug(text: string): string {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

const SALE_LISTING_SLUGS = new Set([
  'sale',
  'kho-sale',
  'thanh-ly',
  'thanh-ly-kho',
  'sale-soc',
  'sale-so',
  'hang-sale',
  'hang-thanh-ly',
])

/** Từ khóa «sale» / thanh lý → `/kho-sale` (188 `isSaleListingSearchTerm`). */
export function isSaleListingSearchTerm(raw: string): boolean {
  const term = String(raw || '').trim()
  if (!term) return false
  return SALE_LISTING_SLUGS.has(generate188SearchSlug(term))
}

const SEARCH_CHAT_TAILS = [
  'có không bạn',
  'còn không bạn',
  'có hàng không',
  'có không ạ',
  'được không',
  'còn không',
  'có không',
  'không bạn',
  'có bạn',
  'bạn ơi',
  'shop ơi',
  'không ạ',
  'có ko',
  'ko bạn',
  'ạ',
  'nhé',
  'nhỉ',
  'hả',
  'đi',
  'không',
  'có',
  'bạn',
  'ko',
] as const

const SEARCH_CHAT_HEADS = [
  'bạn ơi',
  'shop ơi',
  'cho mình hỏi',
  'mình muốn tìm',
  'tìm giúp',
  'xem hộ',
  'có',
] as const

/** Bỏ cụm hội thoại — khớp 188 `strip_search_chat_filler`. */
export function stripSearchChatFiller(query: string): string {
  if (!query || typeof query !== 'string') return ''
  let s = query.trim().toLowerCase().replace(/\s+/g, ' ').trim()
  if (!s) return ''
  const original = s
  let changed = true
  while (changed && s) {
    changed = false
    for (const tail of SEARCH_CHAT_TAILS) {
      if (s === tail) {
        s = ''
        changed = true
        break
      }
      const suffix = ` ${tail}`
      if (s.endsWith(suffix)) {
        s = s.slice(0, -suffix.length).trim()
        changed = true
        break
      }
    }
    if (!s) break
    for (const head of SEARCH_CHAT_HEADS) {
      const prefix = `${head} `
      if (s.startsWith(prefix)) {
        s = s.slice(prefix.length).trim()
        changed = true
        break
      }
    }
  }
  return s || original
}

/**
 * Tách từ khóa: tất cả từ phải khớp ILIKE trên search_document (188 `_search_products_by_words`).
 * Không tìm trong mô tả sản phẩm.
 */
export function tokenizePartnerTextSearch(raw: string): string[] {
  const stripped = stripSearchChatFiller(raw)
  const normalized = stripped.replace(/\s+/g, ' ').trim()
  if (!normalized) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of normalized.split(' ')) {
    const w = part.trim().slice(0, 40)
    if (!w) continue
    const key = w.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(w)
    if (out.length >= 12) break
  }
  return out
}

export function escapeIlikeToken(raw: string): string {
  return raw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

export type PartnerSearchCategoryNode = {
  slug: string
  name: string
  path: string
  depth?: number
}

/**
 * Khớp slug danh mục như 188 `navigateProductTextSearch` — L1 rồi L2 rồi L3, match đầu tiên thắng.
 */
export function matchPartnerCategoryPathForSearch(
  rawQuery: string,
  categories: PartnerSearchCategoryNode[]
): string | null {
  const target = generate188SearchSlug(rawQuery)
  if (!target) return null
  const sorted = categories.slice().sort((a, b) => (a.depth ?? 99) - (b.depth ?? 99) || a.path.localeCompare(b.path))
  for (const c of sorted) {
    const slug = generate188SearchSlug(c.slug || c.name)
    const nameSlug = generate188SearchSlug(c.name)
    if (target === slug || (nameSlug && target === nameSlug)) {
      const path = String(c.path || '').trim().replace(/^\/+|\/+$/g, '')
      return path || null
    }
  }
  return null
}

/**
 * SQL haystack — cùng cột 188 `SEARCH_DOCUMENT_FIELDS` (không `description`).
 * `catalog_json` keys cover Excel snapshot when denormalized columns are empty.
 */
export const PARTNER_TEXT_SEARCH_DOCUMENT_SQL = `lower(
  coalesce(mpi.name, '') || ' ' ||
  coalesce(mpi.catalog_slug, '') || ' ' ||
  coalesce(mpi.sku, '') || ' ' ||
  coalesce(mpi.remarketing_id, '') || ' ' ||
  coalesce(mpi.category_l1, '') || ' ' ||
  coalesce(mpi.category_l2, '') || ' ' ||
  coalesce(mpi.category_l3, '') || ' ' ||
  coalesce(mpi.material_note, '') || ' ' ||
  coalesce(mpi.style, '') || ' ' ||
  coalesce(mpi.color_summary, '') || ' ' ||
  coalesce(mpi.occasion, '') || ' ' ||
  coalesce(mpi.features_json::text, '') || ' ' ||
  coalesce(mpi.sizes_json::text, '') || ' ' ||
  coalesce(mpi.product_info_json::text, '') || ' ' ||
  coalesce(mpi.catalog_json->>'category', '') || ' ' ||
  coalesce(mpi.catalog_json->>'subcategory', '') || ' ' ||
  coalesce(mpi.catalog_json->>'sub_subcategory', '') || ' ' ||
  coalesce(mpi.catalog_json->>'material', '') || ' ' ||
  coalesce(mpi.catalog_json->>'style', '') || ' ' ||
  coalesce(mpi.catalog_json->>'color', '') || ' ' ||
  coalesce(mpi.catalog_json->>'occasion', '') || ' ' ||
  coalesce(mpi.catalog_json->>'code', '') || ' ' ||
  coalesce(mpi.catalog_json->>'slug', '') || ' ' ||
  coalesce(mpi.catalog_json->>'features', '') || ' ' ||
  coalesce(mpi.catalog_json->>'sizes', '') || ' ' ||
  coalesce(mpi.catalog_json->>'product_info', '')
)`

/** Fallback khi DB chưa có cột catalog 188. */
export const PARTNER_TEXT_SEARCH_DOCUMENT_SQL_FALLBACK = `lower(
  coalesce(mpi.name, '') || ' ' ||
  coalesce(mpi.sku, '') || ' ' ||
  coalesce(mpi.material_note, '')
)`
