import type { WebLocale } from '@/lib/i18n/config'
import { escapeAttr, escapeHtml } from '@/lib/packaging/mockup-share-html'
import { shopBrowserChromeColor } from '@/lib/partner-website/template/partner-website-theme-tokens'

export type ShopVisualSeoPageKind = 'website' | 'article'

export function shopVisualSeoDescription(text: string, fallback: string): string {
  const raw = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
  const source = raw || String(fallback || '').replace(/\s+/g, ' ').trim()
  return source.slice(0, 160)
}

/** Head SEO dùng chung lúc seed — canonical/OG url tuyệt đối gắn lúc serve. */
export function buildShopVisualSeoHead(input: {
  title: string
  description: string
  locale: WebLocale
  pageKind?: ShopVisualSeoPageKind
  noIndex?: boolean
  keywords?: string[]
  imageUrl?: string | null
  /** Hex `--pw-primary`. Browsers ignore `var()` in `theme-color`. */
  themeColor?: string | null
}): string {
  const title = escapeHtml(input.title.trim().slice(0, 70) || 'Shop')
  const description = escapeAttr(shopVisualSeoDescription(input.description, input.title))
  const robots = input.noIndex
    ? 'noindex, nofollow'
    : 'index, follow, max-image-preview:large, max-snippet:-1'
  const keywords = (input.keywords || [])
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, 12)
    .join(', ')
  const ogType = input.pageKind === 'article' ? 'article' : 'website'
  const image = input.imageUrl?.trim() || ''
  const lang = String(input.locale || 'vi').replace(/[_-].*$/, '')
  return [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}"/>`,
    `<meta name="robots" content="${robots}"/>`,
    keywords ? `<meta name="keywords" content="${escapeAttr(keywords.slice(0, 400))}"/>` : '',
    `<meta name="theme-color" content="${escapeAttr(shopBrowserChromeColor(input.themeColor))}"/>`,
    `<meta property="og:type" content="${ogType}"/>`,
    `<meta property="og:title" content="${escapeAttr(input.title.trim().slice(0, 70))}"/>`,
    `<meta property="og:description" content="${description}"/>`,
    `<meta property="og:locale" content="${escapeAttr(lang)}"/>`,
    image ? `<meta property="og:image" content="${escapeAttr(image)}"/>` : '',
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}"/>`,
    `<meta name="twitter:title" content="${escapeAttr(input.title.trim().slice(0, 70))}"/>`,
    `<meta name="twitter:description" content="${description}"/>`,
    image ? `<meta name="twitter:image" content="${escapeAttr(image)}"/>` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export function buildShopVisualWebsiteJsonLd(input: {
  brand: string
  locale: WebLocale
  siteSlug?: string
  logoUrl?: string | null
  description?: string
}): string {
  const lang = String(input.locale || 'vi').replace(/[_-].*$/, '')
  const slug = input.siteSlug?.trim() || ''
  const org: Record<string, unknown> = {
    '@type': 'Organization',
    name: input.brand,
  }
  if (input.logoUrl?.trim()) {
    org.logo = { '@type': 'ImageObject', url: input.logoUrl.trim() }
  }
  const site: Record<string, unknown> = {
    '@type': 'WebSite',
    name: input.brand,
    inLanguage: lang,
    publisher: { '@id': '#pw-org' },
  }
  if (input.description?.trim()) site.description = input.description.trim().slice(0, 300)
  if (slug) {
    site.potentialAction = {
      '@type': 'SearchAction',
      target: `/site/${encodeURIComponent(slug)}/products?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    }
  }
  org['@id'] = '#pw-org'
  const graph = { '@context': 'https://schema.org', '@graph': [org, site] }
  return `<script type="application/ld+json" data-pw-seo-jsonld="website">${JSON.stringify(graph).replace(/</g, '\\u003c')}</script>`
}

/** Business identity Google can read on every public shop page. */
export function buildShopPublicOrganizationJsonLd(input: {
  name: string
  url: string
  logoUrl?: string | null
  telephone?: string | null
}): Record<string, unknown> {
  const name = input.name.trim() || 'Shop'
  const url = input.url.trim()
  const org: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name,
    ...(url ? { url } : {}),
  }
  const logo = input.logoUrl?.trim() || ''
  if (logo) org.logo = logo
  const telephone = input.telephone?.trim() || ''
  if (telephone) {
    org.contactPoint = {
      '@type': 'ContactPoint',
      telephone,
      contactType: 'customer service',
      areaServed: 'VN',
      availableLanguage: ['Vietnamese', 'English'],
    }
  }
  return org
}

export function injectShopOrganizationJsonLd(
  html: string,
  input: { name: string; url: string; logoUrl?: string | null; telephone?: string | null }
): string {
  if (!html.trim()) return html
  const json = JSON.stringify(buildShopPublicOrganizationJsonLd(input)).replace(/</g, '\\u003c')
  const tag = `<script type="application/ld+json" data-pw-seo-jsonld="organization">${json}</script>`
  const re = /<script\b[^>]*\bdata-pw-seo-jsonld=["']organization["'][^>]*>[\s\S]*?<\/script>/i
  if (re.test(html)) return html.replace(re, tag)
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${tag}\n</head>`)
  return `${html}\n${tag}`
}
