/**
 * Live first paint for header pills + featured category tiles.
 * Bind AFTER Redis HTML cache (visitor-specific). Sửa nhanh giữ chữ mẫu.
 */

import { escapeAttr, escapeHtml } from '@/lib/packaging/mockup-share-html'
import type { WebLocale } from '@/lib/i18n/config'
import {
  PW_PERSONALIZE_NAV_ATTR,
  PW_PERSONALIZE_NAV_RECENT,
} from '@/lib/partner-website/shop/featured-categories-constants'
import type {
  FeaturedCategoryTile,
  LiveNavRowItem,
} from '@/lib/partner-website/shop/featured-categories'
import { partnerCategoryNavAllLabel } from '@/lib/partner-website/shop/partner-site-category-mega-menu'
import { getPartnerSiteCategoryNavLabels } from '@/lib/partner-website/shop/partner-site-shop-nav-config'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  partnerSiteCategoryHubPath,
  partnerSiteInfoPath,
  partnerSiteProductsPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import { appendFeaturedMarqueeCloneHtml } from '@/lib/partner-website/visual-editor/featured-category-widgets'
import { PW_EL } from '@/lib/partner-website/visual-editor/pw-ui-contract'

export const PW_NAV_LIVE_ATTR = 'data-pw-nav-live'
export const PW_FEATURED_LIVE_ATTR = 'data-pw-featured-live'

export type LiveCategoryBind = {
  siteSlug: string
  locale: WebLocale
  navRow: LiveNavRowItem[]
  showNavAll: boolean
  tiles: FeaturedCategoryTile[]
  hubHref: string
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

function replaceMatchingOpens(
  html: string,
  openRe: RegExp,
  rewrite: (open: string, inner: string) => { open: string; inner: string }
): string {
  const masked = maskHtmlForTagScan(html)
  const chunks: Array<{ start: number; end: number; next: string }> = []
  let match: RegExpExecArray | null
  openRe.lastIndex = 0
  while ((match = openRe.exec(masked))) {
    const tag = (match[1] || 'div').toLowerCase()
    const start = match.index
    const openEnd = start + match[0].length
    const close = closingTagIndex(masked, openEnd, tag)
    if (close < 0) continue
    const closeTok = html.slice(close).match(new RegExp(`^</${tag}\\s*>`, 'i'))
    const end = close + (closeTok?.[0].length ?? `</${tag}>`.length)
    openRe.lastIndex = end
    const next = rewrite(html.slice(start, openEnd), html.slice(openEnd, close))
    chunks.push({ start, end, next: `${next.open}${next.inner}${html.slice(close, end)}` })
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

function stampAttr(open: string, name: string, value: string): string {
  const re = new RegExp(`\\s${name}\\s*=\\s*(["'])[\\s\\S]*?\\1`, 'i')
  if (re.test(open)) return open.replace(re, ` ${name}="${escapeAttr(value)}"`)
  return open.replace(/>$/, ` ${name}="${escapeAttr(value)}">`)
}

function extractAddedChrome(inner: string): string {
  const re = /<([a-z0-9]+)[^>]*\bdata-pw-chrome-added\b[^>]*>[\s\S]*?<\/\1>/gi
  const kept: string[] = []
  let match: RegExpExecArray | null
  while ((match = re.exec(inner))) kept.push(match[0])
  return kept.join('')
}

export function buildLiveNavRowInnerHtml(input: {
  row: LiveNavRowItem[]
  locale: WebLocale
  siteSlug: string
  showNavAll?: boolean
  keptHtml?: string
}): string {
  const labels = getPartnerSiteCategoryNavLabels(input.locale)
  const productsHref = partnerSiteProductsPath(input.siteSlug)
  const saleHref = partnerSiteInfoPath(input.siteSlug, 'sale')
  const hubHref = partnerSiteCategoryHubPath(input.siteSlug)
  let html = `<div class="pw-nav-row-scroll"><a href="${escapeAttr(productsHref)}" data-pw-el="${PW_EL.navLink}">${escapeHtml(labels.newArrivals)}</a>`
  for (const item of input.row) {
    const name = String(item.name || '').trim()
    if (!name) continue
    const kids = item.children || []
    html += `<span class="pw-nav-pill" data-pw-nav-l1="${escapeAttr(item.id)}">`
    html += `<a href="${escapeAttr(item.href || '#')}" data-pw-el="${PW_EL.navLink}">${escapeHtml(name)}</a>`
    if (kids.length) {
      html += `<button type="button" class="pw-nav-chevron" data-pw-nav-chevron aria-label="${escapeAttr(getPartnerSiteShopCopy(input.locale).categoryExpand)}">▾</button>`
    }
    html += '</span>'
  }
  if (input.showNavAll) {
    html += `<a href="${escapeAttr(hubHref)}" data-pw-el="${PW_EL.navLink}" data-pw-nav-all="1">${escapeHtml(partnerCategoryNavAllLabel(input.locale))}</a>`
  }
  html += `<a href="${escapeAttr(saleHref)}" class="is-sale pw-nav-sale" data-pw-el="${PW_EL.navLink}">${escapeHtml(labels.sale)}</a>${input.keptHtml || ''}</div>`
  html += '<div class="pw-nav-flyout-bar" hidden></div>'
  return html
}

export function navRowSignature(row: LiveNavRowItem[]): string {
  return row.map((item) => `${item.id}|${item.href}|${item.name}`).join('\n')
}

export function bindLiveNavPillsToHtml(html: string, bind: LiveCategoryBind): string {
  if (!html || !bind.siteSlug) return html
  const inner = buildLiveNavRowInnerHtml({
    row: bind.navRow,
    locale: bind.locale,
    siteSlug: bind.siteSlug,
    showNavAll: bind.showNavAll,
  })
  return replaceMatchingOpens(
    html,
    /<(nav)\b(?=[^>]*class=["'][^"']*\b(?:pw-nav-main|pw-shop-nav-row)\b)[^>]*>/gi,
    (open, oldInner) => {
      const kept = extractAddedChrome(oldInner)
      const nextInner = kept
        ? buildLiveNavRowInnerHtml({
            row: bind.navRow,
            locale: bind.locale,
            siteSlug: bind.siteSlug,
            showNavAll: bind.showNavAll,
            keptHtml: kept,
          })
        : inner
      return {
        open: stampAttr(stampAttr(open, PW_PERSONALIZE_NAV_ATTR, PW_PERSONALIZE_NAV_RECENT), PW_NAV_LIVE_ATTR, '1'),
        inner: nextInner,
      }
    }
  )
}

function paintFeaturedCardHtml(cardHtml: string, tile: FeaturedCategoryTile): string {
  const name = escapeHtml(tile.short_name || tile.name)
  const href = escapeAttr(tile.href || '#')
  const imgUrl = String(tile.image_url || '').trim()
  let out = cardHtml.replace(/\shidden(?:="")?(?=\s|>)/gi, '')
  out = out.replace(/\sdata-pw-grid-placeholder(?:="[^"]*")?/gi, '')
  if (/^<a\b/i.test(out)) {
    out = out.replace(/<a\b([^>]*)>/i, (_full, attrs: string) => {
      const next = /\bhref\s*=/.test(attrs)
        ? attrs.replace(/\bhref\s*=\s*(["'])[\s\S]*?\1/i, ` href="${href}"`)
        : `${attrs} href="${href}"`
      return `<a${next}>`
    })
  }
  out = out.replace(
    /<([a-z0-9]+)\b([^>]*\b(?:data-pw-el=["']card-name["']|data-pw-edit=["']categoryName:)[^>]*)>([\s\S]*?)<\/\1>/i,
    (_full, tag: string, attrs: string) => `<${tag}${attrs}>${name}</${tag}>`
  )
  if (imgUrl) {
    if (/<img\b/i.test(out)) {
      out = out.replace(/<img\b([^>]*)>/i, (_full, attrs: string) => {
        let next = attrs
        next = /\bsrc\s*=/.test(next)
          ? next.replace(/\bsrc\s*=\s*(["'])[\s\S]*?\1/i, ` src="${escapeAttr(imgUrl)}"`)
          : `${next} src="${escapeAttr(imgUrl)}"`
        next = /\balt\s*=/.test(next)
          ? next.replace(/\balt\s*=\s*(["'])[\s\S]*?\1/i, ` alt="${name}"`)
          : `${next} alt="${name}"`
        return `<img${next}>`
      })
    } else {
      out = out.replace(
        /<([a-z0-9]+)\b([^>]*\bdata-pw-el=["']card-media["'][^>]*)>([\s\S]*?)<\/\1>/i,
        (_full, tag: string, attrs: string) =>
          `<${tag}${attrs}><img src="${escapeAttr(imgUrl)}" alt="${name}" loading="lazy"/></${tag}>`
      )
    }
  }
  return out
}

function collectCardRanges(inner: string): Array<{ start: number; end: number; html: string }> {
  const masked = maskHtmlForTagScan(inner)
  const openRe =
    /<(a|article)\b(?=[^>]*?(?:\bdata-pw-el=["']card["']|\bclass=["'][^"']*\b(?:pw-cat-card|pw-featured-cat-card)\b))[^>]*>/gi
  const out: Array<{ start: number; end: number; html: string }> = []
  let match: RegExpExecArray | null
  while ((match = openRe.exec(masked))) {
    const tag = (match[1] || 'a').toLowerCase()
    const start = match.index
    const close = closingTagIndex(masked, start + match[0].length, tag)
    if (close < 0) continue
    const closeTok = inner.slice(close).match(new RegExp(`^</${tag}\\s*>`, 'i'))
    const end = close + (closeTok?.[0].length ?? `</${tag}>`.length)
    openRe.lastIndex = end
    out.push({ start, end, html: inner.slice(start, end) })
  }
  return out
}

export function bindLiveFeaturedCategoryTilesToHtml(html: string, bind: LiveCategoryBind): string {
  if (!html || !bind.tiles.length) return html
  const hub = bind.hubHref || partnerSiteCategoryHubPath(bind.siteSlug)
  return replaceMatchingOpens(
    html,
    /<([a-z0-9]+)\b(?=[^>]*\bdata-pw-featured-categories=["']1["'])[^>]*>/gi,
    (open, inner) => {
      const workInner = inner.replace(/<div\b[^>]*\bdata-pw-featured-clone\b[^>]*>[\s\S]*?<\/div>/gi, '')
      const cards = collectCardRanges(workInner)
      if (!cards.length) return { open: stampAttr(open, PW_FEATURED_LIVE_ATTR, '1'), inner: workInner }
      let nextInner = workInner
      for (let i = cards.length - 1; i >= 0; i -= 1) {
        const card = cards[i]
        const tile = bind.tiles[i]
        const painted = tile
          ? paintFeaturedCardHtml(card.html, tile)
          : card.html.replace(/^<([a-z0-9]+)\b/i, '<$1 hidden')
        nextInner = nextInner.slice(0, card.start) + painted + nextInner.slice(card.end)
      }
      nextInner = nextInner.replace(
        /<([a-z0-9]+)\b([^>]*\bdata-pw-el=["']section-more["'][^>]*)>/gi,
        (full, tag: string, attrs: string) => {
          const next = /\bhref\s*=/.test(attrs)
            ? attrs.replace(/\bhref\s*=\s*(["'])[\s\S]*?\1/i, ` href="${escapeAttr(hub)}"`)
            : `${attrs} href="${escapeAttr(hub)}"`
          return `<${tag}${next}>`
        }
      )
      const innerOut = /\bpw-featured-cat\b/.test(open)
        ? appendFeaturedMarqueeCloneHtml(nextInner)
        : nextInner
      return { open: stampAttr(open, PW_FEATURED_LIVE_ATTR, '1'), inner: innerOut }
    }
  )
}

export function bindLiveCategorySurfacesInHtml(html: string, bind: LiveCategoryBind | null | undefined): string {
  if (!html || !bind) return html
  return bindLiveFeaturedCategoryTilesToHtml(bindLiveNavPillsToHtml(html, bind), bind)
}
