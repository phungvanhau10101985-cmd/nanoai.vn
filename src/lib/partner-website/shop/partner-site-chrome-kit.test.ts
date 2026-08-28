import { describe, expect, it } from 'vitest'
import {
  CHROME_KIT_DOCK_ITEMS,
  CHROME_KIT_HEAD_ACTION_ITEMS,
  PARTNER_SHOP_CHROME_KIT_CSS,
  PW_CHROME_KIT_ATTR,
  PW_DOCK_SHOW_ATTR,
  PW_KIT_X_ATTR,
  PW_KIT_X_MIN,
  buildChromeKitDockHtml,
  buildChromeKitHeadActionHtml,
  chromeKitHeadGroup,
  clampChromeKitShift,
  ensurePartnerSiteChromeKitInHtml,
  isChromeKitPickerKind,
} from '@/lib/partner-website/shop/partner-site-chrome-kit'
import { buildPartnerSiteHeaderHtml } from '@/lib/partner-website/shop/build-partner-site-header-html'

describe('partner-site-chrome-kit', () => {
  it('seeds head actions with recently-viewed and hides extras on desktop', () => {
    const html = buildChromeKitHeadActionHtml({ locale: 'vi', siteSlug: 'demo-shop', device: 'desktop' })
    expect(html).toContain('data-pw-chrome-btn="account"')
    expect(html).toContain('data-pw-chrome-btn="recently-viewed"')
    expect(html).toContain('data-pw-chrome-btn="cart"')
    expect(html).toContain(`${PW_CHROME_KIT_ATTR}="1"`)
    expect(html).not.toContain('data-pw-chrome-added="1"')
    expect(html).toContain('data-pw-chrome-btn="chat"')
    expect(html).toMatch(/data-pw-hidden="1"[^>]*data-pw-chrome-btn="chat"|data-pw-chrome-btn="chat"[^>]*data-pw-hidden="1"/)
  })

  it('hides account on mobile head by default', () => {
    const html = buildChromeKitHeadActionHtml({ locale: 'vi', siteSlug: 'demo-shop', device: 'mobile' })
    expect(html).toMatch(/data-pw-hidden="1"[^>]*data-pw-chrome-btn="account"|data-pw-chrome-btn="account"[^>]*data-pw-hidden="1"/)
    expect(html).toMatch(/data-pw-chrome-btn="cart"/)
    expect(html).not.toMatch(/data-pw-chrome-btn="cart"[^>]*data-pw-hidden="1"/)
  })

  it('builds one dock with shop and pdp visibility', () => {
    const html = buildChromeKitDockHtml({ locale: 'vi', siteSlug: 'demo-shop' })
    expect(html).toContain(`${PW_DOCK_SHOW_ATTR}="both"`)
    expect(html).toContain(`${PW_DOCK_SHOW_ATTR}="shop"`)
    expect(html).toContain(`${PW_DOCK_SHOW_ATTR}="pdp"`)
    expect(html).toContain('data-pw-chrome-btn="try-on"')
    expect(html).toContain('data-pw-chrome-btn="buy-now"')
    expect(html).toContain('data-pw-pdp-add-cart="1"')
    expect(CHROME_KIT_DOCK_ITEMS).toHaveLength(16)
    expect(CHROME_KIT_HEAD_ACTION_ITEMS.length).toBeGreaterThanOrEqual(9)
  })

  it('stamps missing kit items onto legacy header without hiding existing cart', () => {
    const legacy = `<header class="pw-header"><div class="pw-header-actions">
      <a data-pw-chrome-btn="cart" href="/cart">Giỏ</a>
    </div></header>
    <nav class="pw-bottom-nav"><a data-pw-chrome-btn="home" href="/">Home</a></nav>`
    const next = ensurePartnerSiteChromeKitInHtml(legacy, { locale: 'vi', siteSlug: 'demo-shop', device: 'desktop' })
    expect(next).toContain(`${PW_CHROME_KIT_ATTR}="actions"`)
    expect(next).toContain(`${PW_CHROME_KIT_ATTR}="dock"`)
    expect(next).toContain('data-pw-chrome-btn="recently-viewed"')
    expect(next).toContain('data-pw-chrome-btn="try-on"')
    expect(next).not.toMatch(/data-pw-chrome-btn="cart"[^>]*data-pw-hidden="1"/)
  })

  it('header factory emits kit hosts', () => {
    const { header, bottomNav } = buildPartnerSiteHeaderHtml({
      locale: 'vi',
      title: 'Demo',
      siteSlug: 'demo-shop',
      device: 'desktop',
    })
    expect(header).toContain(`${PW_CHROME_KIT_ATTR}="actions"`)
    expect(header).toContain('data-pw-chrome-btn="recently-viewed"')
    expect(bottomNav).toContain(`${PW_CHROME_KIT_ATTR}="dock"`)
    expect(bottomNav).toContain('data-pw-chrome-btn="add-cart"')
  })

  it('treats chrome buttons as kit-managed in the add picker', () => {
    expect(isChromeKitPickerKind('cart')).toBe(true)
    expect(isChromeKitPickerKind('lead-form')).toBe(false)
    expect(chromeKitHeadGroup('laptop')).toBe('pc')
    expect(chromeKitHeadGroup('tablet')).toBe('tablet')
  })

  it('uses icon-below labels on PC head and icon-only on phone', () => {
    const pc = buildChromeKitHeadActionHtml({ locale: 'vi', siteSlug: 'demo-shop', device: 'desktop' })
    expect(pc).toContain('data-pw-chrome-style="icon-label-below"')
    expect(pc).toMatch(/data-pw-chrome-btn="cart"[^>]*data-pw-chrome-style="icon-label-below"|data-pw-chrome-style="icon-label-below"[^>]*data-pw-chrome-btn="cart"/)
    const mobile = buildChromeKitHeadActionHtml({ locale: 'vi', siteSlug: 'demo-shop', device: 'mobile' })
    expect(mobile).toMatch(/data-pw-chrome-btn="cart"[^>]*pw-chrome-icon-only|pw-chrome-icon-only[^>]*data-pw-chrome-btn="cart"/)
    expect(mobile).not.toMatch(/data-pw-chrome-btn="cart"[^>]*icon-label-below/)
  })

  it('stamps categories as kit in the header factory', () => {
    const { header } = buildPartnerSiteHeaderHtml({
      locale: 'vi',
      title: 'Demo',
      siteSlug: 'demo-shop',
      device: 'desktop',
    })
    expect(header).toMatch(/data-pw-chrome-btn="categories"[^>]*data-pw-chrome-kit="1"|data-pw-chrome-kit="1"[^>]*data-pw-chrome-btn="categories"/)
  })

  it('ships live CSS for dock page visibility', () => {
    expect(PARTNER_SHOP_CHROME_KIT_CSS).toContain(
      '[data-pw-chrome-style="icon-label-below"]:not([data-pw-hidden="1"])'
    )
    expect(PARTNER_SHOP_CHROME_KIT_CSS).toContain('body:not([data-pw-page="product"])')
    expect(PARTNER_SHOP_CHROME_KIT_CSS).toContain('flex:1 1 0')
    expect(PARTNER_SHOP_CHROME_KIT_CSS).not.toMatch(
      /\.pw-bottom-nav\[data-pw-chrome-kit="dock"\]\{display:flex!important/
    )
  })

  it('keeps head icon shift in-flow on the actions host', () => {
    expect(clampChromeKitShift(-999)).toBe(PW_KIT_X_MIN)
    expect(clampChromeKitShift(-200)).toBe(-200)
    expect(clampChromeKitShift(12.6)).toBe(13)
    expect(PARTNER_SHOP_CHROME_KIT_CSS).toContain('--pw-kit-x')
    expect(PARTNER_SHOP_CHROME_KIT_CSS).toContain('transform:translateX(var(--pw-kit-x, 0px))')
    expect(PARTNER_SHOP_CHROME_KIT_CSS).not.toContain('margin-right:calc(-1 * var(--pw-kit-x')
    const html = `<header class="pw-header"><div class="pw-header-actions" ${PW_KIT_X_ATTR}="-16">
      <a data-pw-chrome-btn="cart" href="/cart">Giỏ</a>
    </div></header>`
    const next = ensurePartnerSiteChromeKitInHtml(html, { locale: 'vi', siteSlug: 'demo-shop', device: 'desktop' })
    expect(next).toContain(`${PW_KIT_X_ATTR}="-16"`)
    expect(next).toContain('--pw-kit-x:-16px')
    const fromCssOnly = ensurePartnerSiteChromeKitInHtml(
      `<header class="pw-header"><div class="pw-header-actions" style="--pw-kit-x:-20px">
        <a data-pw-chrome-btn="cart" href="/cart">Giỏ</a>
      </div></header>`,
      { locale: 'vi', siteSlug: 'demo-shop', device: 'desktop' }
    )
    expect(fromCssOnly).toContain(`${PW_KIT_X_ATTR}="-20"`)
    expect(fromCssOnly).toContain('--pw-kit-x:-20px')
  })

  it('resets leftover drag on in-flow header search so it can sit in the middle', () => {
    const html = `<header class="pw-header"><div class="pw-header-main">
      <div class="pw-brand-cluster"></div>
      <div class="pw-header-search" data-pw-el="search" data-pw-user-move="1" style="flex: 0 0 auto !important; width: 280px !important; max-width: none !important;">
        <form class="pw-search-form"></form>
      </div>
      <div class="pw-header-actions"><a data-pw-chrome-btn="cart" href="/cart">Giỏ</a></div>
    </div></header>`
    const next = ensurePartnerSiteChromeKitInHtml(html, { locale: 'vi', siteSlug: 'demo-shop', device: 'desktop' })
    expect(next).not.toMatch(/pw-header-search[^>]*data-pw-user-move/)
    expect(next).not.toMatch(/pw-header-search[^>]*width:\s*280px/)
  })

  it('keeps an absolutely placed search box', () => {
    const html = `<header class="pw-header"><div class="pw-header-main">
      <div class="pw-header-search" data-pw-el="search" data-pw-user-move="1" data-pw-placement="scene-absolute" style="width:280px">
        <form class="pw-search-form"></form>
      </div>
    </div></header>`
    const next = ensurePartnerSiteChromeKitInHtml(html, { locale: 'vi', siteSlug: 'demo-shop', device: 'desktop' })
    expect(next).toContain('data-pw-user-move="1"')
    expect(next).toContain('data-pw-placement="scene-absolute"')
    expect(next).toContain('width:280px')
  })
})
