import assert from 'node:assert/strict'
import test from 'node:test'
import { inventoryRowToLivePdpVariants } from '@/lib/partner-website/shop/inventory-to-shop-product'

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
