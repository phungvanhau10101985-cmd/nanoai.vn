import assert from 'node:assert/strict'
import test from 'node:test'
import {
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
