import assert from 'node:assert/strict'
import test from 'node:test'
import {
  allowedShopL3PairsFromRecent,
  appendNewShopProductsToMix,
  buildWeightedCategoryCycle,
  detectLeadingCategoryStreak,
  inferApparelGenderFromName,
  mixShopAndCohortProducts,
  nextSeededUint32,
  pickRoundRobinFromQueues,
  shopL3PairKey,
} from '@/lib/partner-website/shop/partner-site-home-recommendation-mix'

test('mixes cohort into shop with seeded LCG like 188', () => {
  const shop = [{ inventoryId: 'a' }, { inventoryId: 'b' }]
  const cohort = [{ inventoryId: 'c' }, { inventoryId: 'a' }]
  const mixed = mixShopAndCohortProducts(shop, cohort, 1)
  assert.ok(mixed.some((p) => p.inventoryId === 'c'))
  assert.equal(mixed.filter((p) => p.inventoryId === 'a').length, 1)
})

test('detects a leading category streak', () => {
  const streak = detectLeadingCategoryStreak(['bags', 'bags', 'bags', 'shoes'])
  assert.equal(streak.key, 'bags')
  assert.equal(streak.length, 3)
})

test('weights streak shop 5/8 when last 8 views share a category', () => {
  const keys = Array(8).fill('bags').concat(['shoes', 'hats'])
  const { cycle, maxPerOverrides } = buildWeightedCategoryCycle(
    keys,
    keys.slice(0, 8),
    new Set(['bags', 'shoes', 'hats'])
  )
  assert.equal(cycle.filter((k) => k === 'bags').length, 5)
  assert.equal(maxPerOverrides.bags, 14)
})

test('round-robins queues with a per-shop cap', () => {
  const queues = new Map([
    ['bags', ['b1', 'b2', 'b3']],
    ['shoes', ['s1', 's2']],
  ])
  const page = pickRoundRobinFromQueues({
    queues,
    cycle: ['bags', 'shoes'],
    pageSize: 4,
    maxPer: 8,
  })
  assert.deepEqual(page, ['b1', 's1', 'b2', 's2'])
})

test('infers apparel gender from category names', () => {
  assert.equal(inferApparelGenderFromName('Áo nam'), 'male')
  assert.equal(inferApparelGenderFromName('Túi nữ'), 'female')
  assert.equal(inferApparelGenderFromName('Phụ kiện'), null)
})

test('keeps LCG stable', () => {
  assert.equal(nextSeededUint32(1), ((1 * 1664525 + 1013904223) >>> 0))
})

test('same-shop pair requires Chinese shop and L3', () => {
  assert.equal(shopL3PairKey('Shop A', 'Túi mini'), 'shop a\ttúi mini')
  assert.equal(shopL3PairKey('', 'Túi mini'), null)
  assert.equal(shopL3PairKey('Shop A', ''), null)
})

test('allowed pairs come only from recent views and drop same shop different L3', () => {
  const allowed = allowedShopL3PairsFromRecent([
    { shop: 'Shop A', l3: 'Túi mini' },
    { shop: 'Shop A', l3: 'Túi mini' },
    { shop: 'Shop B', l3: 'Giày sneaker' },
    { shop: 'Shop A', l3: '' },
  ])
  assert.equal(allowed.size, 2)
  assert.ok(allowed.has('shop a\ttúi mini'))
  assert.ok(allowed.has('shop b\tgiày sneaker'))
  assert.equal(allowed.has('shop a\tgiày sneaker'), false)
})

test('round-robin offset skips the first page then continues the cycle', () => {
  const queues = new Map([
    ['bags', ['b1', 'b2', 'b3']],
    ['shoes', ['s1', 's2']],
  ])
  const page = pickRoundRobinFromQueues({
    queues,
    cycle: ['bags', 'shoes'],
    pageSize: 2,
    maxPer: 8,
    offset: 2,
  })
  assert.deepEqual(page, ['b2', 's2'])
})

test('appendNewShopProductsToMix only adds unseen shop items', () => {
  const current = [{ inventoryId: 'a' }, { inventoryId: 'c' }]
  const next = appendNewShopProductsToMix(current, [{ inventoryId: 'a' }, { inventoryId: 'd' }])
  assert.deepEqual(
    next.map((p) => p.inventoryId),
    ['a', 'c', 'd']
  )
})
