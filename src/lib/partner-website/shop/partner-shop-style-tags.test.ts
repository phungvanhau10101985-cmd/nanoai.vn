import assert from 'node:assert/strict'
import test from 'node:test'
import {
  allowedStyleTagsForListingL1,
  FASHION_STYLE_TAGS,
  FOOTWEAR_STYLE_TAGS,
  MIN_STYLE_TAG_FACET_PRODUCTS,
  styleTagFilterAliases,
  styleTagsFromProductText,
  styleTagsMeetingMinCount,
} from '@/lib/partner-website/shop/partner-shop-style-tags'

test('style tags extract canonical 188 labels from product text', () => {
  const tags = styleTagsFromProductText('Đầm maxi đuôi cá hoa nhí', 'Hàn Quốc', 'Thời trang Nữ')
  assert.ok(tags.has('Váy'))
  assert.ok(tags.has('Maxi'))
  assert.ok(tags.has('Đuôi cá'))
  assert.ok(tags.has('Hoa nhí'))
})

test('style tags match accent-stripped aliases', () => {
  const tags = styleTagsFromProductText('dam om body co v')
  assert.ok(tags.has('Váy'))
  assert.ok(tags.has('Ôm body'))
  assert.ok(tags.has('Cổ V'))
})

test('footwear L1 only keeps shoe tags', () => {
  const allowed = allowedStyleTagsForListingL1('Giày dép Nữ')
  assert.ok(allowed)
  assert.ok(allowed.has('Sneaker'))
  assert.ok(allowed.has('Cao gót'))
  assert.ok(!allowed.has('Váy'))
  assert.deepEqual([...allowed].sort(), [...FOOTWEAR_STYLE_TAGS].sort())
})

test('fashion L1 keeps apparel tags plus Cổ cao', () => {
  const allowed = allowedStyleTagsForListingL1('Thời trang Nữ')
  assert.ok(allowed)
  assert.ok(allowed.has('Váy'))
  assert.ok(allowed.has('Cổ cao'))
  assert.ok(!allowed.has('Sneaker'))
  assert.deepEqual([...allowed].sort(), [...FASHION_STYLE_TAGS].sort())
})

test('other L1 keeps every tag', () => {
  assert.equal(allowedStyleTagsForListingL1('Phụ kiện'), null)
})

test('filter aliases follow 188 dictionary and fallback to label', () => {
  assert.deepEqual(styleTagFilterAliases('Váy'), ['váy', 'đầm', 'dress'])
  assert.deepEqual(styleTagFilterAliases('UnknownCut'), ['UnknownCut'])
  assert.deepEqual(styleTagFilterAliases(''), [])
})

test('facet hides tags below min product count', () => {
  const counts = new Map<string, number>([
    ['Váy', MIN_STYLE_TAG_FACET_PRODUCTS],
    ['Maxi', MIN_STYLE_TAG_FACET_PRODUCTS - 1],
    ['Sneaker', 8],
  ])
  const fashion = styleTagsMeetingMinCount(counts, { allowed: FASHION_STYLE_TAGS })
  assert.deepEqual(
    fashion.map((x) => x.value),
    ['Váy']
  )
  const all = styleTagsMeetingMinCount(counts)
  assert.deepEqual(
    all.map((x) => x.value),
    ['Váy', 'Sneaker']
  )
})
