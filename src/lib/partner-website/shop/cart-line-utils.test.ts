import assert from 'node:assert/strict'
import test from 'node:test'
import { shopCardDisplaySrc, shopPdpPageSrc } from '@/lib/partner-website/shop/inventory-shop-detail'
import {
  cartLineDisplaySrc,
  cartLinesQuantity,
  cartLinesSignature,
  formatVnd,
  formatVndOrZero,
  mergeSiteCartLine,
  parseSiteCartLines,
  type SiteCartLine,
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

test('cart shows the color photo the customer picked, with that color name', () => {
  const line: SiteCartLine = {
    id: 'a',
    quantity: 1,
    color: 'Đỏ',
    size: 'M',
    note: '',
    card: {
      name: 'Áo',
      image_url: 'https://img.alicdn.com/imgextra/main.jpg',
      product_url: 'https://shop.example/p/1',
    },
  }
  const picked: SiteCartLine = {
    ...line,
    variantLineImages: ['https://img.alicdn.com/imgextra/red.jpg'],
  }
  const src = cartLineDisplaySrc(picked)
  assert.match(src, /red\.jpg_1200x1200\.jpg/)
  assert.doesNotMatch(src, /main\.jpg/)
  const hero = 'https://img.alicdn.com/imgextra/red.jpg_1200x1200.jpg'
  assert.equal(shopPdpPageSrc(shopCardDisplaySrc(hero)), hero)
  const merged = mergeSiteCartLine([line], {
    id: 'b',
    quantity: 1,
    color: 'Đỏ',
    size: 'M',
    note: '',
    card: {
      name: 'Áo',
      image_url: 'https://img.alicdn.com/imgextra/red.jpg',
      product_url: 'https://shop.example/p/1',
    },
    variantLineImages: ['https://img.alicdn.com/imgextra/red.jpg'],
  })
  assert.equal(merged.length, 1)
  assert.equal(merged[0]?.quantity, 2)
  assert.equal(merged[0]?.color, 'Đỏ')
  assert.match(merged[0]?.card.image_url ?? '', /red\.jpg/)
})

test('formatVnd and formatVndOrZero format currency correctly', () => {
  assert.equal(formatVnd(1297200), '1.297.200đ')
  assert.equal(formatVnd(0), '—')
  assert.equal(formatVnd(-100), '—')

  assert.equal(formatVndOrZero(1297200), '1.297.200đ')
  assert.equal(formatVndOrZero(0), '0đ')
  assert.equal(formatVndOrZero(-100), '—')
})
