import assert from 'node:assert/strict'
import test from 'node:test'
import {
  orderLineChinaSourceUrl,
  orderLineDisplaySku,
  orderLineShopHref,
} from '@/lib/messaging/partner-admin-order-line-meta'

const INVENTORY_ID = 'f2ef136d-4db9-4a44-970d-c94663124fca'

test('order detail SKU is the shop code, not the inventory UUID', () => {
  assert.equal(
    orderLineDisplaySku({
      product_sku_snapshot: '',
      inventory_sku: 'Qa0042',
      inventory_remarketing_id: 'A883050966011',
    }),
    'Qa0042'
  )
  assert.equal(
    orderLineDisplaySku({
      product_sku_snapshot: INVENTORY_ID,
      inventory_sku: 'Qa0042',
    }),
    'Qa0042'
  )
  assert.equal(orderLineDisplaySku({ product_sku_snapshot: INVENTORY_ID, inventory_sku: '' }), '')
})

test('order detail keeps the SKU captured at checkout', () => {
  assert.equal(
    orderLineDisplaySku({
      product_sku_snapshot: 'K0842',
      inventory_sku: 'Qa0042',
    }),
    'K0842'
  )
})

test('order detail China link is the 1688 source, shop link is the storefront PDP', () => {
  const line = {
    source_url: 'https://detail.1688.com/offer/883050966011.html',
    product_url: 'https://detail.1688.com/offer/883050966011.html',
  }
  assert.equal(orderLineChinaSourceUrl(line), line.source_url)
  assert.equal(
    orderLineShopHref({
      siteSlug: 'gudo-vn',
      websitePublicUrl: 'https://gudo.vn/',
      inventoryId: INVENTORY_ID,
      productName: 'Giày bóng đá trẻ em',
      productUrl: line.product_url,
    }),
    'https://gudo.vn/products/giay-bong-da-tre-em-f2ef136d'
  )
})

test('a Vietnam product URL is not labeled as a China source link', () => {
  assert.equal(
    orderLineChinaSourceUrl({
      source_url: 'https://gudo.vn/products/tui-deo',
      product_url: 'https://gudo.vn/products/tui-deo',
    }),
    ''
  )
})
