import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildWeightedCategoryCycle,
  detectLeadingCategoryStreak,
  inferApparelGenderFromName,
  mixShopAndCohortProducts,
  nextSeededUint32,
  pickRoundRobinFromQueues,
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
