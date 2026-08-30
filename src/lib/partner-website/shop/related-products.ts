import { escapeAttr, escapeHtml } from '@/lib/packaging/mockup-share-html'
import type { WebLocale } from '@/lib/i18n/config'
import { shopCardDisplaySrc } from '@/lib/partner-website/shop/inventory-shop-detail'
import type { PartnerSiteShopProduct } from '@/lib/partner-website/shop/inventory-to-shop-product'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  clampProductGridRows,
  PW_GRID_COLS_NARROW,
  PW_GRID_COLS_WIDE,
  productGridPageSize,
} from '@/lib/partner-website/shop/pw-product-grid-page'
import {
  partnerSiteCategoryPath,
  partnerSiteProductPath,
  partnerSiteProductsPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import { PW_KIND_SCENE_MEDIA, pwKindSceneAttr } from '@/lib/partner-website/visual-editor/pw-kind-scene'
import { PW_EL, PW_REGION, pwElAttr, pwRegionAttr } from '@/lib/partner-website/visual-editor/pw-ui-contract'

export const PW_RELATED_ATTR = 'data-pw-related'
export const PW_RELATED_LIMIT_DEFAULT = 24

export type RelatedProductCard = {
  id: string
  name: string
  imageUrl: string
  priceHint?: string | null
}

export type RelatedProductContext = {
  categoryId: string | null
  categoryPath: string | null
}

export function shopProductsToRelatedBind(products: PartnerSiteShopProduct[]): RelatedProductCard[] {
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    imageUrl: p.imageUrl,
    priceHint: p.priceHint || null,
  }))
}

export function relatedListingHref(input: {
  siteSlug?: string | null
  categoryPath?: string | null
}): string {
  const slug = String(input.siteSlug || '').trim()
  if (!slug) return '#'
  const path = String(input.categoryPath || '').trim()
  return path ? partnerSiteCategoryPath(slug, path) : partnerSiteProductsPath(slug)
}

export function isRelatedCatalogOpenTag(open: string): boolean {
  if (/\bdata-pw-personalize\s*=/.test(open)) return false
  if (/\bdata-pw-outfit\s*=/.test(open) || /\bdata-pw-grid-kind\s*=\s*(["']?)outfit\1/.test(open)) return false
  if (/\bdata-pw-related\s*=\s*(["']?)1\1/.test(open)) return true
  if (/\bdata-pw-grid-kind\s*=\s*(["']?)related\1/.test(open)) return true
  if (/\bdata-pw-grid-kind\s*=/.test(open)) return false
  if (/\bdata-pw-added-catalog\s*=/.test(open)) return false
  return /\bdata-pw-catalog\b/.test(open) || /\bdata-pw-region\s*=\s*(["']?)catalog\1/.test(open)
}

export function relatedCardHtml(
  item: RelatedProductCard,
  opts?: { siteSlug?: string | null }
): string {
  const slug = String(opts?.siteSlug || '').trim()
  const href = slug && item.id ? escapeAttr(partnerSiteProductPath(slug, item.id, { name: item.name })) : '#'
  const price = String(item.priceHint || '').trim()
  const imageUrl = shopCardDisplaySrc(item.imageUrl)
  const media = imageUrl
    ? `<img src="${escapeAttr(imageUrl)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" />`
    : ''
  return `<article class="pw-product-card pw-related-card" ${pwElAttr(PW_EL.card)} data-inventory-id="${escapeAttr(item.id)}">
  <a class="pw-product-card-media" href="${href}" ${pwElAttr(PW_EL.cardMedia)}>${media}</a>
  <div class="pw-product-card-body pw-related-card-body">
    <h4 ${pwElAttr(PW_EL.cardName)}><a href="${href}">${escapeHtml(item.name)}</a></h4>
    ${price ? `<p class="pw-price" ${pwElAttr(PW_EL.cardPrice)}>${escapeHtml(price)}</p>` : ''}
  </div>
</article>`
}

export function buildRelatedProductsSectionHtml(input: {
  locale?: WebLocale
  siteSlug?: string | null
  limit?: number
  rows?: number
  cards?: RelatedProductCard[] | null
  categoryId?: string | null
  categoryPath?: string | null
  excludeId?: string | null
  added?: boolean
}): string {
  const locale = input.locale || 'vi'
  const t = getPartnerSiteShopCopy(locale)
  const rows = clampProductGridRows(input.rows)
  const pageSize = productGridPageSize(rows, PW_GRID_COLS_WIDE)
  const slug = String(input.siteSlug || '').trim()
  const cards = (input.cards ?? []).filter((c) => String(c?.id || '').trim())
  const cardHtml = cards.length
    ? cards.map((item) => relatedCardHtml(item, { siteSlug: slug })).join('')
    : placeholderRelatedCards(pageSize, t.relatedProducts)
  const categoryId = String(input.categoryId || '').trim()
  const excludeId = String(input.excludeId || '').trim()
  const added = input.added ? ' data-pw-added-catalog="1"' : ''
  const loadMore = t.gridLoadMore || t.loadMore
  return `<section class="pw-related pw-catalog" ${pwRegionAttr(PW_REGION.catalog)}${pwKindSceneAttr(PW_KIND_SCENE_MEDIA)} data-pw-bg-role="catalog" data-pw-catalog data-pw-related="1" data-pw-grid-kind="related" data-pw-grid-cols="${PW_GRID_COLS_WIDE}" data-pw-grid-cols-mobile="${PW_GRID_COLS_NARROW}" data-pw-grid-rows="${rows}" data-limit="${pageSize}"${added}${
    categoryId ? ` data-category-id="${escapeAttr(categoryId)}"` : ''
  }${excludeId ? ` data-exclude="${escapeAttr(excludeId)}"` : ''}>
  <h3 class="pw-related-title" ${pwElAttr(PW_EL.sectionTitle)}>${escapeHtml(t.relatedProducts)}</h3>
  <div class="pw-product-grid pw-related-grid" style="margin-top:12px" ${pwElAttr(PW_EL.grid)} data-pw-grid>${cardHtml}</div>
  <div class="pw-related-actions pw-grid-actions" data-pw-grid-actions>
    <button type="button" class="pw-related-more pw-grid-more" data-pw-related-more data-pw-grid-more>
      <span class="pw-related-more-icon pw-grid-more-icon" aria-hidden="true">↻</span>
      ${escapeHtml(loadMore)}
    </button>
  </div>
  <p class="pw-catalog-empty pw-related-empty" hidden>${escapeHtml(t.relatedEmpty)}</p>
</section>`
}

function placeholderRelatedCards(count: number, label: string): string {
  let out = ''
  for (let i = 1; i <= count; i += 1) {
    out += `<article class="pw-product-card pw-related-card" ${pwElAttr(PW_EL.card)} data-pw-grid-placeholder="1">
  <div class="pw-product-card-media" ${pwElAttr(PW_EL.cardMedia)} style="background:var(--pw-surface,#f3f4f6)"></div>
  <div class="pw-product-card-body pw-related-card-body">
    <h4 ${pwElAttr(PW_EL.cardName)}>${escapeHtml(label)} ${i}</h4>
    <p class="pw-price" ${pwElAttr(PW_EL.cardPrice)}>—</p>
  </div>
</article>`
  }
  return out
}

export { PW_RELATED_CSS } from '@/lib/partner-website/shop/related-products-css'
