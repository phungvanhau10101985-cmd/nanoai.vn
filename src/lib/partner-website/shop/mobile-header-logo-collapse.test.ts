import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PARTNER_SHOP_MOBILE_HEADER_LOGO_SCRIPT,
  PARTNER_SHOP_MOBILE_HEADER_LOGO_SCRIPT_ID,
  PW_HEAD_LOGO_COLLAPSED_ATTR,
  PW_MOBILE_HEADER_ICON_ONLY_RULES,
  PW_MOBILE_HEADER_LOGO_COLLAPSE_CSS,
  PW_ESCAPED_HEAD_CHROME_HIDE_CSS,
  PW_MOBILE_HEADER_PDP_LEFTOVER_HIDE_CSS,
  PW_MOBILE_HEADER_STACK_RULES,
  PW_MOBILE_LOGO_SCROLL_COLLAPSE_Y,
  PW_MOBILE_LOGO_SCROLL_EXPAND_Y,
} from '@/lib/partner-website/shop/mobile-header-logo-collapse'
import { injectPartnerShopChromeLayoutCss } from '@/lib/partner-website/shop/partner-shop-chrome-layout-css'

test('mobile logo collapse uses 188 hysteresis on live and Sửa nhanh', () => {
  assert.equal(PW_MOBILE_LOGO_SCROLL_COLLAPSE_Y, 72)
  assert.equal(PW_MOBILE_LOGO_SCROLL_EXPAND_Y, 28)
  assert.equal(PW_HEAD_LOGO_COLLAPSED_ATTR, 'data-pw-head-logo-collapsed')
  assert.equal(PARTNER_SHOP_MOBILE_HEADER_LOGO_SCRIPT_ID, 'pw-shop-mobile-header-logo')
  assert.equal(PARTNER_SHOP_MOBILE_HEADER_LOGO_SCRIPT.includes('nanoai-ve-active'), false)
  assert.equal(PARTNER_SHOP_MOBILE_HEADER_LOGO_SCRIPT.includes('__pwMobileHeadLogoSync'), true)
  assert.equal(PARTNER_SHOP_MOBILE_HEADER_LOGO_SCRIPT.includes('capture:true'), true)
  assert.equal(PARTNER_SHOP_MOBILE_HEADER_LOGO_SCRIPT.includes('</script>'), false)
  assert.equal(PARTNER_SHOP_MOBILE_HEADER_LOGO_SCRIPT.includes('--pw-sticky-head'), true)
  assert.equal(PARTNER_SHOP_MOBILE_HEADER_LOGO_SCRIPT.includes("d==='tablet'"), true)
  assert.equal(PARTNER_SHOP_MOBILE_HEADER_LOGO_SCRIPT.includes('visualViewport'), true)
  assert.equal(PARTNER_SHOP_MOBILE_HEADER_LOGO_SCRIPT.includes('touchmove'), true)
})

test('mobile header stack centers the logo row and keeps toolbar below', () => {
  assert.equal(PW_MOBILE_HEADER_STACK_RULES.includes('flex-wrap:wrap!important'), true)
  assert.equal(PW_MOBILE_HEADER_STACK_RULES.includes('order:-1!important'), true)
  assert.equal(PW_MOBILE_HEADER_STACK_RULES.includes('flex:1 1 100%!important'), true)
  assert.equal(PW_MOBILE_HEADER_STACK_RULES.includes('justify-content:center!important'), true)
  assert.equal(PW_MOBILE_HEADER_STACK_RULES.includes('var(--pw-logo-x, 0px)'), true)
  assert.equal(PW_MOBILE_HEADER_STACK_RULES.includes('var(--pw-logo-y, 0px)'), true)
  assert.equal(PW_MOBILE_HEADER_STACK_RULES.includes('data-pw-logo-empty'), true)
  assert.equal(PW_MOBILE_HEADER_STACK_RULES.includes('nanoai-ve-active'), true)
  assert.equal(PW_MOBILE_HEADER_STACK_RULES.includes('.pw-brand-cluster,.pw-shop-brand-cluster{display:contents!important'), true)
  assert.equal(PW_MOBILE_HEADER_STACK_RULES.includes('.pw-chrome-cat-wrap{display:contents'), false)
  assert.equal(PW_MOBILE_HEADER_STACK_RULES.includes('.pw-chrome-cat-wrap{display:inline-flex!important'), true)
  assert.equal(PW_MOBILE_HEADER_ICON_ONLY_RULES.includes('.pw-chrome-btn-label'), true)
  assert.equal(PW_MOBILE_HEADER_ICON_ONLY_RULES.includes('icon-label-below'), true)
  assert.equal(PW_MOBILE_HEADER_LOGO_COLLAPSE_CSS.includes(`${PW_HEAD_LOGO_COLLAPSED_ATTR}="1"`), true)
  assert.equal(PW_MOBILE_HEADER_LOGO_COLLAPSE_CSS.includes('display:none!important'), true)
  assert.equal(PW_MOBILE_HEADER_LOGO_COLLAPSE_CSS.includes('max-height:0!important'), true)
  assert.equal(PW_MOBILE_HEADER_LOGO_COLLAPSE_CSS.includes('overflow:hidden!important'), true)
  assert.equal(PW_MOBILE_HEADER_LOGO_COLLAPSE_CSS.includes('.nanoai-ve-logo-btn'), true)
  assert.equal(PW_MOBILE_HEADER_LOGO_COLLAPSE_CSS.includes(':is('), true)
  assert.equal(PW_MOBILE_HEADER_LOGO_COLLAPSE_CSS.includes('[data-pw-region="topbar"]'), true)
  assert.equal(PW_MOBILE_HEADER_PDP_LEFTOVER_HIDE_CSS.includes('header [data-pw-chrome-btn="try-on"]'), true)
  assert.equal(PW_MOBILE_HEADER_PDP_LEFTOVER_HIDE_CSS.includes('header [data-pw-chrome-btn="favorite-product"]'), true)
  assert.equal(PW_MOBILE_HEADER_PDP_LEFTOVER_HIDE_CSS.includes('[data-pw-live-chrome] [data-pw-chrome-btn="try-on"]'), true)
  assert.equal(PW_MOBILE_HEADER_PDP_LEFTOVER_HIDE_CSS.includes('main > .pw-shop-btn[data-pw-chrome-btn="try-on"]'), true)
  assert.equal(PW_MOBILE_HEADER_PDP_LEFTOVER_HIDE_CSS.includes('main > .pw-shop-btn[data-pw-chrome-btn="favorite-product"]'), true)
  assert.equal(PW_ESCAPED_HEAD_CHROME_HIDE_CSS.includes('main > .pw-topbar-inner'), true)
  assert.equal(PW_ESCAPED_HEAD_CHROME_HIDE_CSS.includes('[data-pw-chrome-btn="favorites-link"][data-pw-chrome-added]'), true)
  assert.equal(PW_MOBILE_HEADER_LOGO_COLLAPSE_CSS.includes('header [data-pw-chrome-btn="favorite-product"]'), true)
  assert.equal(
    /html\[[^\]]*\]\s+header \[data-pw-chrome-btn="try-on"\][\s\S]*?,\s*header \[data-pw-chrome-btn="favorite-product"\]/.test(
      PW_MOBILE_HEADER_PDP_LEFTOVER_HIDE_CSS
    ),
    false
  )
  assert.equal(PW_MOBILE_HEADER_STACK_RULES.includes('z-index:200!important'), true)
  assert.equal(PW_MOBILE_HEADER_STACK_RULES.includes('pointer-events:auto!important'), true)
  assert.equal(
    /html\[[^\]]*\]\s+\.pw-header a\.pw-brand[\s\S]*?,\s*\.pw-header a\[data-pw-logo-home\]/.test(
      PW_MOBILE_HEADER_LOGO_COLLAPSE_CSS
    ),
    false
  )
})

test('chrome layout injects mobile logo script and stack CSS once', () => {
  const html =
    '<!DOCTYPE html><html><head><title>Shop</title></head><body><header class="pw-header"></header></body></html>'
  const once = injectPartnerShopChromeLayoutCss(html)
  const twice = injectPartnerShopChromeLayoutCss(once)
  assert.equal(once.includes('id="pw-shop-mobile-header-logo"'), true)
  assert.equal(once.includes('data-pw-head-logo-collapsed'), true)
  assert.equal(once.includes('flex-wrap:wrap!important'), true)
  assert.equal(once.includes('.pw-container.pw-header-main'), true)
  assert.equal(once.includes('html[data-pw-edit-device="mobile"] .pw-brand-cluster'), true)
  assert.equal(once.includes('html[data-pw-edit-device="mobile"] [data-pw-region="topbar"]'), true)
  assert.equal(once.includes('html[data-pw-edit-device="mobile"] header [data-pw-chrome-btn="try-on"]'), true)
  assert.equal(once.includes('z-index:200!important'), true)
  assert.equal(once.includes('@media (max-width:767px)'), true)
  assert.equal((once.match(/id="pw-shop-mobile-header-logo"/g) || []).length, 1)
  assert.equal((twice.match(/id="pw-shop-mobile-header-logo"/g) || []).length, 1)
})
