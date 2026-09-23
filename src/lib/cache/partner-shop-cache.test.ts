import assert from 'node:assert/strict'
import test from 'node:test'
import {
  HOST_RESOLVE_MISS_TTL_SEC,
  HOST_RESOLVE_TTL_SEC,
  LIVE_CATEGORY_BIND_TTL_SEC,
  MARKETING_BANNER_PUBLIC_TTL_SEC,
  MEM_CACHE_SHELL_MAX_BYTES,
  SITE_CHROME_TTL_SEC,
  SHOP_REDIS_BLOB_MAX_BYTES,
  VISITOR_MERGE_CLAIM_TTL_SEC,
  categoryProductCountsFromCacheRecord,
  categoryProductCountsToCacheRecord,
  claimShopCacheOnce,
  liveCategoryBindCacheSuffix,
  releaseShopCacheOnce,
  shopCacheGetJson,
  shopCacheRetainsProcessCopy,
  shopCacheSetJson,
  visitorMergeClaimCacheKey,
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
  assert.equal(SITE_CHROME_TTL_SEC, 1800)
})

test('liveCategoryBindCacheSuffix ignores tile limit so chrome and marquee share one load', () => {
  const eight = liveCategoryBindCacheSuffix({
    slug: '188-com-vn-rl56',
    accountKey: 'guest-1',
    locale: 'vi',
    limit: 8,
  })
  const twenty = liveCategoryBindCacheSuffix({
    slug: '188-com-vn-rl56',
    accountKey: 'guest-1',
    locale: 'vi',
    limit: 20,
  })
  assert.equal(eight, twenty)
  const navOnly = liveCategoryBindCacheSuffix({
    slug: '188-com-vn-rl56',
    accountKey: 'guest-1',
    locale: 'vi',
    navOnly: true,
  })
  assert.notEqual(eight, navOnly)
})

test('shopCacheGetJson hits in-process memory when Redis is absent', async () => {
  const key = `pw:test:mem:${Date.now()}`
  await shopCacheSetJson(key, 60, { ok: 1, slug: 'demo' })
  const hit = await shopCacheGetJson<{ ok: number; slug: string }>(key)
  assert.deepEqual(hit, { ok: 1, slug: 'demo' })
})

test('shopCacheGetJson uses the TTL passed to set, not a 60s clamp', async () => {
  const key = `pw:test:ttl:${Date.now()}`
  await shopCacheSetJson(key, 900, { ttl: 900 })
  const hit = await shopCacheGetJson<{ ttl: number }>(key, 900)
  assert.deepEqual(hit, { ttl: 900 })
})

test('shopCacheSetJson keeps a shell under 512KB in process memory and skips Redis for blobs over 200KB', async () => {
  const stamp = Date.now()
  const fat = 'x'.repeat(SHOP_REDIS_BLOB_MAX_BYTES + 50)
  const htmlKey = `pw:site:demo:v1:html:home:desktop:${stamp}`
  const chromeKey = `pw:site:demo:v1:chrome3:desktop:${stamp}`
  const slimKey = `pw:site:demo:v1:chrome3:mobile:${stamp}`
  const hugeKey = `pw:site:demo:v1:html:home:laptop:${stamp}`
  await shopCacheSetJson(htmlKey, 60, fat)
  await shopCacheSetJson(chromeKey, 60, fat)
  await shopCacheSetJson(slimKey, 60, { ok: 1 })
  await shopCacheSetJson(hugeKey, 60, 'y'.repeat(MEM_CACHE_SHELL_MAX_BYTES + 8))
  assert.equal(await shopCacheGetJson<string>(htmlKey), fat)
  assert.equal(await shopCacheGetJson<string>(chromeKey), fat)
  assert.equal(await shopCacheGetJson<string>(hugeKey), null)
  assert.deepEqual(await shopCacheGetJson<{ ok: number }>(slimKey), { ok: 1 })
  assert.equal(SHOP_REDIS_BLOB_MAX_BYTES, 200 * 1024)
  assert.equal(shopCacheRetainsProcessCopy('pw:inv:p:v1:ids:shop:abc', 180 * 1024, true), false)
  assert.equal(shopCacheRetainsProcessCopy('pw:site:demo:v1:html:home:desktop', 180 * 1024, true), true)
  assert.equal(shopCacheRetainsProcessCopy('pw:inv:p:v1:ids:shop:abc', 180 * 1024, false), true)
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

test('category product counts serialize without Map', () => {
  const m = new Map<string, number>([
    ['a', 3],
    ['b', 0],
    ['c', 12],
  ])
  const rec = categoryProductCountsToCacheRecord(m)
  assert.deepEqual(rec, { a: 3, c: 12 })
  const back = categoryProductCountsFromCacheRecord(rec)
  assert.ok(back)
  assert.equal(back.get('a'), 3)
  assert.equal(back.get('c'), 12)
  assert.equal(back.has('b'), false)
  assert.equal(categoryProductCountsFromCacheRecord(null), null)
})

test('claimShopCacheOnce is sticky in-process until released', async () => {
  const key = `pw:test:claim:${Date.now()}-${Math.random()}`
  assert.equal(await claimShopCacheOnce(key, 60), true)
  assert.equal(await claimShopCacheOnce(key, 60), false)
  await releaseShopCacheOnce(key)
  assert.equal(await claimShopCacheOnce(key, 60), true)
})

test('visitor merge claim key is per partner and pair', () => {
  const a = visitorMergeClaimCacheKey({
    partnerId: 'p1',
    fromAccountKey: 'sess',
    toAccountKey: 'acct',
  })
  const b = visitorMergeClaimCacheKey({
    partnerId: 'p1',
    fromAccountKey: 'sess',
    toAccountKey: 'other',
  })
  assert.match(a, /^pw:merge:p1:sess:acct$/)
  assert.notEqual(a, b)
  assert.equal(HOST_RESOLVE_TTL_SEC, 300)
  assert.equal(HOST_RESOLVE_MISS_TTL_SEC, 15)
  assert.equal(MARKETING_BANNER_PUBLIC_TTL_SEC, 60)
  assert.equal(VISITOR_MERGE_CLAIM_TTL_SEC, 86400)
})

