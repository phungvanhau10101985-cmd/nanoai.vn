import assert from 'node:assert/strict'
import test from 'node:test'
import {
  LIVE_CATEGORY_BIND_TTL_SEC,
  liveCategoryBindCacheSuffix,
  shopCacheGetJson,
  shopCacheSetJson,
  withInventoryShopCache,
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

test('liveCategoryBindCacheSuffix includes tile limit', () => {
  const eight = liveCategoryBindCacheSuffix({
    slug: '188-com-vn-rl56',
    accountKey: 'guest-1',
    locale: 'vi',
    limit: 8,
  })
  const ten = liveCategoryBindCacheSuffix({
    slug: '188-com-vn-rl56',
    accountKey: 'guest-1',
    locale: 'vi',
    limit: 10,
  })
  assert.notEqual(eight, ten)
})

test('shopCacheGetJson hits in-process memory when Redis is absent', async () => {
  const key = `pw:test:mem:${Date.now()}`
  await shopCacheSetJson(key, 60, { ok: 1, slug: 'demo' })
  const hit = await shopCacheGetJson<{ ok: number; slug: string }>(key)
  assert.deepEqual(hit, { ok: 1, slug: 'demo' })
})

test('concurrent cold cache requests share one backend load', async () => {
  const partnerId = `test-${Date.now()}-${Math.random()}`
  let loads = 0
  const run = () =>
    withInventoryShopCache({
      partnerId,
      kind: 'cat',
      suffix: 'single-flight',
      ttlSec: 60,
      load: async () => {
        loads += 1
        await new Promise((resolve) => setTimeout(resolve, 20))
        return { ok: true }
      },
    })

  const results = await Promise.all([run(), run(), run(), run()])
  assert.equal(loads, 1)
  assert.deepEqual(results, Array.from({ length: 4 }, () => ({ ok: true })))
})

test('failed shared load is cleared so a later request can retry', async () => {
  const partnerId = `test-retry-${Date.now()}-${Math.random()}`
  let loads = 0
  const run = () =>
    withInventoryShopCache({
      partnerId,
      kind: 'item',
      suffix: 'single-flight-retry',
      ttlSec: 60,
      load: async () => {
        loads += 1
        if (loads === 1) throw new Error('temporary')
        return { ok: true }
      },
    })

  await assert.rejects(() => Promise.all([run(), run()]), /temporary/)
  assert.deepEqual(await run(), { ok: true })
  assert.equal(loads, 2)
})

