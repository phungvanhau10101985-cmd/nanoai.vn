import assert from 'node:assert/strict'
import test from 'node:test'
import {
  hydrateInventoryShopRowFromCatalog188,
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
