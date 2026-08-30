import { describe, expect, it } from 'vitest'
import {
  CHROME_KIT_DOCK_ITEMS,
  CHROME_KIT_HEAD_ACTION_ITEMS,
  buildChromeKitFloatHostHtml,
  PARTNER_SHOP_CHROME_KIT_CSS,
  PW_CHROME_KIT_ATTR,
  PW_DOCK_SHOW_ATTR,
  PW_KIT_GAP_ATTR,
  PW_KIT_GAP_DEFAULT,
  PW_KIT_GAP_DEFAULT_COMPACT,
  PW_KIT_GAP_MAX,
  PW_KIT_X_ATTR,
  PW_KIT_X_MIN,
  buildChromeKitDockHtml,
  buildChromeKitHeadActionHtml,
  chromeKitGapDefaultForDevice,
  chromeKitHeadGroup,
  clampChromeKitGap,
  clampChromeKitShift,
  ensurePartnerSiteChromeKitInHtml,
  isChromeKitPickerKind,
  isMidCanvasFlowChromeKind,
  isPdpDockCtaLocked,
  pinMidCanvasTopChromeInHtml,
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
    expect(html).toContain(`${PW_DOCK_SHOW_ATTR}="shop"`)
    expect(html).toContain(`${PW_DOCK_SHOW_ATTR}="pdp"`)
    expect(html).toContain('pw-pdp-sticky-nav')
    expect(html).toContain('pw-pdp-sticky-ctas')
    expect(html).toContain('data-pw-pdp-home="1"')
    expect(html).toContain('data-pw-kit-lock="cta"')
    expect(html).toContain('data-pw-chrome-btn="try-on"')
    expect(html).toContain('data-pw-chrome-btn="buy-now"')
    expect(html).toContain('data-pw-pdp-add-cart="1"')
    expect(html).toMatch(/pw-pdp-sticky-copy/)
    expect(CHROME_KIT_DOCK_ITEMS).toHaveLength(16)
    expect(CHROME_KIT_HEAD_ACTION_ITEMS.length).toBeGreaterThanOrEqual(9)
  })

  it('seeds a hidden float kit host for chat zalo facebook top', () => {
    const html = buildChromeKitFloatHostHtml({ locale: 'vi', siteSlug: 'demo-shop' })
    expect(html).toContain(`${PW_CHROME_KIT_ATTR}="float"`)
    expect(html).toContain('data-pw-float-right="16"')
    expect(html).toContain('data-pw-float-stack-bottom="88"')
    expect(html).toContain('data-pw-float-gap="56"')
    expect(html).toContain('data-pw-float-size="40"')
    expect(html).toContain('--pw-float-size:40px')
    expect(html).toContain('data-pw-chrome-btn="chat"')
    expect(html).toContain('data-pw-chrome-btn="chat-zalo"')
    expect(html).toContain('data-pw-chrome-btn="topup"')
    expect(html).toContain('data-pw-chrome-float="1"')
    expect(html).toContain('data-pw-chrome-style="icon-circle"')
    expect(html).toContain('pw-chrome-icon-circle')
    expect(html).toContain('data-pw-chrome-size="40"')
    expect(html).toMatch(/data-pw-hidden="1"/)
    expect(html).not.toContain('data-pw-chrome-added="1"')
  })

  it('stamps missing kit items onto legacy header without hiding existing cart', () => {
    const legacy = `<header class="pw-header"><div class="pw-header-actions">
      <a data-pw-chrome-btn="cart" href="/cart">Giỏ</a>
    </div></header>
    <nav class="pw-bottom-nav"><a data-pw-chrome-btn="home" href="/">Home</a></nav>`
    const next = ensurePartnerSiteChromeKitInHtml(legacy, { locale: 'vi', siteSlug: 'demo-shop', device: 'desktop' })
    expect(next).toContain(`${PW_CHROME_KIT_ATTR}="actions"`)
    expect(next).toContain(`${PW_CHROME_KIT_ATTR}="dock"`)
    expect(next).toContain(`${PW_CHROME_KIT_ATTR}="float"`)
    expect(next).toContain('data-pw-chrome-btn="recently-viewed"')
    expect(next).toContain('data-pw-chrome-btn="try-on"')
    expect(next).toContain('data-pw-chrome-btn="chat-zalo"')
    expect(next).not.toMatch(/data-pw-chrome-btn="cart"[^>]*data-pw-hidden="1"/)
    expect(next).toContain('pw-pdp-sticky-nav')
    expect(next).toContain('data-pw-kit-lock="cta"')
    expect(next).toContain('data-pw-pdp-home="1"')
  })

  it('wraps a flat dock into the 188 PDP face and locks add-cart / buy', () => {
    const html = `<nav class="pw-bottom-nav" data-pw-chrome-kit="dock">
      <a data-pw-chrome-btn="home" data-pw-dock-show="both" href="/">Trang chủ</a>
      <a data-pw-chrome-btn="products" data-pw-dock-show="shop" href="/c">Sản phẩm</a>
      <button data-pw-chrome-btn="try-on" data-pw-dock-show="pdp">Thử</button>
      <button data-pw-chrome-btn="add-cart" data-pw-dock-show="pdp">Thêm giỏ</button>
      <button data-pw-chrome-btn="buy-now" data-pw-dock-show="pdp">Mua</button>
    </nav>`
    const next = ensurePartnerSiteChromeKitInHtml(html, { locale: 'vi', siteSlug: 'demo-shop' })
    expect(next).toContain('pw-pdp-sticky-nav')
    expect(next).toContain('pw-pdp-sticky-ctas')
    expect(next).toContain('data-pw-pdp-home="1"')
    expect(next).toMatch(/data-pw-chrome-btn="add-cart"[^>]*data-pw-kit-lock="cta"|data-pw-kit-lock="cta"[^>]*data-pw-chrome-btn="add-cart"/)
    expect(next).toMatch(/data-pw-chrome-btn="home"[^>]*data-pw-dock-show="shop"|data-pw-dock-show="shop"[^>]*data-pw-chrome-btn="home"/)
    expect(next).not.toMatch(/data-pw-chrome-btn="home"[^>]*data-pw-dock-show="both"/)
  })

  it('absorbs escaped float buttons into an empty kit host instead of reseeding defaults', () => {
    const html = `<!DOCTYPE html><html><body>
<aside data-pw-chrome-kit="float" data-pw-float-right="24" data-pw-float-stack-bottom="100" data-pw-float-gap="60" data-pw-float-size="32"></aside>
<button data-pw-chrome-btn="chat" data-pw-chrome-float="1" data-pw-chrome-kit="1" data-pw-btn-color="#111111" data-pw-chrome-style="icon-circle" style="--pw-btn-color:#111111">Chat</button>
</body></html>`
    const next = ensurePartnerSiteChromeKitInHtml(html, { locale: 'vi', siteSlug: 'demo-shop', device: 'desktop' })
    const kit = next.match(/<aside[^>]*data-pw-chrome-kit=["']float["'][^>]*>[\s\S]*?<\/aside>/i)?.[0] || ''
    expect(kit).toContain('data-pw-btn-color="#111111"')
    expect(kit).toContain('--pw-btn-color:#111111')
    expect(kit).toContain('data-pw-float-right="24"')
    expect((next.match(/data-pw-chrome-btn="chat"/g) || []).length).toBe(1)
    expect(next.indexOf('data-pw-btn-color="#111111"')).toBeGreaterThan(next.indexOf('data-pw-chrome-kit="float"'))
  })

  it('migrates legacy float icons to one shared circle size', () => {
    const html = `<aside data-pw-chrome-kit="float" data-pw-float-right="16" data-pw-float-stack-bottom="88" data-pw-float-gap="56">
      <button data-pw-chrome-btn="chat" data-pw-chrome-float="1" data-pw-chrome-style="icon" data-pw-chrome-size="22" class="pw-chrome-icon-only">Chat</button>
      <a data-pw-chrome-btn="chat-zalo" data-pw-chrome-float="1" data-pw-chrome-style="icon-square" data-pw-chrome-size="22">Zalo</a>
    </aside>`
    const next = ensurePartnerSiteChromeKitInHtml(html, { locale: 'vi', siteSlug: 'demo-shop', device: 'desktop' })
    expect(next).toContain('data-pw-float-size="22"')
    expect(next).toMatch(/data-pw-chrome-btn="chat"[^>]*data-pw-chrome-style="icon-circle"/)
    expect(next).toMatch(/data-pw-chrome-btn="chat"[^>]*pw-chrome-icon-circle/)
    expect(next).toMatch(/data-pw-chrome-btn="chat-zalo"[^>]*data-pw-chrome-style="icon-square"/)
    expect(next).toMatch(/data-pw-chrome-btn="chat"[^>]*data-pw-chrome-size="22"/)
    expect(next).toContain('data-pw-chrome-btn="topup"')
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
    expect(isChromeKitPickerKind('chat-zalo')).toBe(true)
    expect(isChromeKitPickerKind('topup')).toBe(true)
    expect(isChromeKitPickerKind('lead-form')).toBe(false)
    expect(isChromeKitPickerKind('stores')).toBe(false)
    expect(isMidCanvasFlowChromeKind('stores')).toBe(true)
    expect(isMidCanvasFlowChromeKind('wallet')).toBe(true)
    expect(isMidCanvasFlowChromeKind('cart')).toBe(false)
    expect(isMidCanvasFlowChromeKind('chat-zalo')).toBe(false)
    expect(isPdpDockCtaLocked('add-cart')).toBe(true)
    expect(isPdpDockCtaLocked('buy-now')).toBe(true)
    expect(isPdpDockCtaLocked('home')).toBe(false)
    expect(chromeKitHeadGroup('laptop')).toBe('laptop')
    expect(chromeKitHeadGroup('desktop')).toBe('desktop')
    expect(chromeKitHeadGroup('tablet')).toBe('tablet')
  })

  it('uses icon-below labels on PC head and icon-only on phone', () => {
    const pc = buildChromeKitHeadActionHtml({ locale: 'vi', siteSlug: 'demo-shop', device: 'desktop' })
    const laptop = buildChromeKitHeadActionHtml({ locale: 'vi', siteSlug: 'demo-shop', device: 'laptop' })
    expect(pc).toContain('data-pw-chrome-style="icon-label-below"')
    expect(laptop).toContain('data-pw-chrome-style="icon-label-below"')
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
      '[data-pw-chrome-added="1"][data-pw-chrome-btn]:not([data-pw-chrome-kit]){z-index:400!important}'
    )
    expect(PARTNER_SHOP_CHROME_KIT_CSS).toContain(
      '[data-pw-chrome-style="icon-label-below"]:not([data-pw-hidden="1"])'
    )
    expect(PARTNER_SHOP_CHROME_KIT_CSS).toContain('[data-pw-page="product"]')
    expect(PARTNER_SHOP_CHROME_KIT_CSS).toContain('html:has([data-pw-page="product"])')
    expect(PARTNER_SHOP_CHROME_KIT_CSS).toContain('html:has([data-pw-region="gallery"])')
    expect(PARTNER_SHOP_CHROME_KIT_CSS).toContain('html:has([data-pw-pdp-add-cart])')
    expect(PARTNER_SHOP_CHROME_KIT_CSS).toContain('html[data-pw-page="product"]')
    expect(PARTNER_SHOP_CHROME_KIT_CSS).toContain('pw-pdp-sticky-nav')
    expect(PARTNER_SHOP_CHROME_KIT_CSS).toContain('html:has([data-pw-chrome-kit="dock"]) .pw-pdp-sticky')
    expect(PARTNER_SHOP_CHROME_KIT_CSS).toContain('.pw-shop:has([data-pw-chrome-kit="dock"]) .pw-pdp-sticky')
    expect(PARTNER_SHOP_CHROME_KIT_CSS).toContain('flex:1 1 0')
    expect(PARTNER_SHOP_CHROME_KIT_CSS).not.toMatch(
      /\.pw-bottom-nav\[data-pw-chrome-kit="dock"\]\{display:flex!important/
    )
    expect(PARTNER_SHOP_CHROME_KIT_CSS).toContain('[data-pw-chrome-kit="float"]{')
    expect(PARTNER_SHOP_CHROME_KIT_CSS).toContain('display:contents')
    expect(PARTNER_SHOP_CHROME_KIT_CSS).not.toContain('flex-direction:column-reverse')
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

  it('keeps head icon gap on the actions host without inventing a default', () => {
    expect(clampChromeKitGap(-4)).toBe(0)
    expect(clampChromeKitGap(12.4)).toBe(12)
    expect(clampChromeKitGap(99)).toBe(PW_KIT_GAP_MAX)
    expect(chromeKitGapDefaultForDevice('desktop')).toBe(PW_KIT_GAP_DEFAULT)
    expect(chromeKitGapDefaultForDevice('laptop')).toBe(PW_KIT_GAP_DEFAULT)
    expect(chromeKitGapDefaultForDevice('tablet')).toBe(PW_KIT_GAP_DEFAULT_COMPACT)
    expect(chromeKitGapDefaultForDevice('mobile')).toBe(PW_KIT_GAP_DEFAULT_COMPACT)
    expect(PARTNER_SHOP_CHROME_KIT_CSS).toContain('gap:var(--pw-kit-gap, 2px)')
    const html = `<header class="pw-header"><div class="pw-header-actions" ${PW_KIT_GAP_ATTR}="16">
      <a data-pw-chrome-btn="cart" href="/cart">Giỏ</a>
    </div></header>`
    const next = ensurePartnerSiteChromeKitInHtml(html, { locale: 'vi', siteSlug: 'demo-shop', device: 'desktop' })
    expect(next).toContain(`${PW_KIT_GAP_ATTR}="16"`)
    expect(next).toContain('--pw-kit-gap:16px')
    const fromCssOnly = ensurePartnerSiteChromeKitInHtml(
      `<header class="pw-header"><div class="pw-header-actions" style="--pw-kit-gap:8px;--pw-kit-x:-12px">
        <a data-pw-chrome-btn="cart" href="/cart">Giỏ</a>
      </div></header>`,
      { locale: 'vi', siteSlug: 'demo-shop', device: 'desktop' }
    )
    expect(fromCssOnly).toContain(`${PW_KIT_GAP_ATTR}="8"`)
    expect(fromCssOnly).toContain('--pw-kit-gap:8px')
    expect(fromCssOnly).toContain(`${PW_KIT_X_ATTR}="-12"`)
    expect(fromCssOnly).toContain('--pw-kit-x:-12px')
    const zero = ensurePartnerSiteChromeKitInHtml(
      `<header class="pw-header"><div class="pw-header-actions" ${PW_KIT_GAP_ATTR}="0">
        <a data-pw-chrome-btn="cart" href="/cart">Giỏ</a>
      </div></header>`,
      { locale: 'vi', siteSlug: 'demo-shop', device: 'desktop' }
    )
    expect(zero).toContain(`${PW_KIT_GAP_ATTR}="0"`)
    expect(zero).toContain('--pw-kit-gap:0px')
    const untouched = ensurePartnerSiteChromeKitInHtml(
      `<header class="pw-header"><div class="pw-header-actions">
        <a data-pw-chrome-btn="cart" href="/cart">Giỏ</a>
      </div></header>`,
      { locale: 'vi', siteSlug: 'demo-shop', device: 'desktop' }
    )
    expect(untouched).not.toContain(PW_KIT_GAP_ATTR)
    expect(untouched).not.toContain('--pw-kit-gap')
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

  it('pins mid-page store and wallet buttons to the top scene and keeps coordinates', () => {
    const html = `<!DOCTYPE html><html><body>
<main>
<section data-pw-region="banner">Hero</section>
<section data-pw-region="catalog" data-pw-catalog><h2>CÓ THỂ BẠN THÍCH</h2></section>
</main>
<div data-pw-added-chrome-slot="1"><a data-pw-chrome-added="1" data-pw-chrome-btn="stores" data-pw-placement="scene-absolute" data-pw-box-x="12" data-pw-scene="1" data-pw-device="desktop" style="position:absolute;left:80px;top:40px">Cửa hàng</a></div>
<a data-pw-chrome-added="1" data-pw-chrome-btn="wallet" data-pw-user-move="1" style="transform:translate(20px,8px)">Ví quà</a>
</body></html>`
    const next = pinMidCanvasTopChromeInHtml(html)
    expect(next).not.toContain('data-pw-added-chrome-slot="1"')
    expect(next).toContain('data-pw-chrome-btn="stores"')
    expect(next).toContain('data-pw-chrome-btn="wallet"')
    expect(next).toContain('data-pw-placement="scene-absolute"')
    expect(next).toContain('data-pw-box-x="12"')
    expect(next).toContain('data-pw-scene="4"')
    expect(next).not.toContain('data-pw-scene="1"')
    expect(next).not.toContain('data-pw-device="desktop"')
    expect(next).toContain('Cửa hàng')
    expect(next).toContain('Ví quà')
  })
})
