import assert from 'node:assert/strict'
import test from 'node:test'
import {
  cartLinesQuantity,
  cartLinesSignature,
  parseSiteCartLines,
} from '@/lib/partner-website/shop/cart-line-utils'

test('parseSiteCartLines keeps display cards and drops leftover PDP fields', () => {
  const lines = parseSiteCartLines([
    {
      id: 'line-1',
      quantity: 2,
      color: 'Đen',
      size: '',
      note: '',
      card: {
        name: 'Túi',
        image_url: 'https://img.alicdn.com/imgextra/bag.jpg',
        product_url: 'https://shop.example/p/1',
        price_hint: '1.380.000đ',
        inventory_id: '11111111-1111-4111-8111-111111111111',
        sku: 'SKU-1',
        color_variants: [{ name: 'Đen', img: 'https://img.alicdn.com/imgextra/full.jpg' }],
        color_image_urls: ['https://img.alicdn.com/imgextra/a.jpg', 'https://img.alicdn.com/imgextra/b.jpg'],
      },
      variantLineImages: [
        'https://img.alicdn.com/imgextra/a.jpg',
        'https://img.alicdn.com/imgextra/b.jpg',
        'https://img.alicdn.com/imgextra/c.jpg',
      ],
    },
  ])
  assert.equal(lines.length, 1)
  assert.equal(lines[0]?.card.name, 'Túi')
  assert.equal(lines[0]?.quantity, 2)
  assert.equal('color_variants' in (lines[0]?.card ?? {}), false)
  assert.equal('color_image_urls' in (lines[0]?.card ?? {}), false)
  assert.equal(lines[0]?.variantLineImages?.length, 2)
  assert.match(lines[0]?.card.image_url ?? '', /_600x600q90/)
  assert.equal(cartLinesQuantity(lines), 2)
  assert.equal(cartLinesSignature(lines), 'line-1:2:Đen:')
})
