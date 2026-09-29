import { describe, expect, it } from 'vitest'
import {
  buildPartnerShopFaviconHeadLinks,
  injectPartnerShopFaviconIntoHtml,
  resolvePartnerShopFaviconHref,
} from './inject-partner-shop-favicon'

describe('inject-partner-shop-favicon', () => {
  it('prefers uploaded favicon over shop logo', () => {
    const href = resolvePartnerShopFaviconHref({
      siteSlug: 'shop-a',
      customDomain: true,
      faviconUrl: 'https://cdn.example/fav.png',
      logoUrl: 'https://cdn.example/logo.png',
    })
    expect(href.startsWith('https://cdn.example/fav.png')).toBe(true)
    expect(href).toMatch(/[?&]v=/)
    expect(href).not.toContain('logo.png')
  })

  it('falls back to generated favicon.ico', () => {
    expect(
      resolvePartnerShopFaviconHref({
        siteSlug: 'shop-a',
        customDomain: true,
        faviconUrl: null,
        logoUrl: 'https://cdn.example/logo.png',
      })
    ).toMatch(/^\/favicon\.ico\?v=[a-z0-9]+$/)
    expect(
      resolvePartnerShopFaviconHref({
        siteSlug: 'shop-a',
        customDomain: false,
        logoUrl: 'https://cdn.example/logo.png',
      })
    ).toMatch(/^\/site\/shop-a\/favicon\.ico\?v=[a-z0-9]+$/)
  })

  it('replaces leftover icon links in head and outputs google-compatible icon sizes', () => {
    const html = `<!DOCTYPE html><html><head>
<link rel="icon" href="https://old/logo.png"/>
<link rel="shortcut icon" href="/favicon.png"/>
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png"/>
<title>Shop</title>
</head><body></body></html>`
    const next = injectPartnerShopFaviconIntoHtml(html, {
      siteSlug: 'shop-a',
      customDomain: true,
      faviconUrl: 'https://cdn.example/fav.png',
    })
    expect(next).toContain('/favicon.ico')
    expect(next).toContain('sizes="48x48"')
    expect(next).toContain('/favicon.png')
    expect(next).toContain('/pwa-icon/96')
    expect(next).toContain('/pwa-icon/32')
    expect(next).toContain('/pwa-icon/192')
    expect(next).toContain('/pwa-icon/512')
    expect(next).not.toContain('https://old/logo.png')
    expect(next).not.toContain('/icons/apple-touch-icon.png')
    expect(next).toContain('rel="apple-touch-icon"')
    expect(buildPartnerShopFaviconHeadLinks({ siteSlug: 'shop-a', customDomain: true })).toContain(
      '/favicon.png'
    )
  })
})
