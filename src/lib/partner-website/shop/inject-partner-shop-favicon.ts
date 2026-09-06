import { escapeAttr } from '@/lib/packaging/mockup-share-html'
import { partnerSitePwaIconPath } from '@/lib/partner-website/shop/partner-site-pwa'

const ICON_LINK_RE =
  /<link\b[^>]*\brel=["'](?:icon|shortcut icon|apple-touch-icon)["'][^>]*\/?>\s*/gi

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(String(value || '').trim())
}

export function resolvePartnerShopFaviconHref(input: {
  siteSlug?: string | null
  customDomain?: boolean
  faviconUrl?: string | null
  logoUrl?: string | null
}): string {
  const uploaded = String(input.faviconUrl || '').trim()
  if (isHttpUrl(uploaded)) return uploaded
  const slug = String(input.siteSlug || '').trim()
  if (slug) return partnerSitePwaIconPath(slug, 32, Boolean(input.customDomain))
  const logo = String(input.logoUrl || '').trim()
  return isHttpUrl(logo) ? logo : ''
}

export function resolvePartnerShopAppleTouchHref(input: {
  siteSlug?: string | null
  customDomain?: boolean
  faviconUrl?: string | null
  logoUrl?: string | null
}): string {
  const slug = String(input.siteSlug || '').trim()
  if (slug) return partnerSitePwaIconPath(slug, 180, Boolean(input.customDomain))
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
