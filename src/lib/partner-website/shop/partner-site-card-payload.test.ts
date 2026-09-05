import assert from 'node:assert/strict'
import test from 'node:test'
import { toPartnerSiteCardPayload } from '@/lib/partner-website/shop/partner-site-card-payload'
import {
  inventoryCardRowToShopProduct,
  type PartnerInventoryShopCardRow,
  type PartnerSiteShopProduct,
} from '@/lib/partner-website/shop/inventory-to-shop-product'

test('public card payload excludes PDP-only fields', () => {
  const product = {
    id: 'p1',
    name: 'Card',
    description: 'large description',
    detailDescription: '<img src="large">',
    galleryImages: ['large-1', 'large-2'],
    detailImages: ['detail-large'],
    productVideoUrl: 'video',
    priceHint: '100.000đ',
    imageUrl: 'card.jpg',
    productUrl: 'https://shop.local/p1',
    sku: 'SKU-1',
    detailPath: '/products/p1',
    stockQty: 1,
    sizes: ['S', 'M'],
    colors: [{ name: 'Red', img: 'large-red.jpg' }],
    productInfo: { large: 'blob' },
  } satisfies PartnerSiteShopProduct

  const payload = toPartnerSiteCardPayload(product)
  const json = JSON.stringify(payload)
  for (const key of [
    'description',
    'detailDescription',
    'galleryImages',
    'detailImages',
    'productVideoUrl',
    'productInfo',
    'sizes',
    'colors',
  ]) {
    assert.equal(Object.hasOwn(payload, key), false, `${key} leaked into card payload`)
  }
  assert.ok(Buffer.byteLength(json) < 1_500)
})

test('card mapper never reads PDP media or catalog blobs', () => {
  const row: PartnerInventoryShopCardRow & Record<string, unknown> = {
    id: 'p1',
    partner_id: 'shop1',
    sort_order: 0,
    sku: 'SKU-1',
    name: 'Card',
    stock_qty: 2,
    price_hint: '100.000đ',
    image_url: 'https://cdn.example/card.jpg',
    product_url: '',
    remarketing_id: 'R1',
    is_active: true,
    is_clearance: false,
    price_amount: 100_000,
    price_currency: 'VND',
    sale_price_amount: null,
    sale_starts_at: null,
    sale_ends_at: null,
    category_l1: 'Fashion',
    category_l2: null,
    category_l3: null,
    likes_count: 0,
    purchases_count: 0,
    reviews_count: 0,
    questions_count: 0,
    rating_score: 0,
    created_at: '',
    updated_at: '',
  }
  for (const key of ['description', 'gallery_urls', 'detail_image_urls', 'catalog_json', 'product_info_json']) {
    Object.defineProperty(row, key, {
      get() {
        throw new Error(`card mapper read ${key}`)
      },
    })
  }
  assert.doesNotThrow(() => inventoryCardRowToShopProduct('shop', row))
})
