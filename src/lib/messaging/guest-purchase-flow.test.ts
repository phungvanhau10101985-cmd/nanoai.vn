import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPartnerShopCartAddUrlTemplate,
  decodePartnerShopCartAddSkuParam,
  guestChatActionOpensExternalPurchase,
  isGuestCartAddFromNanoAi,
  parseGuestExternalCartUrlTemplate,
  resolveGuestPurchaseButtonUrl,
} from '@/lib/messaging/guest-purchase-flow'

test('SaaS cart-add template uses public shop origin and {sku}', () => {
  assert.equal(
    buildPartnerShopCartAddUrlTemplate('https://gudo.vn/'),
    'https://gudo.vn/cart/add/{sku}?from=nanoai'
  )
  assert.equal(
    buildPartnerShopCartAddUrlTemplate('https://nanoai.local/site/demo-shop'),
    'https://nanoai.local/site/demo-shop/cart/add/{sku}?from=nanoai'
  )
  assert.equal(buildPartnerShopCartAddUrlTemplate('not-a-url'), null)
})

test('decode cart-add SKU keeps slash warehouse codes', () => {
  assert.equal(decodePartnerShopCartAddSkuParam('A123%2F4'), 'A123/4')
  assert.equal(decodePartnerShopCartAddSkuParam(['A123', '4']), 'A123/4')
  assert.equal(decodePartnerShopCartAddSkuParam('DEMO-188-1'), 'DEMO-188-1')
  assert.equal(decodePartnerShopCartAddSkuParam(''), '')
})

test('from=nanoai is the chat return marker', () => {
  assert.equal(isGuestCartAddFromNanoAi('nanoai'), true)
  assert.equal(isGuestCartAddFromNanoAi('NANOAI'), true)
  assert.equal(isGuestCartAddFromNanoAi('web'), false)
})

test('only Buy / Add to cart leave chat when web-cart mode is on', () => {
  assert.equal(guestChatActionOpensExternalPurchase('external_cart_url', 'buy'), true)
  assert.equal(guestChatActionOpensExternalPurchase('external_cart_url', 'add_cart'), true)
  assert.equal(guestChatActionOpensExternalPurchase('external_cart_url', 'card_click'), false)
  assert.equal(guestChatActionOpensExternalPurchase('external_cart_url', 'consult'), false)
  assert.equal(guestChatActionOpensExternalPurchase('in_chat', 'buy'), false)
})

test('external_cart_url buy button uses template, not PDP', () => {
  const nav = resolveGuestPurchaseButtonUrl(
    'external_cart_url',
    'https://shop.example/cart/add/{sku}?from=nanoai',
    { product_url: 'https://shop.example/products/bag', sku: 'A1/4' }
  )
  assert.equal(nav.ok, true)
  if (nav.ok) {
    assert.equal(nav.url, 'https://shop.example/cart/add/A1%2F4?from=nanoai')
  }
  assert.equal(parseGuestExternalCartUrlTemplate('https://x.com/cart?q=1'), null)
})

test('SaaS cart-add path encodes SKU and adds from=nanoai', async () => {
  const { partnerSiteCartAddPath, isPartnerSiteCartAddPath } = await import(
    '@/lib/partner-website/shop/partner-site-shop-paths'
  )
  assert.equal(
    partnerSiteCartAddPath('demo-shop', 'A1/4'),
    '/site/demo-shop/cart/add/A1%2F4?from=nanoai'
  )
  assert.equal(
    partnerSiteCartAddPath('demo-shop', 'A1/4', { customDomain: true, fromNanoAi: false }),
    '/cart/add/A1%2F4'
  )
  assert.equal(isPartnerSiteCartAddPath('/site/demo-shop/cart/add/SKU'), true)
  assert.equal(isPartnerSiteCartAddPath('/cart'), false)
})

test('stored external cart URL wins over SaaS auto template', async () => {
  const { pickGuestExternalCartUrlTemplate, guestPurchaseUsesSaasAutoCart } = await import(
    '@/lib/messaging/guest-purchase-flow'
  )
  const stored = 'https://188.com.vn/cart/add/{sku}?from=nanoai'
  const auto = 'https://gudo.vn/cart/add/{sku}?from=nanoai'
  assert.equal(pickGuestExternalCartUrlTemplate(stored, auto), stored)
  assert.equal(pickGuestExternalCartUrlTemplate(null, auto), auto)
  assert.equal(pickGuestExternalCartUrlTemplate('', auto), auto)
  assert.equal(guestPurchaseUsesSaasAutoCart({ saasLinked: true, storedTemplate: null }), true)
  assert.equal(guestPurchaseUsesSaasAutoCart({ saasLinked: true, storedTemplate: stored }), false)
  assert.equal(guestPurchaseUsesSaasAutoCart({ saasLinked: false, storedTemplate: null }), false)
})
