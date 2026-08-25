/**
 * PDP visual HTML is one shared shell per device. Live inventory (images, name,
 * price, sku, description, sizes, colors) is rebound onto locked fields so every
 * product keeps its own content while buttons/layout stay in sync.
 */

import type { WebLocale } from '@/lib/i18n/config'
import {
  formatPartnerShopMoneyVnd,
  resolvePartnerEffectiveUnitPrice,
} from '@/lib/partner-website/shop/partner-shop-flash-sale'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { isOutfitCatalogOpenTag } from '@/lib/partner-website/shop/outfit-products'
import {
  buildRelatedProductsSectionHtml,
  isRelatedCatalogOpenTag,
  relatedCardHtml,
  relatedListingHref,
} from '@/lib/partner-website/shop/related-products'
import { PW_EL, PW_REGION } from '@/lib/partner-website/visual-editor/pw-ui-contract'

export type LivePdpBindColor = {
  name: string
  img?: string | null
}

export type LivePdpBindReview = {
  name: string
  rating?: number
  body: string
  title?: string | null
  imageUrls?: string[] | null
  merchantReply?: string | null
  merchantReplyBy?: string | null
  usefulCount?: number | null
}

export type LivePdpBindQuestion = {
  asker: string
  body: string
  answer?: string | null
  answerBy?: string | null
  answerType?: 'admin' | 'buyer' | null
}

export type LivePdpBindRelated = {
  id: string
  name: string
  imageUrl: string
  priceHint?: string | null
  /** Đường dẫn PDP của SP tương tự — build bằng `partnerSiteProductPath`. */
  detailPath?: string | null
}

export type LivePdpBindCrumb = {
  name: string
  href?: string | null
}

export type LivePdpBindProduct = {
  id: string
  name: string
  sku?: string | null
  description?: string | null
  detailDescription?: string | null
  consultNote?: string | null
  priceHint?: string | null
  priceAmount?: number | null
  salePriceAmount?: number | null
  saleStartsAt?: string | null
  saleEndsAt?: string | null
  imageUrl?: string | null
  galleryImages?: string[] | null
  detailImages?: string[] | null
  materialImageUrl?: string | null
  realUseImageUrls?: string[] | null
  productVideoUrl?: string | null
  sizeGuideImageUrl?: string | null
  depositPolicy?: boolean | null
  stockQty?: number | null
  sizes?: string[] | null
  colors?: LivePdpBindColor[] | null
  reviews?: LivePdpBindReview[] | null
  questions?: LivePdpBindQuestion[] | null
  relatedProducts?: LivePdpBindRelated[] | null
  breadcrumb?: LivePdpBindCrumb[] | null
  categoryId?: string | null
  categoryPath?: string | null
}

function escAttr(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
}

function escText(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
}

function maskHtmlForTagScan(html: string): string {
  return html.replace(
    /<!--[\s\S]*?-->|<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi,
    (block) => ' '.repeat(block.length)
  )
}

function closingTagIndex(masked: string, from: number, tag: string): number {
  const re = new RegExp(`<${tag}\\b[^>]*>|</${tag}\\s*>`, 'gi')
  re.lastIndex = from
  let depth = 1
  let match: RegExpExecArray | null
  while ((match = re.exec(masked))) {
    if (match[0][1] === '/') {
      depth -= 1
      if (depth === 0) return match.index
      continue
    }
    if (!/\/>$/.test(match[0])) depth += 1
  }
  return -1
}

function replaceRegionBlocks(html: string, region: string, rewrite: (inner: string, open: string) => string): string {
  const masked = maskHtmlForTagScan(html)
  const openRe = new RegExp(
    `<([a-z0-9]+)\\b(?=[^>]*\\bdata-pw-region=["']${region.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'])[^>]*>`,
    'gi'
  )
  const chunks: Array<{ start: number; end: number; next: string }> = []
  let match: RegExpExecArray | null
  while ((match = openRe.exec(masked))) {
    const tag = (match[1] || 'div').toLowerCase()
    const start = match.index
    const openEnd = start + match[0].length
    const close = closingTagIndex(masked, openEnd, tag)
    if (close < 0) continue
    const closeTok = html.slice(close).match(new RegExp(`^</${tag}\\s*>`, 'i'))
    const end = close + (closeTok?.[0].length ?? `</${tag}>`.length)
    openRe.lastIndex = end
    const open = html.slice(start, openEnd)
    const inner = html.slice(openEnd, close)
    chunks.push({ start, end, next: `${rewrite(inner, open)}${html.slice(close, end)}` })
  }
  if (!chunks.length) return html
  let out = ''
  let cursor = 0
  for (const chunk of chunks) {
    out += html.slice(cursor, chunk.start)
    out += chunk.next
    cursor = chunk.end
  }
  return out + html.slice(cursor)
}

function setAttr(attrs: string, name: string, value: string): string {
  const re = new RegExp(`\\s${name}\\s*=\\s*(["'])[\\s\\S]*?\\1`, 'i')
  if (re.test(attrs)) return attrs.replace(re, ` ${name}="${escAttr(value)}"`)
  return `${attrs} ${name}="${escAttr(value)}"`
}

function stampInventoryIdOnTag(open: string, id: string): string {
  if (/\bdata-inventory-id\s*=/.test(open)) {
    return open.replace(/\bdata-inventory-id\s*=\s*(["'])[^"']*\1/i, `data-inventory-id="${escAttr(id)}"`)
  }
  return open.replace(/>$/, ` data-inventory-id="${escAttr(id)}">`)
}

function replaceElInner(
  html: string,
  el: string,
  nextInner: string | ((inner: string, attrs: string) => string)
): string {
  const re = new RegExp(
    `<([a-z0-9]+)\\b([^>]*\\bdata-pw-el=["']${el.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*)>([\\s\\S]*?)<\\/\\1>`,
    'gi'
  )
  return html.replace(re, (_full, tag: string, attrs: string, inner: string) => {
    const innerNext = typeof nextInner === 'function' ? nextInner(inner, attrs) : nextInner
    return `<${tag}${attrs}>${innerNext}</${tag}>`
  })
}

function productImages(product: LivePdpBindProduct): string[] {
  const gallery = (product.galleryImages ?? []).map((url) => String(url || '').trim()).filter(Boolean)
  const hero = String(product.imageUrl || '').trim()
  const seen = new Set<string>()
  const out: string[] = []
  for (const url of [hero, ...gallery]) {
    if (!url || seen.has(url)) continue
    seen.add(url)
    out.push(url)
  }
  return out
}

function looksLikeVideoUrl(url: string): boolean {
  return /\.(mp4|webm|ogg|mov)(\?|#|$)/i.test(url) || /(?:youtube\.com|youtu\.be|vimeo\.com)\//i.test(url)
}

function rewriteClassBlocks(html: string, className: string, rewrite: (inner: string, open: string) => string): string {
  const masked = maskHtmlForTagScan(html)
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const openRe = new RegExp(`<([a-z0-9]+)\\b(?=[^>]*\\bclass=["'][^"']*\\b${escaped}\\b)[^>]*>`, 'gi')
  const chunks: Array<{ start: number; end: number; next: string }> = []
  let match: RegExpExecArray | null
  while ((match = openRe.exec(masked))) {
    const tag = (match[1] || 'div').toLowerCase()
    const start = match.index
    const openEnd = start + match[0].length
    const close = closingTagIndex(masked, openEnd, tag)
    if (close < 0) continue
    const closeTok = html.slice(close).match(new RegExp(`^</${tag}\\s*>`, 'i'))
    const end = close + (closeTok?.[0].length ?? `</${tag}>`.length)
    openRe.lastIndex = end
    const open = html.slice(start, openEnd)
    const inner = html.slice(openEnd, close)
    chunks.push({ start, end, next: `${rewrite(inner, open)}${html.slice(close, end)}` })
  }
  if (!chunks.length) return html
  let out = ''
  let cursor = 0
  for (const chunk of chunks) {
    out += html.slice(cursor, chunk.start)
    out += chunk.next
    cursor = chunk.end
  }
  return out + html.slice(cursor)
}

function deferImgsInHtml(inner: string): string {
  return inner.replace(/<img\b([^>]*)\/?>/gi, (_full, attrs: string) => {
    const srcMatch = attrs.match(/(?:^|\s)src=(["'])([^"']*)\1/i)
    const src = srcMatch?.[2] || ''
    if (!src || src.startsWith('data:') || /\bdata-pw-deferred-src=/.test(attrs)) return `<img${attrs}>`
    const next = `${attrs
      .replace(/(?:^|\s)src=(["'])[^"']*\1/i, ' ')
      .replace(/\s*\/\s*$/, '')
      .trim()} data-pw-deferred-src="${escAttr(src)}"`
    return `<img ${next}>`
  })
}

/** Hidden device gallery still downloads `src` in Chrome — park those URLs until save/serve restore. */
function classBlockHasImgSrc(html: string, className: string): boolean {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(
    `<[a-z0-9]+\\b[^>]*\\bclass=["'][^"']*\\b${escaped}\\b[^>]*>[\\s\\S]*?<img\\b[^>]*\\bsrc=`,
    'i'
  ).test(html)
}

export function deferOffDevicePdpGalleryMedia(
  html: string,
  variant: 'desktop' | 'laptop' | 'tablet' | 'mobile'
): string {
  if (!html.trim()) return html
  const hasHero = classBlockHasImgSrc(html, 'pw-pdp-hero')
  const hasDesktop = classBlockHasImgSrc(html, 'pw-pdp-gallery-desktop')
  if (!hasHero || !hasDesktop) return html
  let out = html
  if (variant !== 'mobile') {
    out = rewriteClassBlocks(out, 'pw-pdp-hero', (inner, open) => `${open}${deferImgsInHtml(inner)}`)
  } else {
    out = rewriteClassBlocks(out, 'pw-pdp-gallery-desktop', (inner, open) => `${open}${deferImgsInHtml(inner)}`)
  }
  return out
}

function productPriceText(product: LivePdpBindProduct): { price: string; compare: string } {
  const effective = resolvePartnerEffectiveUnitPrice({
    priceAmount: product.priceAmount ?? null,
    salePriceAmount: product.salePriceAmount ?? null,
    saleStartsAt: product.saleStartsAt ?? null,
    saleEndsAt: product.saleEndsAt ?? null,
  })
  const price =
    effective != null ? formatPartnerShopMoneyVnd(effective) : String(product.priceHint || '').trim()
  const compare =
    effective != null &&
    product.priceAmount != null &&
    Number.isFinite(product.priceAmount) &&
    effective < product.priceAmount
      ? formatPartnerShopMoneyVnd(product.priceAmount)
      : ''
  return { price, compare }
}

function thumbButtonHtml(url: string, name: string): string {
  return `<button type="button" class="pw-shop-product-thumb" data-pw-el="${PW_EL.thumb}"><img src="${escAttr(url)}" alt="${escAttr(name)}" loading="lazy" /></button>`
}

function stripHidden(attrs: string): string {
  let next = attrs.replace(/\s\bhidden\b(?:=(["'])[^"']*\1)?/gi, '')
  next = next.replace(/\sstyle=(["'])[^"']*display\s*:\s*none;?[^"']*\1/gi, '')
  return next
}

function rewriteGalleryInner(inner: string, product: LivePdpBindProduct): string {
  const images = productImages(product)
  const main = images[0] || ''
  const name = product.name || 'Product'
  let out = inner.replace(/<img\b([^>]*)>/gi, (full, attrs: string) => {
    if (/\bdata-pw-el=["']thumb["']/.test(attrs)) return full
    const isMain =
      /\bdata-pw-el=["']main-image["']/.test(attrs) ||
      /\bclass=["'][^"']*\b(?:pw-pdp-hero-img|pw-shop-product-img)\b/.test(attrs)
    if (!isMain || !main) return full
    return `<img${setAttr(setAttr(attrs, 'src', main), 'alt', name)}>`
  })
  if (images.length) {
    out = out.replace(
      /(<span\b[^>]*\bpw-pdp-hero-count\b[^>]*>)([\s\S]*?)(<\/span>)/i,
      `$11/${images.length}$3`
    )
  }
  let thumbIndex = 0
  out = out.replace(
    /<([a-z0-9]+)\b([^>]*\bdata-pw-el=["']thumb["'][^>]*)>([\s\S]*?)<\/\1>/gi,
    (_full, tag: string, attrs: string, thumbInner: string) => {
      const url = images[thumbIndex]
      thumbIndex += 1
      if (!url) {
        let nextAttrs = setAttr(attrs, 'hidden', '')
        if (!/\bstyle=/.test(nextAttrs)) nextAttrs += ' style="display:none"'
        return `<${tag}${nextAttrs}>${thumbInner}</${tag}>`
      }
      const nextInner = thumbInner.replace(/<img\b([^>]*)>/i, (_img, imgAttrs: string) => {
        return `<img${setAttr(setAttr(imgAttrs, 'src', url), 'alt', name)}>`
      })
      return `<${tag}${stripHidden(attrs)}>${nextInner}</${tag}>`
    }
  )
  if (thumbIndex < images.length) {
    const extra = images.slice(thumbIndex).map((url) => thumbButtonHtml(url, name)).join('')
    const thumbsRe =
      /<(nav|div)\b([^>]*\b(?:pw-pdp-hero-thumbs|pw-shop-product-thumbs)\b[^>]*)>([\s\S]*?)<\/\1>/i
    if (thumbsRe.test(out)) {
      out = out.replace(thumbsRe, (_full, tag: string, attrs: string, thumbsInner: string) => {
        return `<${tag}${attrs}>${thumbsInner}${extra}</${tag}>`
      })
    } else {
      out += `<div class="pw-shop-product-thumbs">${extra}</div>`
    }
  }
  return out
}

function productSizes(product: LivePdpBindProduct): string[] {
  return (product.sizes ?? []).map((s) => String(s || '').trim()).filter(Boolean)
}

function productColors(product: LivePdpBindProduct): LivePdpBindColor[] {
  return (product.colors ?? []).filter((c) => String(c?.name || '').trim())
}

function sizeVariantInner(sizes: string[], locale: WebLocale): string {
  const t = getPartnerSiteShopCopy(locale)
  const pills = sizes
    .map(
      (s, i) =>
        `<button type="button" class="pw-pdp-pill${i === 0 ? ' is-active' : ''}" data-pw-pdp-option-value="${escAttr(s)}">${escText(s)}</button>`
    )
    .join('')
  return `<p style="font-weight:700;margin:0 0 8px;font-size:14px">${escText(t.sizeLabel)}</p><div class="pw-pdp-pills">${pills}</div>`
}

function colorVariantInner(colors: LivePdpBindColor[], locale: WebLocale): string {
  const t = getPartnerSiteShopCopy(locale)
  const pills = colors
    .map((c, i) => {
      const name = String(c.name || '').trim()
      const img = String(c.img || '').trim()
      const face = img
        ? `<img src="${escAttr(img)}" alt="${escAttr(name)}" />`
        : escText(name)
      return `<button type="button" class="pw-pdp-pill pw-pdp-color${i === 0 ? ' is-active' : ''}" data-pw-pdp-option-value="${escAttr(name)}">${face}</button>`
    })
    .join('')
  return `<p style="font-weight:700;margin:0 0 8px;font-size:14px">${escText(t.colorLabel)}</p><div class="pw-pdp-pills">${pills}</div>`
}

function rewriteVariantBlocks(inner: string, product: LivePdpBindProduct, locale: WebLocale): string {
  const sizes = productSizes(product)
  const colors = productColors(product)
  let sizeDone = false
  let colorDone = false
  let out = inner.replace(
    /<([a-z0-9]+)\b([^>]*\bdata-pw-el=["']variant["'][^>]*)>([\s\S]*?)<\/\1>/gi,
    (_full, tag: string, attrs: string, blockInner: string) => {
      const blob = `${attrs}${blockInner}`
      const isColor = /pw-pdp-color|data-pw-pdp-option=["']color["']/.test(blob)
      if (isColor) {
        if (!colors.length) return `<${tag}${attrs}>${blockInner}</${tag}>`
        colorDone = true
        const nextAttrs = /\bdata-pw-pdp-option=/.test(attrs)
          ? attrs
          : `${attrs} data-pw-pdp-option="color"`
        return `<${tag}${nextAttrs}>${colorVariantInner(colors, locale)}</${tag}>`
      }
      if (!sizes.length) return `<${tag}${attrs}>${blockInner}</${tag}>`
      sizeDone = true
      const nextAttrs = /\bdata-pw-pdp-option=/.test(attrs)
        ? attrs
        : `${attrs} data-pw-pdp-option="size"`
      return `<${tag}${nextAttrs}>${sizeVariantInner(sizes, locale)}</${tag}>`
    }
  )
  const inject: string[] = []
  if (sizes.length && !sizeDone) {
    inject.push(
      `<div style="margin-top:16px" data-pw-el="${PW_EL.variant}" data-pw-pdp-option="size">${sizeVariantInner(sizes, locale)}</div>`
    )
  }
  if (colors.length && !colorDone) {
    inject.push(
      `<div style="margin-top:16px" data-pw-el="${PW_EL.variant}" data-pw-pdp-option="color">${colorVariantInner(colors, locale)}</div>`
    )
  }
  if (!inject.length) return out
  const isBuyBox =
    /\bdata-pw-el=["'](?:title|price|qty|buy|card-cart)["']/.test(out) ||
    /pw-pdp-title|pw-pdp-actions/.test(out)
  if (!isBuyBox) return out
  const chunk = inject.join('')
  if (/\bdata-pw-el=["']qty["']/.test(out)) {
    return out.replace(/(<([a-z0-9]+)\b[^>]*\bdata-pw-el=["']qty["'][^>]*>)/i, `${chunk}$1`)
  }
  if (/class=["'][^"']*\bpw-pdp-actions\b/.test(out)) {
    return out.replace(/(<[^>]*\bpw-pdp-actions\b[^>]*>)/i, `${chunk}$1`)
  }
  return `${out}${chunk}`
}

function rewritePdpInfoInner(inner: string, product: LivePdpBindProduct, locale: WebLocale): string {
  const name = escText(product.name || 'Product')
  const sku = String(product.sku || '').trim()
  const desc = String(product.detailDescription || product.description || '').trim()
  const { price, compare } = productPriceText(product)
  let out = replaceElInner(inner, PW_EL.title, name)
  out = out.replace(
    /<(h1)([^>]*\bclass=["'][^"']*\bpw-pdp-title\b[^>]*)>([\s\S]*?)<\/\1>/gi,
    `<$1$2>${name}</$1>`
  )
  if (sku) {
    out = replaceElInner(out, PW_EL.sku, escText(sku))
    out = out.replace(
      /(<p\b[^>]*\bclass=["'][^"']*\bpw-pdp-sku\b[^>]*>[\s\S]*?<strong[^>]*>)([\s\S]*?)(<\/strong>)/i,
      `$1${escText(sku)}$3`
    )
  }
  if (desc) out = replaceElInner(out, PW_EL.desc, escText(desc))
  if (price) {
    out = replaceElInner(out, PW_EL.price, (priceInner) => {
      const compareBlock = priceInner.match(
        /<([a-z0-9]+)\b([^>]*\bdata-pw-el=["']compare-price["'][^>]*)>([\s\S]*?)<\/\1>/i
      )
      if (!compareBlock) return escText(price)
      const tag = compareBlock[1]
      const attrs = compareBlock[2]
      const compareHtml = compare
        ? `<${tag}${attrs}>${escText(compare)}</${tag}>`
        : `<${tag}${setAttr(attrs, 'hidden', '')} style="display:none"></${tag}>`
      return `${escText(price)}${compareHtml}`
    })
  }
  if (compare) out = replaceElInner(out, PW_EL.comparePrice, escText(compare))
  return rewriteVariantBlocks(out, product, locale)
}

function reviewCardHtml(review: LivePdpBindReview): string {
  const stars = '★'.repeat(Math.min(5, Math.max(1, Math.round(review.rating || 5))))
  const title = String(review.title || '').trim()
  const photos = (review.imageUrls ?? []).map((url) => String(url || '').trim()).filter(Boolean)
  const photoHtml = photos.length
    ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0">${photos
        .map((url) => `<img src="${escAttr(url)}" alt="" style="width:72px;height:72px;object-fit:cover;border-radius:8px" />`)
        .join('')}</div>`
    : ''
  const reply = String(review.merchantReply || '').trim()
  const replyHtml = reply
    ? `<div style="margin-top:8px;padding:10px;background:var(--pw-surface);border-radius:8px;font-size:14px"><strong>${escText(review.merchantReplyBy || 'Shop')}:</strong> ${escText(reply)}</div>`
    : ''
  const useful =
    review.usefulCount != null
      ? `<button type="button" class="pw-shop-btn pw-shop-btn-outline" style="margin-top:8px;font-size:13px;padding:4px 10px">👍 ${escText(String(review.usefulCount))}</button>`
      : ''
  return `<article data-pw-el="${PW_EL.card}"><strong data-pw-el="${PW_EL.cardName}">${escText(review.name)}</strong><span class="pw-pdp-star"> ${stars}</span>${title ? `<p style="font-weight:600;margin:6px 0 2px">${escText(title)}</p>` : ''}<p data-pw-el="${PW_EL.body}">${escText(review.body)}</p>${photoHtml}${replyHtml}${useful}</article>`
}

function stampOutfitOpenTag(open: string, product: LivePdpBindProduct): string {
  let out = open
  if (!/\bdata-pw-outfit\s*=/.test(out)) out = out.replace(/>$/, ' data-pw-outfit="1">')
  if (!/\bdata-pw-grid-kind\s*=/.test(out)) out = out.replace(/>$/, ' data-pw-grid-kind="outfit">')
  return stampOpenAttr(out, 'data-exclude', product.id)
}

function stampRelatedOpenTag(open: string, product: LivePdpBindProduct, siteSlug?: string | null): string {
  let out = open
  if (!/\bdata-pw-related\s*=/.test(out)) out = out.replace(/>$/, ' data-pw-related="1">')
  if (!/\bdata-pw-catalog\b/.test(out)) out = out.replace(/>$/, ' data-pw-catalog>')
  if (!/\bdata-pw-grid-kind\s*=/.test(out)) out = out.replace(/>$/, ' data-pw-grid-kind="related">')
  out = stampOpenAttr(out, 'data-exclude', product.id)
  const categoryId = String(product.categoryId || '').trim()
  if (categoryId) out = stampOpenAttr(out, 'data-category-id', categoryId)
  const moreHref = relatedListingHref({ siteSlug, categoryPath: product.categoryPath })
  if (moreHref && moreHref !== '#') out = stampOpenAttr(out, 'data-more-href', moreHref)
  return out
}

function stampOpenAttr(open: string, name: string, value: string): string {
  const re = new RegExp(`\\s${name}\\s*=\\s*(["'])[\\s\\S]*?\\1`, 'i')
  if (re.test(open)) return open.replace(re, ` ${name}="${escAttr(value)}"`)
  return open.replace(/>$/, ` ${name}="${escAttr(value)}">`)
}

function stampStripGridOpen(open: string, extraClass: 'pw-related-grid' | 'pw-outfit-grid'): string {
  let out = open
  if (/\bclass\s*=/.test(out)) {
    if (!/\bpw-product-grid\b/.test(out)) {
      out = out.replace(/\bclass=(["'])/, 'class=$1pw-product-grid ')
    }
    if (!new RegExp(`\\b${extraClass}\\b`).test(out)) {
      out = out.replace(/\bclass=(["'])/, `class=$1${extraClass} `)
    }
  } else {
    out = out.replace(/>$/, ` class="pw-product-grid ${extraClass}">`)
  }
  out = out.replace(
    /(\sstyle=)(["'])([\s\S]*?)\2/i,
    (_full, attr: string, quote: string, css: string) => {
      const next = css
        .replace(/grid-template-columns\s*:[^;]+;?/gi, '')
        .replace(/display\s*:\s*(flex|block)\s*;?/gi, '')
        .replace(/\s{2,}/g, ' ')
        .replace(/;\s*;/g, ';')
        .trim()
        .replace(/^;|;$/g, '')
      return next ? `${attr}${quote}${next}${quote}` : ''
    }
  )
  return out
}

function replaceFirstGridInner(
  inner: string,
  cards: string,
  extraClass?: 'pw-related-grid' | 'pw-outfit-grid'
): string {
  const re = /<([a-z0-9]+)\b(?=[^>]*\b(?:data-pw-grid|data-pw-el=["']grid["']))[^>]*>/i
  const match = inner.match(re)
  if (!match || match.index == null) return inner
  const tag = match[1]
  const start = match.index
  const open = extraClass ? stampStripGridOpen(match[0], extraClass) : match[0]
  const openEnd = start + match[0].length
  const masked = maskHtmlForTagScan(inner)
  const close = closingTagIndex(masked, openEnd, tag)
  if (close < 0) return inner
  return inner.slice(0, start) + open + cards + inner.slice(close)
}

function replaceRelatedCards(inner: string, cards: string): string {
  const withGrid = replaceFirstGridInner(inner, cards, 'pw-related-grid')
  if (withGrid !== inner) return withGrid
  const title = inner.match(/<([a-z0-9]+)\b[^>]*data-pw-el=["']section-title["'][^>]*>[\s\S]*?<\/\1>/i)?.[0] || ''
  const actions = inner.match(/<([a-z0-9]+)\b[^>]*\bpw-related-actions\b[^>]*>[\s\S]*?<\/\1>/i)?.[0] || ''
  const empty = inner.match(/<([a-z0-9]+)\b[^>]*\bpw-related-empty\b[^>]*>[\s\S]*?<\/\1>/i)?.[0] || ''
  return `${title}<div class="pw-product-grid pw-related-grid" data-pw-el="${PW_EL.grid}" data-pw-grid>${cards}</div>${actions}${empty}`
}

function rewriteCatalogRelatedInner(
  inner: string,
  product: LivePdpBindProduct,
  locale: WebLocale,
  siteSlug?: string | null
): string {
  const t = getPartnerSiteShopCopy(locale)
  let out = replaceElInner(inner, PW_EL.sectionTitle, escText(t.relatedProducts))
  const moreHref = relatedListingHref({ siteSlug, categoryPath: product.categoryPath })
  if (moreHref && moreHref !== '#') {
    out = out.replace(
      /<([a-z0-9]+)\b([^>]*\bdata-pw-el=["']section-more["'][^>]*)>/gi,
      (_full, tag: string, attrs: string) => `<${tag}${setAttr(attrs, 'href', moreHref)}>`
    )
    out = out.replace(
      /<([a-z0-9]+)\b([^>]*\bpw-related-all\b[^>]*)>/gi,
      (_full, tag: string, attrs: string) => `<${tag}${setAttr(attrs, 'href', moreHref)}>`
    )
  }
  const items = (product.relatedProducts ?? []).filter((item) => String(item?.id || '').trim()).slice(0, 5)
  if (items.length) {
    out = replaceRelatedCards(
      out,
      items.map((item) => relatedCardHtml(item, { siteSlug })).join('')
    )
  }
  return out
}

function rewriteReviewsInner(inner: string, product: LivePdpBindProduct): string {
  const reviews = (product.reviews ?? []).filter((r) => String(r.body || '').trim())
  if (!reviews.length) {
    return replaceElInner(inner, PW_EL.card, '').replace(
      /<([a-z0-9]+)\b([^>]*\bdata-pw-el=["'](?:card-name|body)["'][^>]*)>([\s\S]*?)<\/\1>/gi,
      `<$1$2></$1>`
    )
  }
  let index = 0
  let out = inner.replace(
    /<([a-z0-9]+)\b([^>]*\bdata-pw-el=["']card["'][^>]*)>([\s\S]*?)<\/\1>/gi,
    () => {
      const review = reviews[index]
      index += 1
      return review ? reviewCardHtml(review) : ''
    }
  )
  if (index < reviews.length) {
    out += reviews.slice(index).map(reviewCardHtml).join('')
  }
  return out
}

function stampPdpHosts(html: string, id: string): string {
  let out = html.replace(/<body\b([^>]*)>/i, (full, attrs: string) => {
    if (!/\bdata-pw-page=["']product["']/.test(attrs)) return full
    return stampInventoryIdOnTag(full, id)
  })
  out = out.replace(
    /<(div|section|nav|aside)\b([^>]*\b(?:class=["'][^"']*\b(?:pw-pdp|pw-pdp-sticky|pw-shop-pdp-info|pw-shop-product-detail)\b|data-pw-page=["']product["'])[^>]*)>/gi,
    (full) => stampInventoryIdOnTag(full, id)
  )
  out = out.replace(
    /<(button|a)\b([^>]*\bdata-pw-pdp-(?:favorite|add-cart|buy-now)\s*=[^>]*)>/gi,
    (full) => stampInventoryIdOnTag(full, id)
  )
  return out
}

function hasSlot(html: string, slot: string): boolean {
  return new RegExp(`data-pw-pdp-slot=["']${slot}["']`, 'i').test(html)
}

function insertBeforeMainClose(html: string, chunk: string): string {
  if (/<\/main>/i.test(html)) return html.replace(/<\/main>/i, `${chunk}</main>`)
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${chunk}</body>`)
  return html + chunk
}

function insertAfterOpen(html: string, tagRe: RegExp, chunk: string): string {
  const match = html.match(tagRe)
  if (!match || match.index == null) return html
  const at = match.index + match[0].length
  return html.slice(0, at) + chunk + html.slice(at)
}

function ensureMissingPdpSlots(
  html: string,
  product: LivePdpBindProduct,
  locale: WebLocale,
  siteSlug?: string | null
): string {
  const t = getPartnerSiteShopCopy(locale)
  const name = product.name || 'Product'
  let out = html
  const crumbs = (product.breadcrumb ?? []).filter((c) => String(c.name || '').trim())
  if (crumbs.length && !/data-pw-region=["']breadcrumb["']/.test(out)) {
    const links = [
      `<a href="#" data-pw-el="${PW_EL.link}">${escText(t.navHome)}</a>`,
      ...crumbs.map((c) => `<a href="${escAttr(c.href || '#')}" data-pw-el="${PW_EL.crumb}">${escText(c.name)}</a>`),
      `<span data-pw-el="${PW_EL.crumb}">${escText(name)}</span>`,
    ].join(' / ')
    const nav = `<nav class="pw-shop-breadcrumb" data-pw-region="${PW_REGION.breadcrumb}" data-pw-pdp-slot="breadcrumb">${links}</nav>`
    if (/<main\b/i.test(out)) out = insertAfterOpen(out, /<main\b[^>]*>/i, nav)
    else if (/<body\b/i.test(out)) out = insertAfterOpen(out, /<body\b[^>]*>/i, nav)
    else out = nav + out
  }
  if (!hasSlot(out, 'share')) {
    const share = `<button type="button" class="pw-pdp-pill" data-pw-pdp-slot="share">${escText(t.pdpShareCopy)}</button>`
    if (/<(nav|div)\b[^>]*\b(?:pw-pdp-hero-thumbs|pw-shop-product-thumbs)\b[^>]*>/i.test(out)) {
      out = out.replace(
        /<(nav|div)\b([^>]*\b(?:pw-pdp-hero-thumbs|pw-shop-product-thumbs)\b[^>]*)>/i,
        (full) => `${full}${share}`
      )
    }
  }
  const { price, compare } = productPriceText(product)
  if (compare && price && !/pw-pdp-save/.test(out)) {
    const save = `<p class="pw-pdp-save" data-pw-pdp-slot="savings">${escText(t.pdpSavings.replace('{amount}', compare))}</p>`
    out = out.replace(/(<[^>]*\bpw-pdp-price-card\b[^>]*>[\s\S]*?<\/div>)/i, `$1${save}`)
  }
  const stock = Number(product.stockQty ?? 0)
  if (stock > 0 && stock <= 5 && !hasSlot(out, 'low-stock')) {
    const badge = `<span class="pw-shop-urgency-badge" data-pw-el="${PW_EL.badge}" data-pw-pdp-slot="low-stock">${escText(t.lowStockUrgency.replace('{n}', String(stock)))}</span>`
    out = out.replace(/(<[^>]*\bpw-pdp-price-card\b[^>]*>[\s\S]*?<\/div>)/i, `$1${badge}`)
  }
  const sizeGuide = String(product.sizeGuideImageUrl || '').trim()
  if (sizeGuide && !hasSlot(out, 'size-guide')) {
    const block = `<div data-pw-pdp-slot="size-guide" style="margin-top:8px"><button type="button" class="pw-shop-btn pw-shop-btn-outline" style="font-size:13px">${escText(t.sizeGuideButton)}</button><img src="${escAttr(sizeGuide)}" alt="${escAttr(t.sizeGuideModalTitle)}" style="width:100%;max-width:360px;height:auto;margin-top:8px;border-radius:8px;border:1px solid var(--pw-border)" /></div>`
    out = out.replace(
      /(<[a-z0-9]+\b[^>]*data-pw-pdp-option=["']size["'][^>]*>)/i,
      `$1${block}`
    )
  }
  const consult = String(product.consultNote || '').trim()
  if (consult && !hasSlot(out, 'consult')) {
    const box = `<div data-pw-pdp-slot="consult" style="margin-top:16px;padding:12px;border-radius:12px;background:var(--pw-surface);border:1px solid var(--pw-border)"><p style="margin:0 0 6px;font-weight:700;font-size:13px">${escText(t.pdpConsultNoteTitle)}</p><p class="pw-shop-muted" style="margin:0">${escText(consult)}</p></div>`
    if (/\bdata-pw-el=["']qty["']/.test(out)) {
      out = out.replace(/(<([a-z0-9]+)\b[^>]*\bdata-pw-el=["']qty["'][^>]*>)/i, `${box}$1`)
    } else {
      out = insertBeforeMainClose(out, box)
    }
  }
  if (!hasSlot(out, 'deposit') && product.depositPolicy) {
    const note = `<p class="pw-shop-muted" data-pw-pdp-slot="deposit" style="margin-top:12px;font-size:13px">${escText(t.depositPolicyNote)}</p>`
    if (/class=["'][^"']*\bpw-pdp-actions\b/.test(out)) {
      out = out.replace(/(<[^>]*\bpw-pdp-actions\b[^>]*>)/i, `${note}$1`)
    }
  }
  const videoPoster = String(product.productVideoUrl || '').trim()
  if (videoPoster && looksLikeVideoUrl(videoPoster) && !hasSlot(out, 'video')) {
    const video = `<div data-pw-pdp-slot="video"><h2>${escText(t.productVideoTitle)}</h2><video class="pw-shop-product-video" poster="${escAttr(videoPoster)}" controls preload="none"></video></div>`
    if (/class=["'][^"']*\bpw-shop-product-detail\b/.test(out)) {
      out = out.replace(
        /(<([a-z0-9]+)\b[^>]*\bpw-shop-product-detail\b[^>]*>)([\s\S]*?)(<\/\2>)/i,
        `$1$3${video}$4`
      )
    } else {
      out = insertBeforeMainClose(out, `<section class="pw-shop-product-detail" data-pw-region="${PW_REGION.pdpInfo}">${video}</section>`)
    }
  }
  const material = String(product.materialImageUrl || '').trim()
  if (material && !hasSlot(out, 'material')) {
    const block = `<div data-pw-pdp-slot="material"><h2>${escText(t.pdpMaterialImagesTitle)}</h2><div class="pw-shop-detail-grid"><img src="${escAttr(material)}" alt="${escAttr(name)}" /></div></div>`
    if (/class=["'][^"']*\bpw-shop-product-detail\b/.test(out)) {
      out = out.replace(
        /(<([a-z0-9]+)\b[^>]*\bpw-shop-product-detail\b[^>]*>)([\s\S]*?)(<\/\2>)/i,
        `$1$3${block}$4`
      )
    }
  }
  const realUse = (product.realUseImageUrls ?? []).map((u) => String(u || '').trim()).filter(Boolean)
  if (realUse.length && !hasSlot(out, 'real-use')) {
    const imgs = realUse
      .map((url) => `<img src="${escAttr(url)}" alt="${escAttr(name)}" />`)
      .join('')
    const block = `<div data-pw-pdp-slot="real-use"><h2>${escText(t.pdpRealUseImagesTitle)}</h2><div class="pw-shop-detail-grid">${imgs}</div></div>`
    if (/class=["'][^"']*\bpw-shop-product-detail\b/.test(out)) {
      out = out.replace(
        /(<([a-z0-9]+)\b[^>]*\bpw-shop-product-detail\b[^>]*>)([\s\S]*?)(<\/\2>)/i,
        `$1$3${block}$4`
      )
    }
  }
  if ((product.reviews ?? []).length && !hasSlot(out, 'review-form') && /data-pw-region=["']reviews["']/.test(out)) {
    const form = `<div data-pw-pdp-slot="review-form" style="margin-top:16px;padding:16px;border:1px solid var(--pw-border);border-radius:12px;display:grid;gap:10px"><p style="margin:0;font-weight:700">${escText(t.reviewsWriteButton)}</p><p class="pw-shop-muted" style="margin:0">${escText(t.reviewsFormRatingLabel)} ★★★★★</p><textarea rows="3" placeholder="${escAttr(t.reviewsFormContentPlaceholder)}"></textarea><button type="button" class="pw-shop-btn pw-shop-btn-outline">${escText(t.reviewsFormSubmit)}</button></div>`
    out = out.replace(
      /(<([a-z0-9]+)\b[^>]*data-pw-region=["']reviews["'][^>]*>)/i,
      `$1${form}`
    )
  }
  const questions = product.questions ?? []
  if (questions.length && !/id=["']pw-pdp-qa["']/.test(out)) {
    const cards = questions
      .map((q) => {
        const answer = String(q.answer || '').trim()
        const badge = q.answerType === 'buyer' ? t.qaVerifiedBadge : t.qaAdminBadge
        const reply = answer
          ? `<div style="margin-left:16px;margin-top:8px;font-size:14px"><strong>${escText(q.answerBy || 'Shop')}</strong> <span style="font-size:11px;padding:2px 6px;border-radius:999px;background:var(--pw-surface)">${escText(badge)}</span><p style="margin:4px 0 0">${escText(answer)}</p></div>`
          : `<p class="pw-shop-muted" style="margin-left:16px;font-size:13px">${escText(t.qaNoAnswersYet)}</p>`
        return `<article data-pw-el="${PW_EL.card}"><strong data-pw-el="${PW_EL.cardName}">${escText(q.asker)}</strong><p data-pw-el="${PW_EL.body}">${escText(q.body)}</p>${reply}</article>`
      })
      .join('')
    const qa = `<section id="pw-pdp-qa" class="pw-shop-reviews" data-pw-region="${PW_REGION.reviews}" data-pw-pdp-slot="qa"><h2 data-pw-el="${PW_EL.sectionTitle}">${escText(t.qaTitle)}</h2><button type="button" class="pw-shop-btn pw-shop-btn-outline">${escText(t.qaAskButton)}</button><div style="margin-top:20px;display:grid;gap:16px">${cards}</div></section>`
    out = insertBeforeMainClose(out, qa)
  }
  if (!/\bdata-pw-related\s*=/.test(out) && !/\bdata-pw-grid-kind\s*=\s*(["']?)related\1/.test(out)) {
    const related = buildRelatedProductsSectionHtml({
      locale,
      siteSlug,
      cards: product.relatedProducts,
      categoryId: product.categoryId,
      categoryPath: product.categoryPath,
      excludeId: product.id,
    })
    out = insertBeforeMainClose(out, related)
  }
  return out
}

export function bindLiveProductToPdpHtml(
  html: string,
  product: LivePdpBindProduct | null | undefined,
  opts?: { locale?: WebLocale; siteSlug?: string | null }
): string {
  const source = html.trim()
  const id = String(product?.id || '').trim()
  if (!source || !id || !product) return html
  const locale = opts?.locale || 'vi'
  const siteSlug = opts?.siteSlug
  let out = stampPdpHosts(source, id)
  out = replaceRegionBlocks(out, PW_REGION.gallery, (inner, open) => {
    return `${stampInventoryIdOnTag(open, id)}${rewriteGalleryInner(inner, product)}`
  })
  out = replaceRegionBlocks(out, PW_REGION.pdpInfo, (inner, open) => {
    return `${stampInventoryIdOnTag(open, id)}${rewritePdpInfoInner(inner, product, locale)}`
  })
  out = replaceRegionBlocks(out, PW_REGION.reviews, (inner, open) => {
    if (/id=["']pw-pdp-qa["']|data-pw-pdp-slot=["']qa["']/.test(open)) return `${open}${inner}`
    return `${open}${rewriteReviewsInner(inner, product)}`
  })
  out = replaceRegionBlocks(out, PW_REGION.catalog, (inner, open) => {
    if (isOutfitCatalogOpenTag(open)) return `${stampOutfitOpenTag(open, product)}${inner}`
    if (!isRelatedCatalogOpenTag(open)) return `${open}${inner}`
    return `${stampRelatedOpenTag(open, product, siteSlug)}${rewriteCatalogRelatedInner(inner, product, locale, siteSlug)}`
  })
  return ensureMissingPdpSlots(out, product, locale, siteSlug)
}
