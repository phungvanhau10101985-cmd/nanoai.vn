import assert from 'node:assert/strict'
import test from 'node:test'
import {
  mergeSearchQueries,
  normalizeSearchQuery,
  partnerSiteSearchHistoryStorageKey,
  PARTNER_SITE_SEARCH_HISTORY_MAX,
  prependSearchQuery,
  removeSearchQuery,
  siteVisitorHasShopAccount,
} from '@/lib/partner-website/shop/partner-site-search-history'

test('search history normalizes whitespace and caps length', () => {
  assert.equal(normalizeSearchQuery('  túi   xách  '), 'túi xách')
  assert.equal(normalizeSearchQuery('   '), '')
  assert.equal(normalizeSearchQuery('a'.repeat(200)).length, 80)
})

test('search history prepends newest query and dedupes case-insensitively', () => {
  assert.deepEqual(prependSearchQuery('Giày', ['túi', 'giày', 'áo']), ['Giày', 'túi', 'áo'])
})

test('search history merges lists newest-first and caps at 12', () => {
  const first = Array.from({ length: 8 }, (_, i) => `q${i}`)
  const second = Array.from({ length: 8 }, (_, i) => `p${i}`)
  const merged = mergeSearchQueries(first, second)
  assert.equal(merged.length, PARTNER_SITE_SEARCH_HISTORY_MAX)
  assert.equal(merged[0], 'q0')
  assert.equal(merged[8], 'p0')
})

test('search history removes one query without touching others', () => {
  assert.deepEqual(removeSearchQuery('TÚI', ['áo', 'túi', 'giày']), ['áo', 'giày'])
})

test('search history keys localStorage by shop slug', () => {
  assert.equal(partnerSiteSearchHistoryStorageKey('188-shop'), 'pw-search-history:188-shop')
})

test('search history treats guest account or linked user as logged in', () => {
  assert.equal(siteVisitorHasShopAccount({ guestAccountId: null, linkedUserId: null }), false)
  assert.equal(siteVisitorHasShopAccount({ guestAccountId: '  ', linkedUserId: '' }), false)
  assert.equal(siteVisitorHasShopAccount({ guestAccountId: 'acc-1', linkedUserId: null }), true)
  assert.equal(siteVisitorHasShopAccount({ guestAccountId: null, linkedUserId: 'user-1' }), true)
})
