import assert from 'node:assert/strict'
import test from 'node:test'
import {
  generate188SearchSlug,
  isSaleListingSearchTerm,
  matchPartnerCategoryPathForSearch,
  stripSearchChatFiller,
  tokenizePartnerTextSearch,
} from '@/lib/partner-website/shop/partner-site-text-search'

test('sale listing keywords match 188 kho-sale redirects', () => {
  assert.equal(isSaleListingSearchTerm('sale'), true)
  assert.equal(isSaleListingSearchTerm('Kho sale'), true)
  assert.equal(isSaleListingSearchTerm('thanh lý'), true)
  assert.equal(isSaleListingSearchTerm('áo sale'), false)
  assert.equal(isSaleListingSearchTerm(''), false)
})

test('tokenize requires every word and strips chat filler', () => {
  assert.deepEqual(tokenizePartnerTextSearch('Váy hoa nhí'), ['váy', 'hoa', 'nhí'])
  assert.deepEqual(tokenizePartnerTextSearch('Váy hoa nhí có không bạn'), ['váy', 'hoa', 'nhí'])
  assert.deepEqual(tokenizePartnerTextSearch('  '), [])
})

test('stripSearchChatFiller keeps product words in the middle', () => {
  assert.equal(stripSearchChatFiller('áo không tay'), 'áo không tay')
  assert.equal(stripSearchChatFiller('váy hoa nhí có không'), 'váy hoa nhí')
})

test('category match is L1 then deeper like 188 navigateProductTextSearch', () => {
  const cats = [
    { slug: 'vay', name: 'Váy', path: 'vay', depth: 1 },
    { slug: 'vay-hoa', name: 'Váy hoa', path: 'vay/vay-hoa', depth: 2 },
    { slug: 'giay', name: 'Giày', path: 'giay', depth: 1 },
  ]
  assert.equal(matchPartnerCategoryPathForSearch('váy', cats), 'vay')
  assert.equal(matchPartnerCategoryPathForSearch('Váy hoa', cats), 'vay/vay-hoa')
  assert.equal(matchPartnerCategoryPathForSearch('túi xách', cats), null)
})

test('188 generateSlug keeps hyphenated sale slugs', () => {
  assert.equal(generate188SearchSlug('kho sale'), 'kho-sale')
  assert.equal(generate188SearchSlug('Thanh lý kho'), 'thanh-ly-kho')
})
