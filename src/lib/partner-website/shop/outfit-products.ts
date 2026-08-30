import { escapeAttr, escapeHtml } from '@/lib/packaging/mockup-share-html'
import type { WebLocale } from '@/lib/i18n/config'
import { shopCardDisplaySrc } from '@/lib/partner-website/shop/inventory-shop-detail'
import type { PartnerSiteShopProduct } from '@/lib/partner-website/shop/inventory-to-shop-product'
import {
  OUTFIT_SLOT_IDS,
  outfitSectionTitle,
  outfitSlotLabel,
  type OutfitSlotId,
} from '@/lib/partner-website/shop/pdp-outfit-roles'
import type { PartnerOutfitSuggestions } from '@/lib/partner-website/shop/pdp-outfit-suggestions'
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

export const PW_OUTFIT_ATTR = 'data-pw-outfit'
export const PW_OUTFIT_LIMIT_DEFAULT = 12

export type OutfitProductCard = {
  id: string
  name: string
  imageUrl: string
  priceHint?: string | null
  reason?: string | null
}

export function outfitSuggestionsToBind(data: PartnerOutfitSuggestions | null | undefined): {
  title: string | null
  slots: Array<{ id: string; label: string; listingHref: string; items: OutfitProductCard[] }>
} {
  if (!data?.applicable || !data.slots.length) return { title: data?.anchor?.title || null, slots: [] }
  return {
    title: data.anchor?.title || null,
    slots: data.slots.map((slot) => ({
      id: slot.id,
      label: slot.label,
      listingHref: slot.listingHref,
      items: slot.items.map((item) => ({
        id: item.product.id,
        name: item.product.name,
        imageUrl: item.product.imageUrl,
        priceHint: item.product.priceHint || null,
        reason: item.reasons[0] || null,
      })),
    })),
  }
}

export function shopProductsToOutfitBind(products: PartnerSiteShopProduct[], reason?: string | null): OutfitProductCard[] {
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    imageUrl: p.imageUrl,
    priceHint: p.priceHint || null,
    reason: reason || null,
  }))
}

export function outfitListingHref(input: {
  siteSlug?: string | null
  categoryPath?: string | null
}): string {
  const slug = String(input.siteSlug || '').trim()
  if (!slug) return '#'
  const path = String(input.categoryPath || '').trim()
  return path ? partnerSiteCategoryPath(slug, path) : partnerSiteProductsPath(slug)
}

export function isOutfitCatalogOpenTag(open: string): boolean {
  if (/\bdata-pw-outfit\s*=\s*(["']?)1\1/.test(open)) return true
  return /\bdata-pw-grid-kind\s*=\s*(["']?)outfit\1/.test(open)
}

export function outfitCardHtml(item: OutfitProductCard, opts?: { siteSlug?: string | null }): string {
  const slug = String(opts?.siteSlug || '').trim()
  const href = slug && item.id ? escapeAttr(partnerSiteProductPath(slug, item.id, { name: item.name })) : '#'
  const price = String(item.priceHint || '').trim()
  const reason = String(item.reason || '').trim()
  const imageUrl = shopCardDisplaySrc(item.imageUrl)
  const media = imageUrl
    ? `<img src="${escapeAttr(imageUrl)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" />`
    : ''
  return `<article class="pw-product-card pw-outfit-card" ${pwElAttr(PW_EL.card)} data-inventory-id="${escapeAttr(item.id)}">
  <a class="pw-product-card-media" href="${href}" ${pwElAttr(PW_EL.cardMedia)}>${media}</a>
  <div class="pw-product-card-body pw-outfit-card-body">
    <h4 ${pwElAttr(PW_EL.cardName)}><a href="${href}">${escapeHtml(item.name)}</a></h4>
    ${reason ? `<p class="pw-outfit-reason">${escapeHtml(reason)}</p>` : ''}
    ${price ? `<p class="pw-price" ${pwElAttr(PW_EL.cardPrice)}>${escapeHtml(price)}</p>` : ''}
  </div>
</article>`
}

export function buildOutfitProductsSectionHtml(input: {
  locale?: WebLocale
  siteSlug?: string | null
  limit?: number
  rows?: number
  cards?: OutfitProductCard[] | null
  excludeId?: string | null
  role?: OutfitSlotId | null
  slots?: OutfitSlotId[] | null
  added?: boolean
}): string {
  const locale = input.locale || 'vi'
  const t = getPartnerSiteShopCopy(locale)
  const rows = clampProductGridRows(input.rows)
  const pageSize = productGridPageSize(rows, PW_GRID_COLS_WIDE)
  const slug = String(input.siteSlug || '').trim()
  const cards = (input.cards ?? []).filter((c) => String(c?.id || '').trim())
  const cardHtml = cards.length
    ? cards.map((item) => outfitCardHtml(item, { siteSlug: slug })).join('')
    : placeholderOutfitCards(pageSize, t.outfitTitleFallback)
  const excludeId = String(input.excludeId || '').trim()
  const added = input.added ? ' data-pw-added-catalog="1"' : ''
  const title = outfitSectionTitle(input.role ?? null, locale)
  const slots = (input.slots?.length ? input.slots : OUTFIT_SLOT_IDS).slice(0, 6)
  const slotHtml = slots
    .map(
      (slot, i) =>
        `<button type="button" class="pw-outfit-slot${i === 0 ? ' is-active' : ''}" role="tab" data-pw-outfit-slot="${slot}" aria-selected="${i === 0 ? 'true' : 'false'}">${escapeHtml(outfitSlotLabel(slot, locale))}</button>`
    )
    .join('')
  const loadMore = t.gridLoadMore || t.loadMore
  return `<section class="pw-outfit pw-catalog" ${pwRegionAttr(PW_REGION.catalog)}${pwKindSceneAttr(PW_KIND_SCENE_MEDIA)} data-pw-bg-role="catalog" ${PW_OUTFIT_ATTR}="1" data-pw-grid-kind="outfit" data-pw-grid-cols="${PW_GRID_COLS_WIDE}" data-pw-grid-cols-mobile="${PW_GRID_COLS_NARROW}" data-pw-grid-rows="${rows}" data-limit="${pageSize}"${added}${
    excludeId ? ` data-exclude="${escapeAttr(excludeId)}"` : ''
  }>
  <h3 class="pw-outfit-title" ${pwElAttr(PW_EL.sectionTitle)}>${escapeHtml(title)}</h3>
  <p class="pw-outfit-subtitle">${escapeHtml(t.outfitSubtitle)}</p>
  <div class="pw-outfit-slots" role="tablist" data-pw-outfit-slots aria-label="${escapeAttr(t.outfitSlotsAria)}">${slotHtml}</div>
  <div class="pw-product-grid pw-outfit-grid" style="margin-top:12px" ${pwElAttr(PW_EL.grid)} data-pw-grid>${cardHtml}</div>
  <div class="pw-outfit-actions pw-grid-actions" data-pw-grid-actions>
    <button type="button" class="pw-outfit-more pw-grid-more" data-pw-outfit-more data-pw-grid-more>
      <span class="pw-outfit-more-icon pw-grid-more-icon" aria-hidden="true">↻</span>
      ${escapeHtml(loadMore)}
    </button>
  </div>
  <p class="pw-catalog-empty pw-outfit-empty" hidden>${escapeHtml(t.outfitEmpty)}</p>
</section>`
}

function placeholderOutfitCards(count: number, label: string): string {
  let out = ''
  for (let i = 1; i <= count; i += 1) {
    out += `<article class="pw-product-card pw-outfit-card" ${pwElAttr(PW_EL.card)} data-pw-grid-placeholder="1">
  <div class="pw-product-card-media" ${pwElAttr(PW_EL.cardMedia)} style="background:var(--pw-surface,#f3f4f6)"></div>
  <div class="pw-product-card-body pw-outfit-card-body">
    <h4 ${pwElAttr(PW_EL.cardName)}>${escapeHtml(label)} ${i}</h4>
    <p class="pw-price" ${pwElAttr(PW_EL.cardPrice)}>—</p>
  </div>
</article>`
  }
  return out
}

export { PW_OUTFIT_CSS } from '@/lib/partner-website/shop/outfit-products-css'
