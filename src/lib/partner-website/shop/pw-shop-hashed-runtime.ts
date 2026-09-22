import { createHash } from 'node:crypto'
import type { WebLocale } from '@/lib/i18n/config'
import { normalizeWebLocale } from '@/lib/i18n/config'
import { buildPartnerSiteCatalogBootstrapScript } from '@/lib/partner-website/shop/build-partner-site-catalog-bootstrap-script'
import { buildPartnerSitePersonalizationBootstrapScript } from '@/lib/partner-website/shop/build-personalization-bootstrap-script'
import { buildPartnerSitePdpBootstrapScript } from '@/lib/partner-website/shop/build-partner-site-pdp-bootstrap-script'
import { buildPartnerSiteShopActionsBootstrapScript } from '@/lib/partner-website/shop/build-partner-site-shop-actions-bootstrap-script'
import { buildPartnerSiteChromeToggleBootstrapScript } from '@/lib/partner-website/shop/build-partner-site-chrome-toggle-bootstrap-script'
import { buildPartnerSiteSearchBootstrapScript } from '@/lib/partner-website/shop/build-partner-site-search-bootstrap-script'
import { buildPartnerSaleCalendarBootstrapScript } from '@/lib/partner-website/shop/build-partner-sale-calendar-bootstrap-script'
import { buildPartnerMarketingBannerBootstrapScript } from '@/lib/partner-website/shop/build-partner-marketing-banner-bootstrap-script'
import { buildPartnerSiteOutfitBootstrapScript } from '@/lib/partner-website/shop/build-partner-site-outfit-bootstrap-script'

export const PW_SHOP_RUNTIME_ROUTE_PREFIX = '/pw-shop-runtime'

const HASHED_ATTRS = [
  'data-pw-catalog-bootstrap',
  'data-pw-personalization-bootstrap',
  'data-pw-pdp-bootstrap',
  'data-pw-shop-actions-bootstrap',
  'data-pw-chrome-toggle-bootstrap',
  'data-pw-search-bootstrap',
  'data-pw-sale-calendar-bootstrap',
  'data-pw-marketing-banner-bootstrap',
  'data-pw-outfit-bootstrap',
] as const

const NAME_BY_ATTR: Record<(typeof HASHED_ATTRS)[number], string> = {
  'data-pw-catalog-bootstrap': 'catalog',
  'data-pw-personalization-bootstrap': 'personalization',
  'data-pw-pdp-bootstrap': 'pdp',
  'data-pw-shop-actions-bootstrap': 'shop-actions',
  'data-pw-chrome-toggle-bootstrap': 'chrome-toggle',
  'data-pw-search-bootstrap': 'search',
  'data-pw-sale-calendar-bootstrap': 'sale-calendar',
  'data-pw-marketing-banner-bootstrap': 'marketing-banner',
  'data-pw-outfit-bootstrap': 'outfit',
}

const ATTR_BY_NAME = Object.fromEntries(
  Object.entries(NAME_BY_ATTR).map(([attr, name]) => [name, attr])
) as Record<string, string>

export type PartnerShopRuntimeFile = {
  name: string
  siteSlug: string
  locale: WebLocale
  hash: string
}

const FILE_RE = /^([a-z0-9-]+)\.([a-z0-9-]+)\.([a-z]{2})\.([a-f0-9]{12})\.js$/i

export function hashPartnerShopRuntimeBody(body: string): string {
  return createHash('sha1').update(body).digest('hex').slice(0, 12)
}

export function parsePartnerShopRuntimeFileName(file: string): PartnerShopRuntimeFile | null {
  const match = FILE_RE.exec(String(file || '').trim())
  if (!match) return null
  const name = match[1].toLowerCase()
  if (!ATTR_BY_NAME[name]) return null
  const locale = normalizeWebLocale(match[3])
  return {
    name,
    siteSlug: match[2].toLowerCase(),
    locale,
    hash: match[4].toLowerCase(),
  }
}

export function extractPartnerShopRuntimeScriptInner(snippet: string): string {
  const script = snippet.match(/<script\b[^>]*>([\s\S]*?)<\/script>/i)?.[1]
  return String(script || '').trim()
}

export function rebuildPartnerShopRuntimeJs(
  name: string,
  siteSlug: string,
  locale: WebLocale
): string | null {
  const slug = siteSlug.trim()
  if (!slug) return null
  const input = { siteSlug: slug, locale }
  switch (name) {
    case 'catalog':
      return extractPartnerShopRuntimeScriptInner(buildPartnerSiteCatalogBootstrapScript(input))
    case 'personalization':
      return extractPartnerShopRuntimeScriptInner(buildPartnerSitePersonalizationBootstrapScript(input))
    case 'pdp':
      return extractPartnerShopRuntimeScriptInner(buildPartnerSitePdpBootstrapScript(input))
    case 'shop-actions':
      return extractPartnerShopRuntimeScriptInner(buildPartnerSiteShopActionsBootstrapScript(input))
    case 'chrome-toggle':
      return extractPartnerShopRuntimeScriptInner(buildPartnerSiteChromeToggleBootstrapScript(input))
    case 'search':
      return extractPartnerShopRuntimeScriptInner(buildPartnerSiteSearchBootstrapScript(input))
    case 'sale-calendar':
      return extractPartnerShopRuntimeScriptInner(buildPartnerSaleCalendarBootstrapScript(input))
    case 'marketing-banner':
      return extractPartnerShopRuntimeScriptInner(buildPartnerMarketingBannerBootstrapScript(input))
    case 'outfit':
      return extractPartnerShopRuntimeScriptInner(buildPartnerSiteOutfitBootstrapScript(input))
    default:
      return null
  }
}

export function replaceInlineShopRuntimesWithHashedFiles(
  html: string,
  input: { siteSlug: string; locale: WebLocale }
): string {
  const slug = input.siteSlug.trim().toLowerCase()
  if (!html || !slug) return html
  let out = html
  for (const attr of HASHED_ATTRS) {
    const name = NAME_BY_ATTR[attr]
    const re = new RegExp(`<script\\b([^>]*\\b${attr}\\b[^>]*)>([\\s\\S]*?)</script>`, 'gi')
    out = out.replace(re, (full, rawAttrs: string, body: string) => {
      if (/\bsrc\s*=/i.test(rawAttrs)) return full
      const inner = String(body || '').trim()
      if (!inner) return full
      const hash = hashPartnerShopRuntimeBody(inner)
      const src = `${PW_SHOP_RUNTIME_ROUTE_PREFIX}/${name}.${slug}.${input.locale}.${hash}.js`
      const attrs = String(rawAttrs)
        .replace(/\s*\b(?:async|defer)\b/gi, '')
        .replace(/\s*$/, '')
      return `<script defer src="${src}"${attrs}></script>`
    })
  }
  return out
}

/** Tests: put hashed file bodies back inline so assertions can read the JS. */
export function expandPartnerShopHashedRuntimesForTest(html: string): string {
  return html.replace(
    /<script\b([^>]*\bsrc=["']\/pw-shop-runtime\/([^"']+)["'][^>]*)><\/script>/gi,
    (full, rawAttrs: string, file: string) => {
      const parsed = parsePartnerShopRuntimeFileName(file)
      if (!parsed) return full
      const body = rebuildPartnerShopRuntimeJs(parsed.name, parsed.siteSlug, parsed.locale)
      if (!body) return full
      const attrs = String(rawAttrs)
        .replace(/\s*\bsrc\s*=\s*(["'])[\s\S]*?\1/i, '')
        .replace(/\s*\b(?:async|defer)\b/gi, '')
      return `<script${attrs}>${body}</script>`
    }
  )
}
