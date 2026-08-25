import assert from 'node:assert/strict'
import test from 'node:test'
import {
  collectShopProductGalleryImages,
  normalizeShopImageUrl,
  shopCardDisplaySrc,
} from '@/lib/partner-website/shop/inventory-shop-detail'
import { inventoryRowToShopProduct } from '@/lib/partner-website/shop/inventory-to-shop-product'

test('normalizeShopImageUrl rewrites blocked 188 Bunny host and protocol-relative URLs', () => {
  assert.equal(
    normalizeShopImageUrl('https://188comvn.b-cdn.net/site/a.jpg'),
    'https://cdn.188.com.vn/site/a.jpg'
  )
  assert.equal(
    normalizeShopImageUrl('//188comvn.b-cdn.net/site/a.jpg'),
    'https://cdn.188.com.vn/site/a.jpg'
  )
  assert.equal(normalizeShopImageUrl('https://cdn.188.com.vn/ok.jpg'), 'https://cdn.188.com.vn/ok.jpg')
  assert.equal(
    normalizeShopImageUrl('https://cbu01.alicdn.com/img/ibank/O1CN01a.jpg'),
    'https://img.alicdn.com/img/ibank/O1CN01a.jpg'
  )
  assert.equal(normalizeShopImageUrl(''), '')
  assert.equal(normalizeShopImageUrl('not-a-url'), '')
})

test('shopCardDisplaySrc proxies AliCDN/1688 so storefront cards are not hotlink-blocked', () => {
  const dress = 'https://img.alicdn.com/img/ibank/O1CN01aUuPLA2Dd3T8T15w4_!!991128631-0-cib.jpg'
  assert.equal(shopCardDisplaySrc(dress), `/api/fetch-image?url=${encodeURIComponent(dress)}`)
  assert.equal(
    shopCardDisplaySrc('https://cbu01.alicdn.com/img/ibank/O1CN01a.jpg'),
    `/api/fetch-image?url=${encodeURIComponent('https://img.alicdn.com/img/ibank/O1CN01a.jpg')}`
  )
  assert.equal(shopCardDisplaySrc('https://cdn.188.com.vn/site/ok.jpg'), 'https://cdn.188.com.vn/site/ok.jpg')
})

test('collectShopProductGalleryImages and shop mapper keep a reachable https card image', () => {
  const row = {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Váy liền thân',
    image_url: 'https://188comvn.b-cdn.net/site/vay.jpg',
    price_hint: '1.520.000đ',
  }
  assert.deepEqual(collectShopProductGalleryImages(row), ['https://cdn.188.com.vn/site/vay.jpg'])
  const product = inventoryRowToShopProduct('demo-shop', row)
  assert.equal(product?.imageUrl, 'https://cdn.188.com.vn/site/vay.jpg')
})
