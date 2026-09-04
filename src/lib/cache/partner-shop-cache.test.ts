import assert from 'node:assert/strict'
import test from 'node:test'
import {
  LIVE_CATEGORY_BIND_TTL_SEC,
  liveCategoryBindCacheSuffix,
} from '@/lib/cache/partner-shop-cache'

test('liveCategoryBindCacheSuffix is per visitor, not per product', () => {
  const a = liveCategoryBindCacheSuffix({
    slug: '188-com-vn-rl56',
    accountKey: 'guest-1',
    linkedUserId: null,
    locale: 'vi',
  })
  const again = liveCategoryBindCacheSuffix({
    slug: '188-com-vn-rl56',
    accountKey: 'guest-1',
    locale: 'vi',
  })
  const otherGuest = liveCategoryBindCacheSuffix({
    slug: '188-com-vn-rl56',
    accountKey: 'guest-2',
    locale: 'vi',
  })
  assert.equal(a, again)
  assert.notEqual(a, otherGuest)
  assert.match(a, /^bind:[0-9a-f]{16}$/)
  assert.equal(LIVE_CATEGORY_BIND_TTL_SEC, 45)
})
