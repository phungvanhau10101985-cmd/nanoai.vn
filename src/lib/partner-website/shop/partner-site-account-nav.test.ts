import assert from 'node:assert/strict'
import test from 'node:test'
import { PW_PAGE } from '@/lib/partner-website/visual-editor/pw-ui-contract'
import {
  normalizePartnerSitePathname,
  partnerSiteAccountNavActiveId,
  partnerSitePageShowsAccountNav,
  reactAccountShellNavFromPathname,
} from '@/lib/partner-website/shop/partner-site-account-nav'
import { getPartnerSiteAccountMenuItems, isPartnerSiteAccountHubRow, isPartnerSiteAccountSidebarItem } from '@/lib/partner-website/shop/partner-site-shop-nav-config'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'

test('account nav shows on cart/account/info, not home/pdp/listing, and login can hide it', () => {
  assert.equal(partnerSitePageShowsAccountNav(PW_PAGE.cart), true)
  assert.equal(partnerSitePageShowsAccountNav(PW_PAGE.account), true)
  assert.equal(partnerSitePageShowsAccountNav(PW_PAGE.info), true)
  assert.equal(partnerSitePageShowsAccountNav(PW_PAGE.home), false)
  assert.equal(partnerSitePageShowsAccountNav(PW_PAGE.product), false)
  assert.equal(partnerSitePageShowsAccountNav(PW_PAGE.listing), false)
  assert.equal(partnerSitePageShowsAccountNav(PW_PAGE.landing), false)
  assert.equal(partnerSitePageShowsAccountNav(PW_PAGE.account, { hideAccountNav: true }), false)
})

test('normalizes /site/{slug} and custom-domain paths the same', () => {
  assert.equal(normalizePartnerSitePathname('/site/188-shop/cart'), '/cart')
  assert.equal(normalizePartnerSitePathname('/cart'), '/cart')
  assert.equal(normalizePartnerSitePathname('/site/188-shop/orders/abc/deposit'), '/orders/abc/deposit')
  assert.equal(normalizePartnerSitePathname('/site/188-shop'), '/')
})

test('highlights cart, orders (including deposit), and account overview', () => {
  assert.equal(partnerSiteAccountNavActiveId('/site/demo/cart'), 'cart')
  assert.equal(partnerSiteAccountNavActiveId('/account/cart'), 'cart')
  assert.equal(partnerSiteAccountNavActiveId('/orders/DH1/deposit'), 'orders')
  assert.equal(partnerSiteAccountNavActiveId('/site/demo/orders/DH1'), 'orders')
  assert.equal(partnerSiteAccountNavActiveId('/account'), 'account')
  assert.equal(partnerSiteAccountNavActiveId('/privacy'), null)
})

test('react account layout maps cart/login/orders from the URL', () => {
  assert.deepEqual(reactAccountShellNavFromPathname('/site/demo/cart'), {
    pageKind: PW_PAGE.cart,
    activeNav: 'cart',
    hideAccountNav: false,
  })
  assert.deepEqual(reactAccountShellNavFromPathname('/login'), {
    pageKind: PW_PAGE.account,
    activeNav: 'account',
    hideAccountNav: true,
  })
  assert.deepEqual(reactAccountShellNavFromPathname('/site/demo/orders/DH1/deposit'), {
    pageKind: PW_PAGE.account,
    activeNav: 'account',
    hideAccountNav: false,
  })
  assert.deepEqual(reactAccountShellNavFromPathname('/account/wallet'), {
    pageKind: PW_PAGE.account,
    activeNav: 'account',
    hideAccountNav: false,
  })
})

test('account menu cart/orders use dedicated routes; cart CTA is place-order', () => {
  const items = getPartnerSiteAccountMenuItems({ siteSlug: 'demo-shop', locale: 'vi' })
  const cart = items.find((i) => i.id === 'cart')
  const orders = items.find((i) => i.id === 'orders')
  const account = items.find((i) => i.id === 'account')
  const wallet = items.find((i) => i.id === 'wallet')
  const wishlist = items.find((i) => i.id === 'wishlist')
  assert.ok(account)
  assert.match(String(cart?.href), /\/cart$/)
  assert.doesNotMatch(String(cart?.href), /\/account\/cart/)
  assert.match(String(orders?.href), /\/orders$/)
  assert.equal(wallet?.label, 'Ví quà / Khuyến mãi')
  assert.equal(wishlist?.label, 'Sản phẩm yêu thích')
  assert.equal(cart?.emoji, '🛒')
  const hubIds = items.filter(isPartnerSiteAccountHubRow).map((i) => i.id)
  assert.deepEqual(hubIds, [
    'cart',
    'orders',
    'recently-viewed',
    'addresses',
    'wallet',
    'notifications',
    'install-app',
    'wishlist',
    'security',
  ])
  const sidebarIds = items.filter(isPartnerSiteAccountSidebarItem).map((i) => i.id)
  assert.ok(!sidebarIds.includes('logout'))
  assert.ok(!sidebarIds.includes('contact'))
  const t = getPartnerSiteShopCopy('vi')
  assert.equal(t.cartCheckout, 'Đặt hàng')
  assert.equal(getPartnerSiteShopCopy('en').cartCheckout, 'Place order')
})
