/**
 * Live first paint for promo banners. Bind AFTER Redis HTML cache (visitor-specific).
 * Sửa nhanh keeps seed slides; Lưu restores placeholders.
 */

import { escapeAttr, escapeHtml } from '@/lib/packaging/mockup-share-html'
import type { WebLocale } from '@/lib/i18n/config'
import { shopBannerDisplaySrc } from '@/lib/partner-website/shop/inventory-shop-detail'
import { extractVisualHtmlPageKind } from '@/lib/partner-website/shop/inject-partner-shop-fonts'
import {
  partnerMarketingBannerAlt,
  type PartnerMarketingBannerPublicItem,
} from '@/lib/partner-website/promotions/partner-marketing-banner'

export const PW_BANNER_LIVE_ATTR = 'data-pw-banner-live'

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

function stampAttr(open: string, name: string, value: string): string {
  const re = new RegExp(`\\s${name}\\s*=\\s*(["'])[\\s\\S]*?\\1`, 'i')
  if (re.test(open)) return open.replace(re, ` ${name}="${escapeAttr(value)}"`)
  return open.replace(/>$/, ` ${name}="${escapeAttr(value)}">`)
}

function stripMatchingOpen(html: string, openRe: RegExp): string {
  const masked = maskHtmlForTagScan(html)
  openRe.lastIndex = 0
  const match = openRe.exec(masked)
  if (!match) return html
  const tag = (match[1] || 'div').toLowerCase()
  const start = match.index
  const openEnd = start + match[0].length
  const close = closingTagIndex(masked, openEnd, tag)
  if (close < 0) return html
  const closeTok = html.slice(close).match(new RegExp(`^</${tag}\\s*>`, 'i'))
  const end = close + (closeTok?.[0].length ?? `</${tag}>`.length)
  return html.slice(0, start) + html.slice(end)
}

function stripLiveCarouselAndGreeting(inner: string): string {
  const withoutCarousel = stripMatchingOpen(
    inner,
    /<(div)\b(?=[^>]*\bdata-pw-promo-carousel=)[^>]*>/i
  )
  return withoutCarousel.replace(/<p\b[^>]*\bdata-pw-banner-greeting\b[^>]*>[\s\S]*?<\/p>/gi, '')
}

/** Live first paint must not include seed slides / «Bộ sưu tập mới». Lưu restores placeholders. */
function stripSeedBannerChrome(inner: string): string {
  let out = stripLiveCarouselAndGreeting(inner)
  out = stripMatchingOpen(out, /<(div)\b(?=[^>]*\bdata-pw-slides\b)[^>]*>/i)
  out = out.replace(/<(button|a)\b[^>]*\bdata-pw-slide-(?:prev|next)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
  out = out.replace(/<div\b[^>]*\b(?:class=["'][^"']*\bpw-slide-dots\b|data-pw-el=["']dots["'])[^>]*>[\s\S]*?<\/div>/gi, '')
  out = out.replace(/<(div|h[1-6]|p|span|a)\b[^>]*\bdata-pw-el=["'](?:copy|inner|title|subtitle|badge|cta|cta-secondary)["'][^>]*>[\s\S]*?<\/\1>/gi, '')
  out = out.replace(/<img\b[^>]*\bdata-pw-el=["']media["'][^>]*>/gi, '')
  return out
}

function findPersonalizeBannerRanges(
  html: string
): Array<{ start: number; openEnd: number; close: number; end: number; tag: string }> {
  const masked = maskHtmlForTagScan(html)
  const ranges: Array<{ start: number; openEnd: number; close: number; end: number; tag: string }> = []
  const re = /<(section|div)\b(?=[^>]*\bdata-pw-personalize-banner=)[^>]*>/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(masked))) {
    const tag = (match[1] || 'section').toLowerCase()
    const start = match.index
    const openEnd = start + match[0].length
    const close = closingTagIndex(masked, openEnd, tag)
    if (close < 0) continue
    const closeTok = html.slice(close).match(new RegExp(`^</${tag}\\s*>`, 'i'))
    const end = close + (closeTok?.[0].length ?? `</${tag}>`.length)
    if (ranges.some((range) => start >= range.start && end <= range.end)) continue
    ranges.push({ start, openEnd, close, end, tag })
    re.lastIndex = end
  }
  return ranges
}

export function buildLiveMarketingBannerCarouselHtml(
  items: PartnerMarketingBannerPublicItem[],
  locale: WebLocale
): string {
  if (!items.length) return ''
  const aria = locale === 'vi' ? 'Ưu đãi dành cho bạn' : 'Offers for you'
  const slides = items
    .map((item, i) => {
      const alt = escapeAttr(partnerMarketingBannerAlt(locale, item))
      const href = escapeAttr(item.href || '#')
      const src = escapeAttr(shopBannerDisplaySrc(item.image_url) || item.image_url)
      const greeting = escapeAttr(item.greeting || '')
      const kind = escapeAttr(item.kind)
      const active = i === 0 ? ' class="is-active"' : ''
      const tab = i === 0 ? '0' : '-1'
      const loading = i === 0 ? 'eager' : 'lazy'
      const srcAttr = i === 0 ? ` src="${src}"` : ` data-pw-src="${src}"`
      return `<a data-pw-promo-slide="1" data-pw-kind="${kind}" data-pw-promo-greeting="${greeting}" href="${href}" aria-label="${alt}" tabindex="${tab}"${active}><img${srcAttr} alt="${alt}" width="2100" height="900" loading="${loading}" decoding="async"/></a>`
    })
    .join('')
  let chrome = ''
  if (items.length > 1) {
    const prevLabel = locale === 'vi' ? 'Banner trước' : 'Previous banner'
    const nextLabel = locale === 'vi' ? 'Banner tiếp theo' : 'Next banner'
    const dots = items
      .map((_, i) => {
        const label = `${locale === 'vi' ? 'Xem banner ' : 'View banner '}${i + 1}`
        const on = i === 0 ? ' class="is-active"' : ''
        return `<button type="button" aria-label="${escapeAttr(label)}"${on}></button>`
      })
      .join('')
    chrome =
      `<button type="button" data-pw-promo-nav="1" data-pw-promo-prev="1" aria-label="${escapeAttr(prevLabel)}">‹</button>` +
      `<button type="button" data-pw-promo-nav="1" data-pw-promo-next="1" aria-label="${escapeAttr(nextLabel)}">›</button>` +
      `<div data-pw-promo-dots="1">${dots}</div>`
  }
  return `<div data-pw-promo-carousel="1" aria-label="${escapeAttr(aria)}">${slides}${chrome}</div>`
}

/** PDP must not keep the home 21:9 sale slider — Sửa nhanh chi tiết không có khối này. */
export function stripPersonalizeBannerHostsInHtml(html: string): string {
  if (!html) return html
  const ranges = findPersonalizeBannerRanges(html)
  if (!ranges.length) return html
  let out = html
  for (let i = ranges.length - 1; i >= 0; i--) {
    const range = ranges[i]
    let end = range.end
    const greet = out.slice(end).match(/^\s*<p\b[^>]*\bdata-pw-banner-greeting\b[^>]*>[\s\S]*?<\/p>/i)
    if (greet) end += greet[0].length
    out = `${out.slice(0, range.start)}${out.slice(end)}`
  }
  return out
}

export function bindLiveMarketingBannersToHtml(
  html: string,
  items: PartnerMarketingBannerPublicItem[] | null | undefined,
  locale: WebLocale
): string {
  if (!html) return html
  if (extractVisualHtmlPageKind(html) === 'product') return stripPersonalizeBannerHostsInHtml(html)
  if (items == null) return html
  const ranges = findPersonalizeBannerRanges(html)
  if (!ranges.length) return html
  const primary = ranges.findIndex((range) => {
    const open = html.slice(range.start, range.openEnd)
    return !/\bdata-pw-hidden=["']1["']/i.test(open)
  })
  const liveIndex = primary >= 0 ? primary : 0
  const chunks: string[] = []
  let cursor = 0
  ranges.forEach((range, i) => {
    chunks.push(html.slice(cursor, range.start))
    const open = html.slice(range.start, range.openEnd)
    let inner = html.slice(range.openEnd, range.close)
    const closeTok = html.slice(range.close, range.end)
    inner = stripSeedBannerChrome(inner)
    if (i === liveIndex && items.length) {
      chunks.push(
        stampAttr(stampAttr(open, PW_BANNER_LIVE_ATTR, '1'), 'data-pw-personalize-banner', 'promo')
      )
      chunks.push(buildLiveMarketingBannerCarouselHtml(items, locale))
      chunks.push(inner)
      chunks.push(closeTok)
      const greet = String(items[0]?.greeting || '').trim()
      if (greet) {
        chunks.push(`<p data-pw-banner-greeting="1">${escapeHtml(greet)}</p>`)
      }
    } else {
      chunks.push(stampAttr(open, PW_BANNER_LIVE_ATTR, 'off'))
      chunks.push(inner)
      chunks.push(closeTok)
    }
    cursor = range.end
    if (i === liveIndex) {
      const rest = html.slice(cursor)
      const leftover = rest.match(/^\s*<p\b[^>]*\bdata-pw-banner-greeting\b[^>]*>[\s\S]*?<\/p>/i)
      if (leftover) cursor += leftover[0].length
    }
  })
  chunks.push(html.slice(cursor))
  return chunks.join('')
}
