import assert from 'node:assert/strict'
import test from 'node:test'
import {
  jsonArrayLen,
  listingFacetCacheScopeLabel,
  listingIdListCacheScopeLabel,
  parseListingCacheLimit,
  parseListingCacheOffset,
  pinSearchKeyword,
} from '@/lib/partner-website/shop/partner-listing-cache-admin'

test('facet scope labels map PG types', () => {
  assert.equal(listingFacetCacheScopeLabel('category'), 'category')
  assert.equal(listingFacetCacheScopeLabel('search_q'), 'search')
  assert.equal(listingFacetCacheScopeLabel('seo_cluster'), 'other')
})

test('id-list scope labels map PG types', () => {
  assert.equal(listingIdListCacheScopeLabel('category'), 'category')
  assert.equal(listingIdListCacheScopeLabel('shop'), 'shop')
  assert.equal(listingIdListCacheScopeLabel('text'), 'other')
})

test('jsonArrayLen counts arrays only', () => {
  assert.equal(jsonArrayLen([{ value: 'S' }, { value: 'M' }]), 2)
  assert.equal(jsonArrayLen([]), 0)
  assert.equal(jsonArrayLen(null), 0)
  assert.equal(jsonArrayLen('["a"]'), 0)
})

test('limit / offset clamp', () => {
  assert.equal(parseListingCacheLimit(undefined, 40, 80), 40)
  assert.equal(parseListingCacheLimit(200, 40, 80), 80)
  assert.equal(parseListingCacheLimit(0, 40, 80), 40)
  assert.equal(parseListingCacheOffset(-3), 0)
  assert.equal(parseListingCacheOffset('12'), 12)
})

test('pin keyword trims and caps', () => {
  assert.equal(pinSearchKeyword('  váy   hoa  '), 'váy hoa')
  assert.equal(pinSearchKeyword('').length, 0)
  assert.equal(pinSearchKeyword('x'.repeat(120)).length, 80)
})
