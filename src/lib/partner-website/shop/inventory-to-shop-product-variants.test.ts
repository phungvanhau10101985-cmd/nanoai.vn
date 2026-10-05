import assert from 'node:assert/strict'
import test from 'node:test'
import {
  hydrateInventoryShopRowFromCatalog188,
  inventoryCardRowToShopProduct,
  inventoryRowToLivePdpVariants,
} from '@/lib/partner-website/shop/inventory-to-shop-product'

test('inventoryRowToLivePdpVariants prefers structured sizes/colors', () => {
  const next = inventoryRowToLivePdpVariants({
    description: '["XS"]',
    stock_note: '[{"name":"Đỏ","img":"https://cdn.example/red.jpg"}]',
    sizes_json: ['S', 'M'],
    colors_json: [{ name: 'Kem', img: 'https://cdn.example/kem.jpg' }],
  })
  assert.deepEqual(next.sizes, ['S', 'M'])
  assert.equal(next.colors[0]?.name, 'Kem')
})

test('inventoryRowToLivePdpVariants falls back to description / stock_note JSON', () => {
  const next = inventoryRowToLivePdpVariants({
    description: '["L","XL"]',
    stock_note: '[{"name":"Đen","img":"https://cdn.example/black.jpg"}]',
  })
  assert.deepEqual(next.sizes, ['L', 'XL'])
  assert.equal(next.colors[0]?.name, 'Đen')
})

test('empty structured sizes/colors win over leftover description JSON', () => {
  const next = inventoryRowToLivePdpVariants({
    description: '["S","M","L","XL"]',
    stock_note: '[{"name":"Đỏ","img":"https://cdn.example/red.jpg"}]',
    sizes_json: [],
    colors_json: [],
  })
  assert.deepEqual(next.sizes, [])
  assert.deepEqual(next.colors, [])
})

test('hydrate fills missing color prices from the catalog snapshot', () => {
  const next = hydrateInventoryShopRowFromCatalog188({
    id: '9744be2d-0b8d-4aa6-82a4-9bd861f7a034',
    name: 'Van điện từ 2W31',
    colors_json: [
      { name: '2W31-15GBN-AC220V', img: 'https://cdn.example/15.jpg' },
      { name: '2W31-25GBN-AC220V', img: 'https://cdn.example/25.jpg' },
    ],
    catalog_json: {
      colors: [
        { name: '2W31-15GBN-AC220V', price: 940000, sku: '2W31-15GBN-AC220V' },
        { name: '2W31-25GBN-AC220V', price: 1240000, price_cny: 128.25, sku: '2W31-25GBN-AC220V' },
      ],
    },
  })
  const colors = next.colors_json as { name: string; price?: number; sku?: string }[]
  assert.equal(colors[0]?.price, 940000)
  assert.equal(colors[1]?.price, 1240000)
  assert.equal(colors[1]?.sku, '2W31-25GBN-AC220V')
})

test('hydrate keeps empty sizes_json / colors_json even if catalog_json snapshot has leftover variants', () => {
  const next = hydrateInventoryShopRowFromCatalog188({
    id: '9744be2d-0b8d-4aa6-82a4-9bd861f7a034',
    name: 'Túi Xách Tay Nam',
    sizes_json: [],
    colors_json: [],
    catalog_json: {
      sizes: ['S', 'M', 'L', 'XL'],
      colors: [{ name: 'Leftover', img: '' }],
    },
  })
  assert.deepEqual(next.sizes_json, [])
  assert.deepEqual(next.colors_json, [])
})

test('card mapper builds listing data without PDP or catalog fields', () => {
  const product = inventoryCardRowToShopProduct('demo', {
    id: '9744be2d-0b8d-4aa6-82a4-9bd861f7a034',
    partner_id: '86f375fc-7265-49d8-972e-179dd3188984',
    sort_order: 2,
    sku: 'SKU-1',
    name: 'Card product',
    stock_qty: 7,
    price_hint: '250.000đ',
    image_url: 'https://cdn.example/card.jpg',
    product_url: '',
    remarketing_id: 'RM-1',
    is_active: true,
    is_clearance: true,
    price_amount: 250000,
    price_currency: 'VND',
    sale_price_amount: 200000,
    sale_starts_at: '2026-09-01T00:00:00.000Z',
    sale_ends_at: '2026-09-30T00:00:00.000Z',
    category_l1: 'Thời trang',
    category_l2: 'Túi',
    category_l3: 'Túi mini',
    likes_count: 5,
    purchases_count: 4,
    reviews_count: 3,
    questions_count: 2,
    rating_score: 4.8,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-02T00:00:00.000Z',
  })

  assert.equal(product.detailPath, '/site/demo/products/card-product-9744be2d')
  assert.equal(product.imageUrl, 'https://cdn.example/card.jpg')
  assert.equal(product.isClearance, true)
  assert.equal(product.categoryL3, 'Túi mini')
  assert.deepEqual(product.galleryImages, ['https://cdn.example/card.jpg'])
  assert.deepEqual(product.detailImages, [])
  assert.equal(product.productInfo, null)
})
