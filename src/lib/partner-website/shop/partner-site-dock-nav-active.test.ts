import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PARTNER_SHOP_DOCK_NAV_SCRIPT,
  PARTNER_SHOP_DOCK_NAV_SCRIPT_ID,
  PW_DOCK_NAV_ACTIVE_CSS,
  partnerSiteDockNavKindFromPage,
  partnerSiteDockNavKindFromPathname,
} from '@/lib/partner-website/shop/partner-site-dock-nav-active'

test('dock nav kind from data-pw-page', () => {
  assert.equal(partnerSiteDockNavKindFromPage('home'), 'home')
  assert.equal(partnerSiteDockNavKindFromPage('cart'), 'cart')
  assert.equal(partnerSiteDockNavKindFromPage('listing'), 'products')
  assert.equal(partnerSiteDockNavKindFromPage('account'), 'account')
  assert.equal(partnerSiteDockNavKindFromPage('info'), 'contact')
  assert.equal(partnerSiteDockNavKindFromPage('product'), null)
  assert.equal(partnerSiteDockNavKindFromPage('landing'), 'home')
})

test('dock nav kind from live pathname (custom domain + /site/slug)', () => {
  assert.equal(partnerSiteDockNavKindFromPathname('/'), 'home')
  assert.equal(partnerSiteDockNavKindFromPathname('/site/demo-shop'), 'home')
  assert.equal(partnerSiteDockNavKindFromPathname('/site/demo-shop/'), 'home')
  assert.equal(partnerSiteDockNavKindFromPathname('/cart'), 'cart')
  assert.equal(partnerSiteDockNavKindFromPathname('/site/demo-shop/cart'), 'cart')
  assert.equal(partnerSiteDockNavKindFromPathname('/wishlist'), 'wishlist')
  assert.equal(partnerSiteDockNavKindFromPathname('/site/demo-shop/wishlist'), 'wishlist')
  assert.equal(partnerSiteDockNavKindFromPathname('/account/notifications'), 'notifications')
  assert.equal(partnerSiteDockNavKindFromPathname('/site/demo-shop/account/notifications'), 'notifications')
  assert.equal(partnerSiteDockNavKindFromPathname('/account'), 'account')
  assert.equal(partnerSiteDockNavKindFromPathname('/products'), 'products')
  assert.equal(partnerSiteDockNavKindFromPathname('/c/ao/ao-thun'), 'products')
  assert.equal(partnerSiteDockNavKindFromPathname('/kho-sale'), 'sale')
  assert.equal(partnerSiteDockNavKindFromPathname('/products/ao-thun-demo'), null)
  assert.equal(partnerSiteDockNavKindFromPathname('/site/demo-shop/products/ao-thun-demo'), null)
})

test('active dock CSS uses theme primary, not a brand hex', () => {
  assert.equal(PW_DOCK_NAV_ACTIVE_CSS.includes('color:var(--pw-primary)!important'), true)
  assert.equal(PW_DOCK_NAV_ACTIVE_CSS.includes('#f97316'), false)
  assert.equal(PW_DOCK_NAV_ACTIVE_CSS.includes('html[data-pw-page="home"]'), true)
  assert.equal(PW_DOCK_NAV_ACTIVE_CSS.includes('[data-pw-chrome-btn="home"]'), true)
  assert.equal(PW_DOCK_NAV_ACTIVE_CSS.includes('.pw-account-btn.is-active'), true)
})

test('runtime script stamps aria-current and skips PDP CTAs', () => {
  assert.equal(PARTNER_SHOP_DOCK_NAV_SCRIPT_ID, 'pw-shop-dock-nav-active')
  assert.equal(PARTNER_SHOP_DOCK_NAV_SCRIPT.includes("setAttribute(ATTR,'page')"), true)
  assert.equal(PARTNER_SHOP_DOCK_NAV_SCRIPT.includes("'try-on':1"), true)
  assert.equal(PARTNER_SHOP_DOCK_NAV_SCRIPT.includes("classList.contains('nanoai-ve-active')"), true)
  assert.equal(PARTNER_SHOP_DOCK_NAV_SCRIPT.includes('wrapHist'), true)
})
