import { describe, expect, it } from 'vitest'
import {
  buildPartnerShopFaviconHeadLinks,
  injectPartnerShopFaviconIntoHtml,
  resolvePartnerShopFaviconHref,
} from './inject-partner-shop-favicon'

describe('inject-partner-shop-favicon', () => {
  it('prefers uploaded favicon over shop logo', () => {
    expect(
      resolvePartnerShopFaviconHref({
        siteSlug: 'shop-a',
        customDomain: true,
        faviconUrl: 'https://cdn.example/fav.png',
        logoUrl: 'https://cdn.example/logo.png',
      })
    ).toBe('https://cdn.example/fav.png')
  })

  it('falls back to generated pwa-icon/32', () => {
    expect(
      resolvePartnerShopFaviconHref({
        siteSlug: 'shop-a',
        customDomain: true,
        faviconUrl: null,
        logoUrl: 'https://cdn.example/logo.png',
      })
    ).toBe('/pwa-icon/32')
    expect(
      resolvePartnerShopFaviconHref({
        siteSlug: 'shop-a',
        customDomain: false,
        logoUrl: 'https://cdn.example/logo.png',
      })
    ).toBe('/site/shop-a/pwa-icon/32')
  })

  it('replaces leftover icon links in head', () => {
    const html = `<!DOCTYPE html><html><head>
<link rel="icon" href="https://old/logo.png"/>
<title>Shop</title>
</head><body></body></html>`
    const next = injectPartnerShopFaviconIntoHtml(html, {
      siteSlug: 'shop-a',
      customDomain: true,
      faviconUrl: 'https://cdn.example/fav.png',
    })
    expect(next).toContain('https://cdn.example/fav.png')
    expect(next).not.toContain('https://old/logo.png')
    expect(next).toContain('rel="apple-touch-icon"')
    expect(buildPartnerShopFaviconHeadLinks({ siteSlug: 'shop-a', customDomain: true })).toContain(
      '/pwa-icon/32'
    )
  })
})
