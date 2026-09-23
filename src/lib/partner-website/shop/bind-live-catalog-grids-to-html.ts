/**
 * Live first paint for catalog / personalize grids. Bind AFTER Redis HTML cache.
 * Sửa nhanh keeps placeholders. JS replaces when visitor-specific data differs.
 */

import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerSiteShopProduct } from '@/lib/partner-website/shop/inventory-to-shop-product'
import { renderPartnerShopListingCardsHtml } from '@/lib/partner-website/shop/render-partner-shop-listing-card-html'
import {
  clampProductGridRows,
  productGridColsForDevice,
  productGridPageSize,
  PW_GRID_PAGE_MAX,
  PW_LISTING_BATCH_SIZE,
} from '@/lib/partner-website/shop/pw-product-grid-page'
import type { VisualDeviceVariant } from '@/lib/partner-website/visual-editor/visual-editor-pages'

export type LiveCatalogGridBind = {
  generic: PartnerSiteShopProduct[]
  listing: PartnerSiteShopProduct[]
  personalize: PartnerSiteShopProduct[]
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

function stampOpenAttr(open: string, name: string, value: string): string {
  const re = new RegExp(`\\s${name}\\s*=\\s*(["'])[\\s\\S]*?\\1`, 'i')
  if (re.test(open)) return open.replace(re, ` ${name}="${value.replace(/"/g, '&quot;')}"`)
  return open.replace(/>$/, ` ${name}="${value.replace(/"/g, '&quot;')}">`)
}

function attr(open: string, name: string): string {
  return open.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1]?.trim() || ''
}

function hostPageSize(open: string, device?: VisualDeviceVariant | null): number {
  if (isListingCatalogHost(open)) return PW_LISTING_BATCH_SIZE
  const rows = clampProductGridRows(attr(open, 'data-pw-grid-rows') || 1)
  const cols = productGridColsForDevice(device)
  const limitAttr = Math.floor(Number(attr(open, 'data-limit') || 0))
  const page = productGridPageSize(rows, cols)
  return Math.max(1, Math.min(PW_GRID_PAGE_MAX, limitAttr > 0 ? Math.min(limitAttr, page) : page))
}

function skipHost(open: string): boolean {
  return (
    /\bdata-pw-(?:outfit|featured-categories)\b/i.test(open) ||
    /\bdata-pw-personalize\s*=\s*["']featured-categories["']/i.test(open) ||
    /\bdata-pw-grid-kind\s*=\s*["'](?:outfit|featured-categories)["']/i.test(open) ||
    /\bdata-pw-related\s*=/i.test(open) ||
    /\bdata-pw-grid-kind\s*=\s*["']related["']/i.test(open)
  )
}

function isPersonalizeHost(open: string): boolean {
  return /\bdata-pw-personalize\s*=\s*["'](?:recently-viewed|recommended|flash-sale)["']/i.test(open)
}

function isListingCatalogHost(open: string): boolean {
  if (isPersonalizeHost(open) || skipHost(open)) return false
  return /\bdata-category-id\s*=/i.test(open) || /\bdata-pw-listing-href\s*=/i.test(open)
}

function replaceGridInner(inner: string, cards: string): string {
  const masked = maskHtmlForTagScan(inner)
  const match = /<(div|ul|ol|section)\b(?=[^>]*\bdata-pw-grid\b)[^>]*>/i.exec(masked)
  if (!match) return inner
  const tag = (match[1] || 'div').toLowerCase()
  const start = match.index
  const openEnd = start + match[0].length
  const close = closingTagIndex(masked, openEnd, tag)
  if (close < 0) return inner
  return `${inner.slice(0, openEnd)}${cards}${inner.slice(close)}`
}

export function bindLiveCatalogGridsToHtml(
  html: string,
  bind: LiveCatalogGridBind | null | undefined,
  opts?: { locale?: WebLocale; device?: VisualDeviceVariant | null }
): string {
  if (!html || !bind) return html
  const locale = opts?.locale || 'vi'
  const generic = bind.generic || []
  const listing = bind.listing || []
  const personalize = bind.personalize || []
  if (!generic.length && !listing.length && !personalize.length) return html

  const masked = maskHtmlForTagScan(html)
  const re = /<(section|div)\b(?=[^>]*\bdata-pw-(?:catalog|personalize)\b)[^>]*>/gi
  const chunks: string[] = []
  let cursor = 0
  let firstPriority = true
  let match: RegExpExecArray | null
  while ((match = re.exec(masked))) {
    const open = html.slice(match.index, match.index + match[0].length)
    if (skipHost(open)) {
      re.lastIndex = match.index + match[0].length
      continue
    }
    const tag = (match[1] || 'section').toLowerCase()
    const start = match.index
    const openEnd = start + match[0].length
    const close = closingTagIndex(masked, openEnd, tag)
    if (close < 0) continue
    const closeTok = html.slice(close).match(new RegExp(`^</${tag}\\s*>`, 'i'))
    const end = close + (closeTok?.[0].length ?? `</${tag}>`.length)
    chunks.push(html.slice(cursor, start))

    let products: PartnerSiteShopProduct[] = []
    if (isPersonalizeHost(open)) {
      products = personalize
    } else if (isListingCatalogHost(open)) {
      products = listing.length ? listing : generic
    } else if (/\bdata-pw-catalog\b/i.test(open)) {
      products = generic.length ? generic : listing
    }
    products = products.slice(0, hostPageSize(open, opts?.device))
    if (!products.length) {
      chunks.push(html.slice(start, end))
      cursor = end
      re.lastIndex = end
      continue
    }
    const cards = renderPartnerShopListingCardsHtml(products, {
      locale,
      priority: firstPriority,
    })
    firstPriority = false
    const nextOpen = stampOpenAttr(open, 'data-pw-live-products', 'ready')
    const inner = replaceGridInner(html.slice(openEnd, close), cards)
    chunks.push(`${nextOpen}${inner}${html.slice(close, end)}`)
    cursor = end
    re.lastIndex = end
  }
  chunks.push(html.slice(cursor))
  return chunks.join('')
}
