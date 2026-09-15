import assert from 'node:assert/strict'
import test from 'node:test'
import { looksLikeHttpUrl } from '@/lib/partner-website/shop/partner-site-image-search-errors'
import { toFetchableImageUrl } from '@/lib/partner-website/shop/partner-site-image-from-url'

test('toFetchableImageUrl keeps http(s) and resolves relative shop URLs', () => {
  assert.equal(toFetchableImageUrl('https://cdn.example/a.jpg'), 'https://cdn.example/a.jpg')
  assert.equal(
    toFetchableImageUrl('/uploads/sp.jpg', 'https://shop.test'),
    'https://shop.test/uploads/sp.jpg'
  )
  assert.equal(toFetchableImageUrl(''), '')
  assert.equal(looksLikeHttpUrl(toFetchableImageUrl('/x.jpg', 'https://a.test')), true)
})
