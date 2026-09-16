import type { WebLocale } from '@/lib/i18n/config'
import { escapeAttr, escapeHtml } from '@/lib/packaging/mockup-share-html'
import { listingCardFavHtml, listingCardStatsHtml } from '@/lib/partner-website/shop/listing-card-html'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { PW_EL, pwElAttr } from '@/lib/partner-website/visual-editor/pw-ui-contract'
import {
  getShopTemplateSampleBannerImages,
  getShopTemplateSampleCategories,
  getShopTemplateSampleProducts,
  type ShopTemplateSampleProduct,
} from '@/lib/partner-website/template/shop-template-sample-products'

export const PW_SAMPLE_PREVIEW_ATTR = 'data-pw-sample-preview'

const SAMPLE_RATINGS = [4.9, 4.8, 4.7, 4.6, 5, 4.8]
const SAMPLE_SOLD = [186, 92, 240, 128, 67, 310, 154, 88]

function stampAttrOnTag(html: string, tag: 'html' | 'body', name: string, value: string): string {
  const re = new RegExp(`<${tag}\\b([^>]*)>`, 'i')
  if (!re.test(html)) return html
  return html.replace(re, (_full, attrs: string) => {
    if (new RegExp(`\\b${name}=`, 'i').test(attrs)) {
      return `<${tag}${attrs.replace(new RegExp(`\\s${name}=(["'])[^"']*\\1`, 'i'), ` ${name}="${value}"`)}>`
    }
    return `<${tag}${attrs} ${name}="${value}">`
  })
}

export function stampShopTemplateSamplePreviewInHtml(html: string): string {
  if (!html.trim()) return html
  return stampAttrOnTag(stampAttrOnTag(html, 'html', PW_SAMPLE_PREVIEW_ATTR, '1'), 'body', PW_SAMPLE_PREVIEW_ATTR, '1')
}

function sampleCardHtml(input: {
  product: ShopTemplateSampleProduct
  favoriteLabel: string
  soldLabel: string
  index: number
  rec?: boolean
  badge?: string
  sale?: boolean
}): string {
  const recClass = input.rec ? ' pw-rec-card' : ''
  const rating = SAMPLE_RATINGS[input.index % SAMPLE_RATINGS.length] || 4.8
  const sold = SAMPLE_SOLD[input.index % SAMPLE_SOLD.length] || 120
  const listPrice = input.sale
    ? `<span class="pw-price-was" style="display:block;margin:0;font-size:12px;color:var(--pw-muted,#6b7280);font-weight:500;text-decoration:line-through">${escapeHtml(input.product.compareAtPrice || '')}</span>`
    : ''
  const badge = input.badge
    ? `<span class="pw-rec-badge">${escapeHtml(input.badge)}</span>`
    : ''
  return `<article class="pw-product-card${recClass}" ${pwElAttr(PW_EL.card)} data-pw-sample-card="1">
  <div class="pw-product-card-media" ${pwElAttr(PW_EL.cardMedia)}>
    <img src="${escapeAttr(input.product.imageUrl)}" alt="${escapeAttr(input.product.name)}" width="400" height="400" loading="lazy" decoding="async"/>
    ${badge}
    ${listingCardFavHtml('', input.favoriteLabel)}
  </div>
  <div class="pw-product-card-body">
    <h3 ${pwElAttr(PW_EL.cardName)}>${escapeHtml(input.product.name)}</h3>
    <p class="pw-price" ${pwElAttr(PW_EL.cardPrice)}>${escapeHtml(input.product.price)}</p>
    ${listPrice}
    ${listingCardStatsHtml({ rating, sold, soldLabel: input.soldLabel })}
  </div>
</article>`
}

function paintPlaceholderCards(
  html: string,
  locale: WebLocale,
  opts: { rec?: boolean; badge?: string; sale?: boolean; offset?: number }
): string {
  const products = getShopTemplateSampleProducts(locale)
  const copy = getPartnerSiteShopCopy(locale)
  let index = opts.offset || 0
  return html.replace(
    /<article\b([^>]*\bdata-pw-grid-placeholder=["']1["'][^>]*)>[\s\S]*?<\/article>/gi,
    () => {
      const product = products[index % products.length]!
      const painted = sampleCardHtml({
        product,
        favoriteLabel: copy.favoriteAdd || 'Thích',
        soldLabel: copy.pdpPurchasesLabel || 'Đã bán',
        index,
        rec: opts.rec,
        badge: opts.badge,
        sale: opts.sale && Boolean(product.compareAtPrice),
      })
      index += 1
      return painted
    }
  )
}

function paintSectionCards(
  html: string,
  locale: WebLocale,
  attr: string,
  opts: { rec?: boolean; badge?: string; sale?: boolean; offset?: number }
): string {
  const re = new RegExp(`(<section\\b[^>]*${attr}[^>]*>)([\\s\\S]*?)(<\\/section>)`, 'i')
  return html.replace(re, (_full, open: string, inner: string, close: string) => {
    return `${open}${paintPlaceholderCards(inner, locale, opts)}${close}`
  })
}

function paintFeaturedTiles(html: string, locale: WebLocale): string {
  const cats = getShopTemplateSampleCategories(locale)
  if (!cats.length) return html
  let index = 0
  const next = html.replace(/<a\b([^>]*\bpw-featured-cat-card\b[^>]*)>([\s\S]*?)<\/a>/gi, (_full, attrs: string) => {
    if (index >= cats.length) return ''
    const cat = cats[index]!
    index += 1
    const cleaned = String(attrs || '').replace(/\sdata-pw-grid-placeholder=(["'])[^"']*\1/gi, '')
    return `<a${cleaned}>
  <span class="pw-featured-cat-media" ${pwElAttr(PW_EL.cardMedia)}><img src="${escapeAttr(cat.imageUrl)}" alt="${escapeAttr(cat.name)}" width="240" height="240" loading="lazy" decoding="async"/></span>
  <span ${pwElAttr(PW_EL.cardName)}>${escapeHtml(cat.name)}</span>
</a>`
  })
  return next.replace(
    /<(section|div)\b([^>]*\bdata-pw-featured-categories=["']1["'][^>]*)>/gi,
    (full, tag: string, attrs: string) => {
      if (/\bdata-pw-featured-live=/.test(attrs)) return full
      return `<${tag}${attrs} data-pw-featured-live="1">`
    }
  )
}

function paintBannerImages(html: string): string {
  const images = getShopTemplateSampleBannerImages()
  const order = ['birthday', 'sale', 'warehouse', 'regular'] as const
  let index = 0
  return html.replace(/<img\b([^>]*\bdata-pw-banner-placeholder=["']1["'][^>]*)>/gi, (_full, imgAttrs: string) => {
    const slot = order[index] || order[index % order.length]
    index += 1
    const src = slot ? images[slot] : ''
    if (!src) return `<img${imgAttrs}>`
    let next = String(imgAttrs || '')
      .replace(/\sdata-pw-banner-placeholder=(["'])[^"']*\1/gi, '')
      .replace(/\bsrc=["'][^"']*["']/i, `src="${escapeAttr(src)}"`)
    if (!/\bsrc=/.test(next)) next += ` src="${escapeAttr(src)}"`
    next = next.replace(/object-fit:\s*contain/gi, 'object-fit:cover')
    return `<img${next}>`
  })
}

function stampNavLive(html: string): string {
  return html.replace(
    /<(nav|div)\b([^>]*\bdata-pw-personalize-nav=["']recent-categories["'][^>]*)>/gi,
    (full, tag: string, attrs: string) => {
      if (/\bdata-pw-nav-live=/.test(attrs)) return full
      return `<${tag}${attrs} data-pw-nav-live="1">`
    }
  )
}

/** Gallery `/mau-giao-dien`: fill seed placeholders so the sample looks like a live shop. */
export function paintShopTemplateSamplePreviewInHtml(html: string, locale: WebLocale): string {
  if (!html.trim()) return html
  let out = stampShopTemplateSamplePreviewInHtml(html)
  out = paintSectionCards(out, locale, 'data-pw-personalize=["\']flash-sale["\']', {
    rec: true,
    offset: 0,
  })
  out = paintSectionCards(out, locale, 'data-pw-personalize=["\']recommended["\']', {
    rec: true,
    badge: locale === 'vi' ? 'Đề xuất' : locale === 'zh' ? '推荐' : locale === 'ja' ? 'おすすめ' : locale === 'ko' ? '추천' : 'For you',
    offset: 4,
  })
  out = paintSectionCards(out, locale, 'data-sale=["\']1["\']', {
    sale: true,
    offset: 2,
  })
  out = paintPlaceholderCards(out, locale, { offset: 1 })
  out = paintFeaturedTiles(out, locale)
  out = paintBannerImages(out)
  out = stampNavLive(out)
  return out
}
