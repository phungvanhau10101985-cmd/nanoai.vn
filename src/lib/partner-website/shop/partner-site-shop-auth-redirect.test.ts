import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPartnerShopLoginHref,
  composePartnerShopReturnLocation,
  isSafePartnerShopRedirectPath,
  isSafeRelativeRedirectPath,
  sanitizePartnerShopReturnLocation,
} from '@/lib/partner-website/shop/partner-site-shop-auth-redirect'
import { mapPartnerCustomDomainPathToInternal } from '@/lib/messaging/partner-custom-domain-site-path'
import { partnerSiteAccountPath, partnerSiteLoginPath } from '@/lib/partner-website/shop/partner-site-shop-paths'

test('safe relative redirect rejects protocol and protocol-relative URLs', () => {
  assert.equal(isSafeRelativeRedirectPath('/products/ao'), true)
  assert.equal(isSafeRelativeRedirectPath('/products/ao?color=red#qa'), true)
  assert.equal(isSafeRelativeRedirectPath('//evil.example'), false)
  assert.equal(isSafeRelativeRedirectPath('https://evil.example/x'), false)
  assert.equal(isSafeRelativeRedirectPath('products/ao'), false)
})

test('shop redirect stays on the same tenant and rejects login loop', () => {
  const slug = '188-shop'
  assert.equal(isSafePartnerShopRedirectPath('/site/188-shop/products/ao-1', slug), true)
  assert.equal(isSafePartnerShopRedirectPath('/site/188-shop/cart', slug), true)
  assert.equal(isSafePartnerShopRedirectPath('/site/188-shop/account/orders', slug), true)
  assert.equal(isSafePartnerShopRedirectPath('/products/ao-1', slug), true)
  assert.equal(isSafePartnerShopRedirectPath('/account', slug), true)
  assert.equal(isSafePartnerShopRedirectPath('/', slug), true)
  assert.equal(isSafePartnerShopRedirectPath('/login', slug), false)
  assert.equal(isSafePartnerShopRedirectPath('/site/188-shop/login', slug), false)
  assert.equal(isSafePartnerShopRedirectPath('/site/other-shop/account', slug), false)
  assert.equal(isSafePartnerShopRedirectPath('/dashboard', slug), false)
  assert.equal(isSafePartnerShopRedirectPath('/auth/login', slug), false)
})

test('compose return location keeps query and hash like 188', () => {
  assert.equal(
    composePartnerShopReturnLocation('/products/ao', 'color=red', '#qa'),
    '/products/ao?color=red#qa'
  )
  assert.equal(composePartnerShopReturnLocation('/cart/', '', ''), '/cart')
})

test('login href wraps a safe return path in ?redirect=', () => {
  const href = buildPartnerShopLoginHref('188-shop', '/site/188-shop/products/ao-1#qa')
  assert.equal(href, `${partnerSiteLoginPath('188-shop')}?redirect=${encodeURIComponent('/site/188-shop/products/ao-1#qa')}`)
  const custom = buildPartnerShopLoginHref('188-shop', '/cart', { customDomain: true })
  assert.equal(custom, '/login?redirect=%2Fcart')
})

test('custom domain /login maps to the shop login route', () => {
  assert.equal(mapPartnerCustomDomainPathToInternal('188-shop', '/login'), '/site/188-shop/login')
  assert.equal(partnerSiteLoginPath('188-shop', { customDomain: true }), '/login')
})

test('unsafe return falls back to account', () => {
  assert.equal(
    sanitizePartnerShopReturnLocation('188-shop', 'https://evil.example'),
    partnerSiteAccountPath('188-shop')
  )
  assert.equal(
    sanitizePartnerShopReturnLocation('188-shop', '/login'),
    partnerSiteAccountPath('188-shop')
  )
})
