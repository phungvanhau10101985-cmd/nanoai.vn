import { partnerSitePwaIconPath } from './partner-site-pwa'

function escapeAttr(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

const ICON_LINK_RE =
  /<link\b[^>]*\brel=["'][^"']*\b(?:icon|shortcut|apple-touch-icon)[^"']*["'][^>]*\/?>\s*/gi

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
  return `${(hash >>> 0).toString(36)}t1`
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
      input.customDomain ? '/favicon.ico' : `/site/${encodeURIComponent(slug)}/favicon.ico`,
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
      input.customDomain ? '/apple-touch-icon.png' : `/site/${encodeURIComponent(slug)}/apple-touch-icon.png`,
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
  iconBust?: string | null
}): string {
  const slug = String(input.siteSlug || '').trim().toLowerCase()
  const token = input.iconBust?.trim() || cacheTokenOf(input)
  const iconPath = (size: 32 | 48 | 96 | 192 | 512) =>
    slug ? appendPartnerShopFaviconCacheToken(partnerSitePwaIconPath(slug, size, Boolean(input.customDomain)), token) : ''
  const icoPath = slug
    ? appendPartnerShopFaviconCacheToken(
        input.customDomain ? '/favicon.ico' : `/site/${encodeURIComponent(slug)}/favicon.ico`,
        token
      )
    : resolvePartnerShopFaviconHref(input)
  const pngPath = (size: 32 | 48 | 96 | 192 | 512) => {
    if (size === 48) {
      return appendPartnerShopFaviconCacheToken(
        input.customDomain ? '/favicon.png' : `/site/${encodeURIComponent(slug)}/favicon.png`,
        token
      )
    }
    return iconPath(size)
  }
  const applePath = appendPartnerShopFaviconCacheToken(
    input.customDomain ? '/apple-touch-icon.png' : `/site/${encodeURIComponent(slug)}/apple-touch-icon.png`,
    token
  )

  const icon32 = pngPath(32) || icoPath
  const icon48 = pngPath(48)
  const icon96 = pngPath(96)
  const icon192 = pngPath(192)
  const icon512 = pngPath(512)
  const apple = applePath || resolvePartnerShopAppleTouchHref({ ...input, siteSlug: slug })
  if (!icon32 && !apple && !icoPath) return ''

  const lines: string[] = []
  if (icoPath) {
    const href = escapeAttr(icoPath)
    lines.push(`<link rel="icon" type="image/x-icon" sizes="48x48" href="${href}"/>`)
    lines.push(`<link rel="shortcut icon" href="${href}"/>`)
  }
  if (icon48) {
    lines.push(`<link rel="icon" type="image/png" sizes="48x48" href="${escapeAttr(icon48)}"/>`)
  }
  if (icon96) {
    lines.push(`<link rel="icon" type="image/png" sizes="96x96" href="${escapeAttr(icon96)}"/>`)
  }
  if (icon32) {
    lines.push(`<link rel="icon" type="image/png" sizes="32x32" href="${escapeAttr(icon32)}"/>`)
  }
  if (icon192) {
    lines.push(`<link rel="icon" type="image/png" sizes="192x192" href="${escapeAttr(icon192)}"/>`)
  }
  if (icon512) {
    lines.push(`<link rel="icon" type="image/png" sizes="512x512" href="${escapeAttr(icon512)}"/>`)
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
  iconBust?: string | null
}): {
  icon: Array<{ url: string; type: string; sizes: string }>
  shortcut: Array<{ url: string; type: string }>
  apple: Array<{ url: string; type: string; sizes: string }>
} {
  const token = input.iconBust?.trim() || cacheTokenOf(input)
  const slug = input.siteSlug.trim().toLowerCase()
  const iconPath = (size: 32 | 48 | 96 | 192 | 512) =>
    appendPartnerShopFaviconCacheToken(
      partnerSitePwaIconPath(slug, size, input.customDomain),
      token
    )
  const icoPath = appendPartnerShopFaviconCacheToken(
    input.customDomain ? '/favicon.ico' : `/site/${encodeURIComponent(slug)}/favicon.ico`,
    token
  )
  const pngPath = (size: 32 | 48 | 96 | 192 | 512) => {
    if (size === 48) {
      return appendPartnerShopFaviconCacheToken(
        input.customDomain ? '/favicon.png' : `/site/${encodeURIComponent(slug)}/favicon.png`,
        token
      )
    }
    return iconPath(size)
  }
  const applePath = appendPartnerShopFaviconCacheToken(
    input.customDomain ? '/apple-touch-icon.png' : `/site/${encodeURIComponent(slug)}/apple-touch-icon.png`,
    token
  )

  const icon32 = pngPath(32)
  const icon48 = pngPath(48)
  const icon96 = pngPath(96)
  const icon192 = pngPath(192)
  const icon512 = pngPath(512)
  const icon180 = applePath || resolvePartnerShopAppleTouchHref({ ...input, siteSlug: slug })
  return {
    icon: [
      { url: icoPath, type: 'image/x-icon', sizes: '48x48' },
      { url: icon48, type: 'image/png', sizes: '48x48' },
      { url: icon96, type: 'image/png', sizes: '96x96' },
      { url: icon192, type: 'image/png', sizes: '192x192' },
      { url: icon512, type: 'image/png', sizes: '512x512' },
      { url: icon32, type: 'image/png', sizes: '32x32' },
    ],
    shortcut: [{ url: icoPath, type: 'image/x-icon' }],
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
