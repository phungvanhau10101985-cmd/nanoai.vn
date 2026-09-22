/**
 * Preload the above-fold shop image (banner slide 0 or first product card).
 * Never preload `/api/fetch-image`.
 */

const PRELOAD_LINK_RE = /<link\b[^>]*\bdata-pw-lcp-preload=["']1["'][^>]*>/gi

function firstHttpsImgSrc(html: string, selectorHint: RegExp): string {
  const match = html.match(selectorHint)
  if (!match) return ''
  const src = match[1]?.trim() || ''
  if (!/^https?:\/\//i.test(src)) return ''
  if (/\/api\/fetch-image/i.test(src)) return ''
  return src
}

export function collectPartnerShopLcpPreloadHref(html: string): string {
  if (!html) return ''
  const banner = firstHttpsImgSrc(
    html,
    /<a\b[^>]*\bdata-pw-promo-slide=["']1["'][^>]*>[\s\S]*?<img\b[^>]*\bsrc=["']([^"']+)["']/i
  )
  if (banner) return banner
  const card = firstHttpsImgSrc(
    html,
    /<article\b[^>]*\bdata-pw-el=["']card["'][^>]*>[\s\S]*?<img\b[^>]*\bsrc=["']([^"']+)["']/i
  )
  return card
}

export function injectPartnerShopLcpPreloadLinks(html: string): string {
  if (!html) return html
  const href = collectPartnerShopLcpPreloadHref(html)
  const stripped = html.replace(PRELOAD_LINK_RE, '')
  if (!href) return stripped
  const link = `<link rel="preload" as="image" href="${href.replace(/"/g, '&quot;')}" fetchpriority="high" data-pw-lcp-preload="1"/>`
  if (/<\/head>/i.test(stripped)) return stripped.replace(/<\/head>/i, `${link}\n</head>`)
  return `${link}\n${stripped}`
}

export function injectPartnerShopCdnPreconnect(html: string, bunnyOrigin?: string | null): string {
  if (!html) return html
  const tags = [
    '<link rel="preconnect" href="https://img.alicdn.com" crossorigin data-pw-cdn-preconnect="1"/>',
    '<link rel="preconnect" href="https://gw.alicdn.com" crossorigin data-pw-cdn-preconnect="1"/>',
  ]
  const bunny = String(bunnyOrigin || '').trim().replace(/\/$/, '')
  if (/^https?:\/\//i.test(bunny)) {
    tags.push(`<link rel="preconnect" href="${bunny.replace(/"/g, '&quot;')}" crossorigin data-pw-cdn-preconnect="1"/>`)
  }
  const snippet = tags.join('')
  const stripped = html.replace(/<link\b[^>]*\bdata-pw-cdn-preconnect=["']1["'][^>]*>/gi, '')
  if (/<\/head>/i.test(stripped)) return stripped.replace(/<\/head>/i, `${snippet}\n</head>`)
  return `${snippet}\n${stripped}`
}
