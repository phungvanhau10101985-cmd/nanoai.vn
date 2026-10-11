import assert from 'node:assert/strict'
import test from 'node:test'
import {
  partnerSiteCatalogHitPath,
  partnerSiteProductPath,
  partnerSiteStorefrontProductHref,
} from '@/lib/partner-website/shop/partner-site-shop-paths'

const ID = '00073cac-aaaa-4bbb-8ccc-ddddeeeeffff'

test('storefront product href prefers inventory UUID over source URL', () => {
  const href = partnerSiteStorefrontProductHref('demo-shop', {
    inventoryId: ID,
    name: 'Túi đeo chéo',
    productUrl: 'https://detail.1688.com/offer/123.html',
  })
  assert.equal(href, partnerSiteProductPath('demo-shop', ID, { name: 'Túi đeo chéo' }))
  assert.match(href, /\/site\/demo-shop\/products\//)
})

test('storefront product href ignores 1688/taobao URLs without inventory id', () => {
  assert.equal(
    partnerSiteStorefrontProductHref('demo-shop', {
      productUrl: 'https://detail.1688.com/offer/123.html',
    }),
    ''
  )
  assert.equal(
    partnerSiteStorefrontProductHref('demo-shop', {
      productUrl: 'https://item.taobao.com/item.htm?id=1',
    }),
    ''
  )
})

test('storefront product href rewrites shop.local inventory fallback and /products/ keys', () => {
  const fromInventory = partnerSiteStorefrontProductHref('demo-shop', {
    productUrl: `https://shop.local/inventory/${ID}`,
    name: 'Áo thun',
  })
  assert.equal(fromInventory, partnerSiteProductPath('demo-shop', ID, { name: 'Áo thun' }))

  const fromKey = partnerSiteStorefrontProductHref('gudo', {
    productUrl: '/site/gudo/products/ao-thun-00073cac',
    customDomain: true,
  })
  assert.equal(fromKey, '/products/ao-thun-00073cac')
})

test('it catalog hit opens the feature url, not the shop product page', () => {
  assert.equal(
    partnerSiteCatalogHitPath('nanoai-ws-un9v', ID, {
      name: 'Thử đồ 1 người',
      industryKey: 'it',
      productUrl: 'https://nanoai.vn/thu-do-online/1-nguoi',
    }),
    'https://nanoai.vn/thu-do-online/1-nguoi'
  )
  assert.equal(
    partnerSiteCatalogHitPath('nanoai-ws-un9v', ID, {
      name: 'Thử đồ 1 người',
      industryKey: 'it',
      productUrl: '/thu-do-online/1-nguoi',
    }),
    '/thu-do-online/1-nguoi'
  )
})

test('fashion catalog hit stays on the shop product page', () => {
  const href = partnerSiteCatalogHitPath('demo-shop', ID, {
    name: 'Áo',
    industryKey: 'fashion',
    productUrl: 'https://nanoai.vn/thu-do-online/1-nguoi',
  })
  assert.equal(href, partnerSiteProductPath('demo-shop', ID, { name: 'Áo' }))
})

test('it catalog hit ignores shop product urls and china source urls', () => {
  const shopPdp = partnerSiteCatalogHitPath('nanoai-ws-un9v', ID, {
    name: 'Thử đồ',
    industryKey: 'it',
    productUrl: 'https://nanoai.vn/site/nanoai-ws-un9v/products/thu-do-1-nguoi-86ae1f42',
  })
  assert.equal(shopPdp, partnerSiteProductPath('nanoai-ws-un9v', ID, { name: 'Thử đồ' }))
  const china = partnerSiteCatalogHitPath('nanoai-ws-un9v', ID, {
    name: 'Thử đồ',
    industryKey: 'it',
    productUrl: 'https://detail.1688.com/offer/1.html',
  })
  assert.equal(china, partnerSiteProductPath('nanoai-ws-un9v', ID, { name: 'Thử đồ' }))
})
