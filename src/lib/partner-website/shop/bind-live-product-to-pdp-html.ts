/**
 * PDP visual HTML is one shared shell per device. Live inventory (images, name,
 * price, sku, description) is rebound onto locked fields so every product keeps
 * its own content while buttons/layout stay in sync.
 */

import {
  formatPartnerShopMoneyVnd,
  resolvePartnerEffectiveUnitPrice,
} from '@/lib/partner-website/shop/partner-shop-flash-sale'
import { PW_EL, PW_REGION } from '@/lib/partner-website/visual-editor/pw-ui-contract'

export type LivePdpBindProduct = {
  id: string
  name: string
  sku?: string | null
  description?: string | null
  detailDescription?: string | null
  priceHint?: string | null
  priceAmount?: number | null
  salePriceAmount?: number | null
  saleStartsAt?: string | null
  saleEndsAt?: string | null
  imageUrl?: string | null
  galleryImages?: string[] | null
  detailImages?: string[] | null
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
  const details = (product.detailImages ?? []).map((url) => String(url || '').trim()).filter(Boolean)
  const hero = String(product.imageUrl || '').trim()
  const seen = new Set<string>()
  const out: string[] = []
  for (const url of [...gallery, hero, ...details]) {
    if (!url || seen.has(url)) continue
    seen.add(url)
    out.push(url)
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
      return `<${tag}${attrs}>${nextInner}</${tag}>`
    }
  )
  return out
}

function rewritePdpInfoInner(inner: string, product: LivePdpBindProduct): string {
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
  return out
}

function rewriteReviewsInner(inner: string): string {
  return replaceElInner(inner, PW_EL.card, '').replace(
    /<([a-z0-9]+)\b([^>]*\bdata-pw-el=["'](?:card-name|body)["'][^>]*)>([\s\S]*?)<\/\1>/gi,
    `<$1$2></$1>`
  )
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

export function bindLiveProductToPdpHtml(html: string, product: LivePdpBindProduct | null | undefined): string {
  const source = html.trim()
  const id = String(product?.id || '').trim()
  if (!source || !id || !product) return html
  let out = stampPdpHosts(source, id)
  out = replaceRegionBlocks(out, PW_REGION.gallery, (inner, open) => {
    return `${stampInventoryIdOnTag(open, id)}${rewriteGalleryInner(inner, product)}`
  })
  out = replaceRegionBlocks(out, PW_REGION.pdpInfo, (inner, open) => {
    return `${stampInventoryIdOnTag(open, id)}${rewritePdpInfoInner(inner, product)}`
  })
  out = replaceRegionBlocks(out, PW_REGION.reviews, (inner, open) => {
    return `${open}${rewriteReviewsInner(inner)}`
  })
  return out
}
