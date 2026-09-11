import { describe, expect, it } from 'vitest'
import {
  ensureMobileSearchComposeInHtml,
  htmlHasMobileSearchCompose,
} from '@/lib/partner-website/shop/mobile-header-search-compose'
import { buildPartnerSiteHeaderHtml } from '@/lib/partner-website/shop/build-partner-site-header-html'

describe('header search compose', () => {
  it('seeds a compose link on mobile factory HTML', () => {
    const { header } = buildPartnerSiteHeaderHtml({
      locale: 'vi',
      title: 'Demo Shop',
      siteSlug: 'demo-shop',
      device: 'mobile',
    })
    expect(htmlHasMobileSearchCompose(header)).toBe(true)
    expect(header).toContain('/site/demo-shop/tim-kiem')
    expect(header).toContain('target="_top"')
    expect(header).not.toMatch(/data-pw-search type="search"/)
  })

  it('converts leftover mobile header input into /tim-kiem like 188', () => {
    const html = `<html data-pw-edit-device="mobile"><header class="pw-header">
      <div class="pw-header-search" data-pw-el="search">
        <form class="pw-search-form" data-pw-search-form role="search" method="get" action="/site/demo-shop/search">
          <input data-pw-search type="search" name="q" placeholder="Tìm sản phẩm…"/>
          <button type="button" class="pw-search-image-btn" data-pw-image-search>cam</button>
          <button type="submit" class="pw-search-submit" data-pw-search-glyph="lens">TÌM</button>
        </form>
        <div data-pw-search-history data-pw-search-history-panel="1" hidden></div>
      </div>
    </header></html>`
    const next = ensureMobileSearchComposeInHtml(html, {
      locale: 'vi',
      siteSlug: 'demo-shop',
      device: 'mobile',
      title: 'Demo Shop',
    })
    expect(htmlHasMobileSearchCompose(next)).toBe(true)
    expect(next).toContain('/site/demo-shop/tim-kiem')
    expect(next).toContain('target="_top"')
    expect(next).not.toMatch(/data-pw-search type="search"/)
    expect(next).toContain('data-pw-image-search')
    expect(next).not.toContain('data-pw-search-history')
    expect(next).toContain('class="pw-search-submit"')
    expect(next).not.toMatch(/<button[^>]*pw-search-submit/)
  })

  it('converts leftover header input on desktop and tablet into /tim-kiem like 188', () => {
    const leftover = `<header><form data-pw-search-form><input data-pw-search type="search" name="q"/></form></header>`
    const desktop = ensureMobileSearchComposeInHtml(leftover, {
      locale: 'vi',
      siteSlug: 'demo-shop',
      device: 'desktop',
    })
    const tablet = ensureMobileSearchComposeInHtml(leftover, {
      locale: 'vi',
      siteSlug: 'demo-shop',
      device: 'tablet',
    })
    expect(htmlHasMobileSearchCompose(desktop)).toBe(true)
    expect(htmlHasMobileSearchCompose(tablet)).toBe(true)
    expect(desktop).toContain('/site/demo-shop/tim-kiem')
    expect(tablet).toContain('/site/demo-shop/tim-kiem')
  })

  it('is idempotent when the compose link is already there', () => {
    const { header } = buildPartnerSiteHeaderHtml({
      locale: 'vi',
      title: 'Demo Shop',
      siteSlug: 'demo-shop',
      device: 'mobile',
    })
    const again = ensureMobileSearchComposeInHtml(header, {
      locale: 'vi',
      siteSlug: 'demo-shop',
      device: 'mobile',
    })
    expect(again).toBe(header)
  })

  it('adds target=_top to leftover compose links so live iframe opens the parent', () => {
    const html = `<html data-pw-edit-device="mobile"><header class="pw-header">
      <a class="pw-search-compose" href="/site/demo-shop/tim-kiem"><span>Tìm sản phẩm…</span></a>
    </header></html>`
    const next = ensureMobileSearchComposeInHtml(html, {
      locale: 'vi',
      siteSlug: 'demo-shop',
      device: 'mobile',
    })
    expect(next).toContain('target="_top"')
    expect(next).toContain('pw-search-compose')
  })

  it('strips target=_top in Sửa nhanh so compose clicks can select', () => {
    const html = `<html data-pw-edit-device="desktop"><header class="pw-header">
      <a class="pw-search-compose" href="/site/demo-shop/tim-kiem" target="_top"><span>Tìm sản phẩm…</span></a>
      <a class="pw-search-submit" href="/site/demo-shop/tim-kiem" target="_top">TÌM</a>
    </header></html>`
    const next = ensureMobileSearchComposeInHtml(html, {
      locale: 'vi',
      siteSlug: 'demo-shop',
      device: 'desktop',
      targetTop: false,
    })
    expect(next).toContain('pw-search-compose')
    expect(next).not.toContain('target="_top"')
  })

  it('converts leftover input without target=_top when authoring', () => {
    const html = `<header><form data-pw-search-form><input data-pw-search type="search" name="q"/></form></header>`
    const next = ensureMobileSearchComposeInHtml(html, {
      locale: 'vi',
      siteSlug: 'demo-shop',
      device: 'desktop',
      targetTop: false,
    })
    expect(htmlHasMobileSearchCompose(next)).toBe(true)
    expect(next).not.toContain('target="_top"')
  })

  it('still converts leftover input when injected CSS mentions .pw-search-compose', () => {
    const html = `<html><head><style>.pw-search-compose,.pw-shop-search-compose{flex:1}</style></head>
    <body><header class="pw-header">
      <form class="pw-search-form" data-pw-search-form>
        <input data-pw-search type="search" name="q" placeholder="Tìm sản phẩm…"/>
        <button type="submit" class="pw-search-submit">TÌM</button>
      </form>
    </header></body></html>`
    const next = ensureMobileSearchComposeInHtml(html, {
      locale: 'vi',
      siteSlug: 'demo-shop',
      title: 'Demo Shop',
    })
    expect(htmlHasMobileSearchCompose(next)).toBe(true)
    expect(next).not.toMatch(/data-pw-search type="search"/)
    expect(next).toContain('/site/demo-shop/tim-kiem')
  })
})
