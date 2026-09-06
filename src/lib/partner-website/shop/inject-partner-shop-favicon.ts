import { escapeAttr } from '@/lib/packaging/mockup-share-html'
import { partnerSitePwaIconPath } from '@/lib/partner-website/shop/partner-site-pwa'

const ICON_LINK_RE =
  /<link\b[^>]*\brel=["'](?:icon|shortcut icon|apple-touch-icon)["'][^>]*\/?>\s*/gi

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(String(value || '').trim())
}

/** Short token so Chrome refetches same-origin `/pwa-icon` + `/favicon.ico` after a logo change. */
export function partnerShopFaviconCacheToken(
  faviconUrl?: string | null,
  logoUrl?: string | null
): string {
  const src = String(faviconUrl || logoUrl || '').trim()
  if (!src) return ''
  let hash = 2166136261
  for (let i = 0; i < src.length; i += 1) {
    hash ^= src.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

export function appendPartnerShopFaviconCacheToken(href: string, token: string): string {
  const url = String(href || '').trim()
  const key = String(token || '').trim()
  if (!url || !key) return url
  return url.includes('?') ? `${url}&v=${encodeURIComponent(key)}` : `${url}?v=${encodeURIComponent(key)}`
}

function cacheTokenOf(input: { faviconUrl?: string | null; logoUrl?: string | null }): string {
  return partnerShopFaviconCacheToken(input.faviconUrl, input.logoUrl)
}

export function resolvePartnerShopFaviconHref(input: {
  siteSlug?: string | null
  customDomain?: boolean
  faviconUrl?: string | null
  logoUrl?: string | null
}): string {
  const uploaded = String(input.faviconUrl || '').trim()
  const token = cacheTokenOf(input)
  if (isHttpUrl(uploaded)) return appendPartnerShopFaviconCacheToken(uploaded, token)
  const slug = String(input.siteSlug || '').trim()
  if (slug) {
    return appendPartnerShopFaviconCacheToken(
      partnerSitePwaIconPath(slug, 32, Boolean(input.customDomain)),
      token
    )
  }
  const logo = String(input.logoUrl || '').trim()
  return isHttpUrl(logo) ? appendPartnerShopFaviconCacheToken(logo, token) : ''
}

export function resolvePartnerShopAppleTouchHref(input: {
  siteSlug?: string | null
  customDomain?: boolean
  faviconUrl?: string | null
  logoUrl?: string | null
}): string {
  const slug = String(input.siteSlug || '').trim()
  const token = cacheTokenOf(input)
  if (slug) {
    return appendPartnerShopFaviconCacheToken(
      partnerSitePwaIconPath(slug, 180, Boolean(input.customDomain)),
      token
    )
  }
  return resolvePartnerShopFaviconHref(input)
}

export function buildPartnerShopFaviconHeadLinks(input: {
  siteSlug?: string | null
  customDomain?: boolean
  faviconUrl?: string | null
  logoUrl?: string | null
}): string {
  const icon = resolvePartnerShopFaviconHref(input)
  const apple = resolvePartnerShopAppleTouchHref(input)
  if (!icon && !apple) return ''
  const lines: string[] = []
  if (icon) {
    const href = escapeAttr(icon)
    lines.push(`<link rel="icon" type="image/png" sizes="32x32" href="${href}"/>`)
    lines.push(`<link rel="shortcut icon" href="${href}"/>`)
  }
  if (apple) {
    lines.push(`<link rel="apple-touch-icon" sizes="180x180" href="${escapeAttr(apple)}"/>`)
  }
  return lines.join('\n')
}

export function buildPartnerShopFaviconMetadataIcons(input: {
  siteSlug: string
  customDomain: boolean
  faviconUrl?: string | null
  logoUrl?: string | null
}): {
  icon: Array<{ url: string; type: string; sizes: string }>
  shortcut: Array<{ url: string; type: string }>
  apple: Array<{ url: string; type: string; sizes: string }>
} {
  const token = cacheTokenOf(input)
  const icon32 =
    resolvePartnerShopFaviconHref(input) ||
    appendPartnerShopFaviconCacheToken(partnerSitePwaIconPath(input.siteSlug, 32, input.customDomain), token)
  const icon192 = appendPartnerShopFaviconCacheToken(
    partnerSitePwaIconPath(input.siteSlug, 192, input.customDomain),
    token
  )
  const icon180 = resolvePartnerShopAppleTouchHref(input)
  return {
    icon: [
      { url: icon32, type: 'image/png', sizes: '32x32' },
      { url: icon192, type: 'image/png', sizes: '192x192' },
    ],
    shortcut: [{ url: icon32, type: 'image/png' }],
    apple: [{ url: icon180, type: 'image/png', sizes: '180x180' }],
  }
}

/** Live + Sửa nhanh: luôn ghi favicon shop, gỡ leftover link icon cũ. */
export function injectPartnerShopFaviconIntoHtml(
  html: string,
  input: {
    siteSlug?: string | null
    customDomain?: boolean
    faviconUrl?: string | null
    logoUrl?: string | null
  }
): string {
  if (!html.trim()) return html
  const links = buildPartnerShopFaviconHeadLinks(input)
  if (!links) return html
  const stripped = html.replace(ICON_LINK_RE, '')
  if (/<\/head>/i.test(stripped)) {
    return stripped.replace(/<\/head>/i, `${links}\n</head>`)
  }
  if (/<head\b[^>]*>/i.test(stripped)) {
    return stripped.replace(/<head\b[^>]*>/i, (open) => `${open}\n${links}`)
  }
  return stripped
}
