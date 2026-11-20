import assert from 'node:assert/strict'
import test from 'node:test'
import { buildGoogleMerchantCatalogFeedTsv } from '@/lib/messaging/google-merchant-catalog-feed'
import type { CatalogFeedInventoryRow } from '@/lib/messaging/catalog-feed-shared'

test('google merchant feed adds a flat shipping column when the shop fee is known', () => {
  const row = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Áo sơ mi',
    description: 'Cotton',
    image_url: 'https://cdn.example/a.jpg',
    price_amount: 100000,
    price_currency: 'VND',
    price_hint: '',
    is_active: true,
    stock_qty: 3,
    sku: 'QA1',
    remarketing_id: 'QA1',
    product_url: '',
    colors_json: [],
    sizes_json: [],
    gallery_urls: [],
    detail_image_urls: [],
  } as unknown as CatalogFeedInventoryRow
  const ctx = {
    platformOrigin: 'https://nanoai.vn',
    partnerSlug: 'gudo',
    brand: 'gudo.vn',
    shop: { siteSlug: 'gudo', origin: 'https://gudo.vn', customDomain: true },
    industryKey: 'fashion' as const,
    productTypeByInventoryId: {},
  }
  const free = buildGoogleMerchantCatalogFeedTsv([row], { ...ctx, shippingFeeAmount: 0 })
    .toString('utf8')
    .replace(/^\uFEFF/, '')
  const [freeHead, freeRow] = free.trim().split('\n')
  assert.match(freeHead, /\tshipping$/)
  assert.match(freeRow, /VN:::0 VND$/)
  assert.equal(freeHead.split('\t').length, freeRow.split('\t').length)

  const omitted = buildGoogleMerchantCatalogFeedTsv([row], ctx)
    .toString('utf8')
    .replace(/^\uFEFF/, '')
  const omittedHead = omitted.trim().split('\n')[0].split('\t')
  assert.equal(omittedHead.includes('shipping'), false)
  assert.equal(omittedHead.includes('shipping_weight'), true)
  assert.doesNotMatch(omitted, /VN:::/)
})
