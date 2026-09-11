/**
 * Header search — UX 188: the box is a link to `/tim-kiem` on every device, not an inline input.
 * Leftover saved HTML still has `<input data-pw-search>` — convert on Sửa nhanh / live.
 */
import type { WebLocale } from '@/lib/i18n/config'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { partnerSiteMobileSearchPath } from '@/lib/partner-website/shop/partner-site-mobile-search-path'
import type { VisualDeviceVariant } from '@/lib/partner-website/visual-editor/visual-editor-pages'

const HEADER_BLOCK_RE = /<header\b[^>]*>[\s\S]*?<\/header>/i
const SEARCH_INPUT_RE = /<input\b[^>]*(?:\bdata-pw-search\b|\btype=["']search["'])[^>]*\/?>/i
const SEARCH_SUBMIT_BTN_RE = /<button(\s[^>]*\bpw-search-submit\b[^>]*)>([\s\S]*?)<\/button>/i
const SEARCH_HISTORY_RE = /<div\b[^>]*\bdata-pw-search-history\b[^>]*>[\s\S]*?<\/div>/i

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeHtml(value: string): string {
  return escapeAttr(value)
}

function wordmarkTitle(html: string): string {
  const m = html.match(/<span[^>]*\bpw-wordmark\b[^>]*>([^<]*)</i)
  return (m?.[1] || '').trim()
}

export function htmlHasMobileSearchCompose(html: string): boolean {
  return /<a\b[^>]*\b(?:pw-search-compose|pw-shop-search-compose)\b/i.test(html)
}

/** Live visual iframe is sandboxed — compose must open the parent, like a real tap on 188. */
function stampComposeTargetTop(html: string): string {
  return html.replace(
    /<a(\s[^>]*\b(?:pw-search-compose|pw-shop-search-compose|pw-search-submit)\b[^>]*)>/gi,
    (full, attrs: string) => {
      if (/\btarget\s*=/i.test(attrs)) return full
      return `<a${attrs} target="_top">`
    }
  )
}

function stripComposeTargetTop(html: string): string {
  return html.replace(
    /<a(\s[^>]*\b(?:pw-search-compose|pw-shop-search-compose|pw-search-submit)\b[^>]*)>/gi,
    (_full, attrs: string) => `<a${attrs.replace(/\s*target\s*=\s*(["']).*?\1/gi, '')}>`
  )
}

/** HTML cũ còn ô gõ trên header — đổi thành link `/tim-kiem` như 188, mọi máy. */
export function ensureMobileSearchComposeInHtml(
  html: string,
  input: {
    locale?: WebLocale | null
    siteSlug?: string | null
    device?: VisualDeviceVariant | null
    title?: string | null
    /** Live iframe needs `_top`. Sửa nhanh must not — sandbox blocks it and clicks look dead. */
    targetTop?: boolean
  }
): string {
  if (!html.trim()) return html
  const targetTop = input.targetTop !== false
  if (htmlHasMobileSearchCompose(html)) {
    return targetTop ? stampComposeTargetTop(html) : stripComposeTargetTop(html)
  }
  const siteSlug = String(input.siteSlug || '').trim()
  if (!siteSlug) return html
  const header = html.match(HEADER_BLOCK_RE)
  if (!header) return html
  if (!SEARCH_INPUT_RE.test(header[0])) return html

  const t = getPartnerSiteShopCopy(input.locale ?? 'vi')
  const title = String(input.title || '').trim() || wordmarkTitle(html)
  const placeholder = escapeHtml(
    title ? t.searchComposePlaceholder.replace('{shop}', title) : t.searchPlaceholder
  )
  const aria = escapeAttr(t.searchComposeOpen)
  const href = escapeAttr(partnerSiteMobileSearchPath(siteSlug))
  const targetAttr = targetTop ? ' target="_top"' : ''
  const compose = `<a class="pw-search-compose" href="${href}"${targetAttr} aria-label="${aria}"><span>${placeholder}</span></a>`

  let nextHeader = header[0].replace(SEARCH_INPUT_RE, compose)
  nextHeader = nextHeader.replace(SEARCH_SUBMIT_BTN_RE, (_m, attrs: string, inner: string) => {
    const cleaned = String(attrs || '').replace(/\s*type=["'][^"']*["']/gi, '').replace(/\s*target\s*=\s*(["']).*?\1/gi, '')
    return `<a${cleaned} href="${href}"${targetAttr} aria-label="${aria}">${inner}</a>`
  })
  nextHeader = nextHeader.replace(SEARCH_HISTORY_RE, '')
  return html.replace(header[0], nextHeader)
}
