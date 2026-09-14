import assert from 'node:assert/strict'
import test from 'node:test'
import { WEB_LOCALES } from '@/lib/i18n/config'
import { DEFAULT_PARTNER_WEBSITE_THEME } from '@/lib/partner-website/template/partner-website-template-types'
import { buildPartnerSiteShopThemeCss } from '@/lib/partner-website/shop/build-shop-theme-css'
import { buildPartnerSiteShopActionsBootstrapScript } from '@/lib/partner-website/shop/build-partner-site-shop-actions-bootstrap-script'
import {
  CART_ADDED_MODAL_COPY,
  hideLeftoverPartnerCartAddedHtmlPopup,
  PW_CART_ADDED_MODAL_CSS,
  PW_CART_ADDED_MODAL_RUNTIME_JS,
} from '@/lib/partner-website/shop/partner-site-cart-added-modal'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'

test('cart added modal copy exists for all shop locales', () => {
  for (const locale of WEB_LOCALES) {
    const copy = CART_ADDED_MODAL_COPY[locale]
    assert.ok(copy.cartAddedTitle)
    assert.ok(copy.cartGoToCart)
    assert.ok(copy.cartContinueShopping)
    assert.ok(copy.cartAddedClose)
    const shop = getPartnerSiteShopCopy(locale)
    assert.equal(shop.cartAddedTitle, copy.cartAddedTitle)
    assert.equal(shop.cartGoToCart, copy.cartGoToCart)
  }
})

test('cart added modal CSS matches 188 layout and theme tokens', () => {
  assert.match(PW_CART_ADDED_MODAL_CSS, /data-pw-cart-added-popup/)
  assert.match(PW_CART_ADDED_MODAL_CSS, /max-width:28rem/)
  assert.match(PW_CART_ADDED_MODAL_CSS, /min-width:640px/)
  assert.match(PW_CART_ADDED_MODAL_CSS, /min-width:768px/)
  assert.match(PW_CART_ADDED_MODAL_CSS, /max-width:32rem/)
  assert.match(PW_CART_ADDED_MODAL_CSS, /--pw-buy/)
  assert.doesNotMatch(PW_CART_ADDED_MODAL_CSS, /#ea580c|#f97316/)
  const theme = buildPartnerSiteShopThemeCss(DEFAULT_PARTNER_WEBSITE_THEME)
  assert.match(theme, /data-pw-cart-added-popup/)
  assert.match(theme, /pw-shop-cart-product-media/)
  assert.match(theme, /pw-shop-order-product/)
})

test('shop-actions injects cart added modal instead of success toast', () => {
  const script = buildPartnerSiteShopActionsBootstrapScript({ siteSlug: 'demo-shop', locale: 'vi' })
  assert.match(script, /showCartAddedModal/)
  assert.match(script, /data-pw-cart-added-popup/)
  assert.match(script, /Đã thêm vào giỏ hàng/)
  assert.match(script, /Vào giỏ hàng/)
  assert.match(script, /Mua sắm tiếp/)
  assert.match(PW_CART_ADDED_MODAL_RUNTIME_JS, /showCartAddedModal/)
  assert.match(PW_CART_ADDED_MODAL_RUNTIME_JS, /pw-shop-soft-nav/)
  assert.match(PW_CART_ADDED_MODAL_RUNTIME_JS, /data-pw-cart-added-go/)
  assert.match(PW_CART_ADDED_MODAL_RUNTIME_JS, /goBtn\.addEventListener\('pointerdown',hideCartAddedModal\)/)
  assert.match(PW_CART_ADDED_MODAL_RUNTIME_JS, /data-pw-cart-added-pdp/)
  assert.match(PW_CART_ADDED_MODAL_RUNTIME_JS, /cartAddedPdpHref/)
})

test('shop-actions queues guest cart then opens login, and does not gate the variant modal', () => {
  const script = buildPartnerSiteShopActionsBootstrapScript({ siteSlug: 'demo-shop', locale: 'vi' })
  assert.match(script, /function requirePurchaseLogin\(\)/)
  assert.match(script, /function queuePendingCart/)
  assert.match(script, /queuePendingCart\(product,\{buyNow:!!\(opts\.buyNow\|\|opts\.silent\)\}/)
  assert.match(script, /function flushPendingCart/)
  assert.match(script, /function consumeGoogleHandoff/)
  assert.match(script, /pw_auth/)
  assert.match(script, /app_guest_account_id/)
  assert.match(script, /AUTH_REQUIRED_CART_LOGIN|purchaseLoginHref/)
  assert.match(script, /window\.top\.location\.assign/)
  assert.match(script, /redirect=/)
  assert.match(script, /if\(isPdpCartTrigger\(addBtn\)\)\{openPdpVariantModal\(p,'add'\)/)
  assert.doesNotMatch(script, /if\(requirePurchaseLogin\(\)\)return;\s*var p=readProductFromEl\(addBtn\)/)
  assert.doesNotMatch(script, /function goProduct\(/)
  assert.doesNotMatch(script, /function prefetchProduct/)
  assert.doesNotMatch(script, /navigateShop\(dest\)/)
})

test('hideLeftoverPartnerCartAddedHtmlPopup hides the HTML runtime popup', () => {
  const attrs: Record<string, string> = {}
  const body = { style: { overflow: 'hidden' } }
  const root = {
    getAttribute: (key: string) => (key === 'data-pw-prev-overflow' ? 'auto' : null),
    setAttribute: (name: string, value: string) => {
      attrs[name] = value
    },
  }
  const doc = {
    getElementById: (id: string) => (id === 'pw-cart-added-popup' ? root : null),
    body,
  } as unknown as Document
  hideLeftoverPartnerCartAddedHtmlPopup(doc)
  assert.equal(attrs.hidden, '')
  assert.equal(body.style.overflow, 'auto')
})
