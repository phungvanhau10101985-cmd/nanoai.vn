import assert from 'node:assert/strict'
import test from 'node:test'
import {
  appendPartnerSizeOrColorJsonFilter,
  countPartnerProductSitemapPages,
  partnerListingIdListCachePayload,
  SEARCH_ID_LIST_MAX,
  slicePartnerInventoryIdListPage,
} from '@/lib/partner-website/shop/partner-catalog-scale'

test('slicePartnerInventoryIdListPage paginates cached ids without a second SQL', () => {
  const ids = Array.from({ length: 120 }, (_, i) => `id-${i}`)
  const page = slicePartnerInventoryIdListPage({ ids, count: 120 }, 48, 48)
  assert.deepEqual(page.ids, ids.slice(48, 96))
  assert.equal(page.count, 120)
  assert.equal(page.beyondCachedIds, false)
})

test('slicePartnerInventoryIdListPage flags pages past the 5000 cached ids', () => {
  const ids = Array.from({ length: SEARCH_ID_LIST_MAX }, (_, i) => `id-${i}`)
  const page = slicePartnerInventoryIdListPage({ ids, count: 80_000 }, SEARCH_ID_LIST_MAX, 48)
  assert.equal(page.ids.length, 0)
  assert.equal(page.count, 80_000)
  assert.equal(page.beyondCachedIds, true)
})

test('partnerListingIdListCachePayload omits random seed and page offset', () => {
  const a = partnerListingIdListCachePayload({
    kind: 'text',
    q: 'Váy Hoa',
    sort: 'random',
    size: 'M',
  })
  const b = partnerListingIdListCachePayload({
    kind: 'text',
    q: 'váy hoa',
    sort: 'random',
    size: 'M',
  })
  assert.deepEqual(a, b)
  assert.equal('seed' in a, false)
  assert.equal('off' in a, false)
  assert.equal(a.q, 'váy hoa')
})

test('appendPartnerSizeOrColorJsonFilter matches JSON array then legacy LIKE', () => {
  const params: unknown[] = ['partner']
  const conditions: string[] = []
  appendPartnerSizeOrColorJsonFilter({
    params,
    conditions,
    column: 'sizes_json',
    value: 'M',
    legacyColumn: 'description',
  })
  assert.equal(params[1], 'm')
  assert.match(conditions[0], /sizes_json/)
  assert.match(conditions[0], /jsonb_array_elements/)
  assert.match(conditions[0], /description/)
  appendPartnerSizeOrColorJsonFilter({
    params,
    conditions,
    column: 'colors_json',
    value: '  ',
    legacyColumn: 'stock_note',
  })
  assert.equal(conditions.length, 1)
})

test('countPartnerProductSitemapPages pages 5k files up to 100k', () => {
  assert.equal(countPartnerProductSitemapPages(0), 1)
  assert.equal(countPartnerProductSitemapPages(5000), 1)
  assert.equal(countPartnerProductSitemapPages(5001), 2)
  assert.equal(countPartnerProductSitemapPages(100_000), 20)
  assert.equal(countPartnerProductSitemapPages(200_000), 20)
})
