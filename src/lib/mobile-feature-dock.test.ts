import assert from 'node:assert/strict'
import test from 'node:test'
import {
  activeMobileFeatureHref,
  buildMobileFeatureDock,
  resolveCatalogFeature,
} from '@/lib/mobile-feature-dock'

test('banner page leads with the open feature, then recent, then siblings', () => {
  const items = buildMobileFeatureDock('/tao-banner', ['/lam-dep-anh', '/tao-banner'])
  assert.equal(items[0]?.href, '/tao-banner')
  assert.equal(items[0]?.kind, 'current')
  assert.equal(items[1]?.href, '/lam-dep-anh')
  assert.equal(items[1]?.kind, 'recent')
  assert.equal(items.filter((item) => item.href === '/tao-banner').length, 1)
  assert.ok(items.some((item) => item.href === '/tao-anh-tu-chu' && item.kind === 'related'))
  assert.equal(items.some((item) => item.href === '/tao-anh-tu-chu' && item.kind === 'recent'), false)
})

test('class detail resolves to the classes feature', () => {
  assert.equal(resolveCatalogFeature('/lop/abc')?.href, '/lop')
  const items = buildMobileFeatureDock('/lop/abc', [])
  assert.equal(items[0]?.href, '/lop')
  assert.equal(activeMobileFeatureHref('/lop/abc', items), '/lop')
  assert.ok(items.some((item) => item.href === '/giao-trinh' && item.kind === 'related'))
})

test('home with no history falls back to popular tools', () => {
  const items = buildMobileFeatureDock('/', [])
  assert.equal(items[0]?.href, '/thu-do-online')
  assert.ok(items.every((item) => item.kind === 'popular'))
  assert.equal(activeMobileFeatureHref('/', items), null)
})
