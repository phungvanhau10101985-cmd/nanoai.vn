/**
 * Server listing card — same 188 SimpleProductCard markup as catalog `renderCard`.
 * Bind at serve. Sửa nhanh keeps placeholders.
 */

import { escapeAttr, escapeHtml } from '@/lib/packaging/mockup-share-html'
import type { WebLocale } from '@/lib/i18n/config'
import { listingCardFavHtml, listingCardStatsHtml } from '@/lib/partner-website/shop/listing-card-html'
import {
  shopAboveFoldDisplaySrc,
  shopCardDisplaySrc,
} from '@/lib/partner-website/shop/inventory-shop-detail'
import type { PartnerSiteShopProduct } from '@/lib/partner-website/shop/inventory-to-shop-product'
import {
  formatPartnerSaleMoney,
  partnerSiteSaleCopy,
  resolvePartnerProductSaleFace,
} from '@/lib/partner-website/promotions/partner-site-sale-display'
import { PW_EL, pwElAttr } from '@/lib/partner-website/visual-editor/pw-ui-contract'

const FAVORITE: Record<WebLocale, string> = {
  vi: 'Thích',
  en: 'Favorite',
  zh: '收藏',
  ja: 'お気に入り',
  ko: '찜',
}

const SOLD: Record<WebLocale, string> = {
  vi: 'Đã bán',
  en: 'Sold',
  zh: '已售',
  ja: '販売',
  ko: '판매',
}

export type PartnerShopListingCardOpts = {
  locale?: WebLocale
  /** First above-fold card — eager + no `/api/fetch-image`. */
  priority?: boolean
  related?: boolean
}

function birthdayBits(product: PartnerSiteShopProduct, locale: WebLocale): {
  hintHtml: string
  badgeHtml: string
} {
  const pct = Math.max(
    0,
    Math.round(Number(product.birthdayOfferPercent || product.birthdayOffer?.percent || 0) || 0)
  )
  if (pct <= 0 || product.isClearance === true) return { hintHtml: '', badgeHtml: '' }
  const copy = partnerSiteSaleCopy(locale)
  const hint = String(copy.birthdayCheckoutHint || '').replace('{pct}', String(pct))
  const badge = String(copy.birthdayBadge || '').replace('{pct}', String(pct))
  return {
    hintHtml: hint ? `<small class="pw-price-birthday">${escapeHtml(hint)}</small>` : '',
    badgeHtml: badge ? `<span class="pw-badge-birthday">${escapeHtml(badge)}</span>` : '',
  }
}

function saleBadgeHtml(product: PartnerSiteShopProduct, locale: WebLocale): string {
  const sale = resolvePartnerProductSaleFace(product, locale)
  const copy = partnerSiteSaleCopy(locale)
  let out = ''
  if (sale.kind && sale.badge) {
    const chipKind = sale.promoKind === 'flash' ? 'flash' : sale.kind
    const chipLabel =
      sale.promoKind === 'flash'
        ? copy.flashRemaining
        : String((sale.kind === 'active' ? copy.countdownLeft : copy.countdownStarts) || '').replace(
            '{label}',
            sale.eventLabel || ''
          )
    const chip =
      sale.countdownTo && sale.promoKind !== 'clearance'
        ? `<span class="pw-sale-chip pw-sale-chip-${chipKind}" data-pw-sale-countdown="${escapeAttr(sale.countdownTo)}" data-pw-sale-phase="${escapeAttr(sale.kind)}" data-pw-sale-kind="${escapeAttr(sale.promoKind || '')}" data-pw-sale-label="${escapeAttr(sale.eventLabel || '')}">${escapeHtml(String(chipLabel || ''))} <span data-pw-sale-hms></span></span>`
        : ''
    out = `<span class="pw-badge-sale pw-badge-sale-${sale.kind}${sale.promoKind ? ` pw-badge-sale-${sale.promoKind}` : ''}">${escapeHtml(String(sale.badge || ''))}</span>${chip}`
  }
  return out + birthdayBits(product, locale).badgeHtml
}

function priceHtml(product: PartnerSiteShopProduct, locale: WebLocale): string {
  const sale = resolvePartnerProductSaleFace(product, locale)
  const copy = partnerSiteSaleCopy(locale)
  const extra = birthdayBits(product, locale).hintHtml
  if (!sale.kind) return `${escapeHtml(product.priceHint || '')}${extra}`
  if (sale.kind === 'teaser') {
    const expected = sale.expectedPrice != null ? formatPartnerSaleMoney(sale.expectedPrice, locale) : ''
    const save = String(copy.expectedSave || '')
      .replace('{program}', sale.eventLabel || '')
      .replace('{pct}', String(sale.percent))
      .replace('{amount}', formatPartnerSaleMoney(sale.savings, locale))
    return `<span class="pw-price-sale">${escapeHtml(formatPartnerSaleMoney(sale.displayPrice, locale))}</span> <span class="pw-price-expected">→ ${escapeHtml(expected)}</span><small class="pw-price-teaser">${escapeHtml(save)}</small>${extra}`
  }
  const save = sale.savings
    ? `<small class="pw-price-save">${escapeHtml(
        String(copy.save || '')
          .replace('{program}', sale.eventLabel || '')
          .replace('{amount}', formatPartnerSaleMoney(sale.savings, locale))
      )}</small>`
    : ''
  const compare =
    sale.comparePrice != null
      ? `<del class="pw-price-compare">${escapeHtml(formatPartnerSaleMoney(sale.comparePrice, locale))}</del>`
      : ''
  return `<span class="pw-price-sale">${escapeHtml(formatPartnerSaleMoney(sale.displayPrice, locale))}</span> ${compare}${save}${extra}`
}

/** One listing / related / personalize card. No add-to-cart. */
export function renderPartnerShopListingCardHtml(
  product: PartnerSiteShopProduct,
  opts?: PartnerShopListingCardOpts
): string {
  const locale = opts?.locale && localeOk(opts.locale) ? opts.locale : 'vi'
  const id = String(product.id || '').trim()
  const href = String(product.detailPath || '').trim() || '#'
  const name = String(product.name || 'Product').trim() || 'Product'
  const imgRaw = String(product.imageUrl || '').trim()
  const img = opts?.priority ? shopAboveFoldDisplaySrc(imgRaw) : shopCardDisplaySrc(imgRaw)
  const loading = opts?.priority ? 'eager' : 'lazy'
  const fetchPriority = opts?.priority ? ' fetchpriority="high"' : ''
  const badge = saleBadgeHtml(product, locale)
  const price = priceHtml(product, locale)
  const fav = listingCardFavHtml(id, FAVORITE[locale])
  const stats = listingCardStatsHtml({
    rating: product.ratingScore,
    sold: product.purchasesCount,
    soldLabel: SOLD[locale],
  })
  const related = Boolean(opts?.related)
  const titleTag = related ? 'h4' : 'h3'
  const relatedClass = related ? ' pw-related-card' : ''
  const bodyClass = related ? ' pw-related-card-body' : ''
  const imgTag = img
    ? `<img src="${escapeAttr(img)}" alt="${escapeAttr(name)}" loading="${loading}" decoding="async"${fetchPriority} referrerpolicy="no-referrer"/>`
    : ''
  return (
    `<article class="pw-product-card${relatedClass}" ${pwElAttr(PW_EL.card)} data-inventory-id="${escapeAttr(id)}" data-pw-actions-ready="1">` +
    `<div class="pw-product-card-media" ${pwElAttr(PW_EL.cardMedia)}>${badge}${imgTag}</div>` +
    `<div class="pw-product-card-body${bodyClass}"><${titleTag} ${pwElAttr(PW_EL.cardName)}><a href="${escapeAttr(href)}">${escapeHtml(name)}</a></${titleTag}>` +
    (price ? `<p class="pw-price" ${pwElAttr(PW_EL.cardPrice)}>${price}</p>` : '') +
    `${stats}</div>` +
    `<a class="pw-product-card-hit" href="${escapeAttr(href)}" aria-label="${escapeAttr(name)}" tabindex="-1"></a>` +
    `${fav}</article>`
  )
}

export function renderPartnerShopListingCardsHtml(
  products: PartnerSiteShopProduct[],
  opts?: PartnerShopListingCardOpts
): string {
  return products
    .map((product, i) =>
      renderPartnerShopListingCardHtml(product, { ...opts, priority: Boolean(opts?.priority) && i === 0 })
    )
    .join('')
}

function localeOk(value: string): value is WebLocale {
  return value === 'vi' || value === 'en' || value === 'zh' || value === 'ja' || value === 'ko'
}
