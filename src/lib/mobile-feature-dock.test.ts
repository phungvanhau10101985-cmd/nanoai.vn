import assert from 'node:assert/strict'
import test from 'node:test'
import { CREATION_SIDEBAR_POPULAR_LINKS } from '@/lib/creation-tool-sidebar-config'
import {
  activeMobileFeatureHref,
  buildMobileFeatureDock,
  buildMobileFeatureGrid,
  dockHomeScrollLeft,
  resolveCatalogFeature,
  type MobileFeatureDockItem,
} from '@/lib/mobile-feature-dock'

function focusBlock(items: readonly MobileFeatureDockItem[]) {
  const start = items.findIndex((item) => item.kind !== 'catalog')
  const end = items.findLastIndex((item) => item.kind !== 'catalog')
  return { start, end, focus: items.slice(start, end + 1) }
}

test('banner page keeps related, the open feature, then recent in the middle of the catalog', () => {
  const items = buildMobileFeatureDock('/tao-banner', ['/lam-dep-anh', '/tao-banner'])
  const { start, end, focus } = focusBlock(items)
  assert.ok(start > 0)
  assert.ok(end < items.length - 1)
  assert.equal(focus[0]?.kind, 'related')
  assert.equal(focus.find((item) => item.href === '/tao-banner')?.kind, 'current')
  assert.equal(focus.find((item) => item.href === '/lam-dep-anh')?.kind, 'recent')
  assert.equal(focus.find((item) => item.href === '/tao-anh-tu-chu')?.kind, 'related')
  assert.equal(items.filter((item) => item.href === '/tao-banner').length, 1)
  const currentAt = focus.findIndex((item) => item.kind === 'current')
  const recentAt = focus.findIndex((item) => item.href === '/lam-dep-anh')
  assert.ok(currentAt > focus.findIndex((item) => item.kind === 'related'))
  assert.ok(recentAt > currentAt)
  assert.equal(new Set(items.map((item) => item.href)).size, items.length)
  assert.ok(items.length > 40)
})

test('class detail resolves to the classes feature inside the middle block', () => {
  assert.equal(resolveCatalogFeature('/lop/abc')?.href, '/lop')
  const items = buildMobileFeatureDock('/lop/abc', [])
  const { focus } = focusBlock(items)
  assert.equal(focus.find((item) => item.kind === 'current')?.href, '/lop')
  assert.equal(activeMobileFeatureHref('/lop/abc', items), '/lop')
  assert.ok(focus.some((item) => item.href === '/giao-trinh' && item.kind === 'related'))
  assert.ok(focus.findIndex((item) => item.kind === 'current') > focus.findIndex((item) => item.kind === 'related'))
})

test('tutor page shows related features before the open feature and other recent features', () => {
  const items = buildMobileFeatureDock('/gia-su-ai', ['/gia-su-ai', '/tao-thiep-moi-cuoi-ai'])
  const { start, end, focus } = focusBlock(items)
  assert.deepEqual(
    focus.map((item) => item.href),
    ['/account/plan', '/ho-tro-lam-bai', '/lop', '/gia-su-ai', '/tao-thiep-moi-cuoi-ai']
  )
  assert.deepEqual(
    focus.map((item) => item.kind),
    ['related', 'related', 'related', 'current', 'recent']
  )
  assert.ok(start > 0 && end < items.length - 1)
})

test('home with no history centers popular tools inside the full catalog', () => {
  const items = buildMobileFeatureDock('/', [])
  const { start, end, focus } = focusBlock(items)
  assert.equal(focus[0]?.href, '/thu-do-online')
  assert.ok(focus.every((item) => item.kind === 'popular'))
  assert.equal(focus.length, CREATION_SIDEBAR_POPULAR_LINKS.length)
  assert.ok(start > 0 && end < items.length - 1)
  assert.equal(activeMobileFeatureHref('/', items), null)
})

test('feature grid puts recent then related above the rest of the catalog', () => {
  const { lead, rest } = buildMobileFeatureGrid('/gia-su-ai', ['/gia-su-ai', '/tao-thiep-moi-cuoi-ai'])
  assert.deepEqual(
    lead.map((item) => item.href),
    ['/tao-thiep-moi-cuoi-ai', '/account/plan', '/ho-tro-lam-bai', '/lop', '/gia-su-ai']
  )
  assert.deepEqual(
    lead.map((item) => item.kind),
    ['recent', 'related', 'related', 'related', 'current']
  )
  assert.ok(rest.length > 20)
  assert.ok(rest.every((item) => item.kind === 'catalog'))
  assert.equal(rest.some((item) => item.href === '/gia-su-ai'), false)
  assert.equal(rest[0]?.href, '/thu-do-online')
})

test('home scroll centers a short cluster and the related/recent seam when it overflows', () => {
  assert.equal(
    dockHomeScrollLeft({ clusterLeft: 100, clusterWidth: 80, seamLeft: 140, viewport: 200, maxScroll: 500 }),
    40
  )
  assert.equal(
    dockHomeScrollLeft({ clusterLeft: 100, clusterWidth: 240, seamLeft: 180, viewport: 200, maxScroll: 500 }),
    120
  )
  assert.equal(
    dockHomeScrollLeft({ clusterLeft: 400, clusterWidth: 800, seamLeft: 600, viewport: 200, maxScroll: 1200 }),
    500
  )
  assert.equal(
    dockHomeScrollLeft({ clusterLeft: 0, clusterWidth: 800, seamLeft: null, viewport: 200, maxScroll: 600 }),
    0
  )
  assert.equal(
    dockHomeScrollLeft({ clusterLeft: 10, clusterWidth: 40, seamLeft: null, viewport: 200, maxScroll: 0 }),
    0
  )
  assert.equal(
    dockHomeScrollLeft({ clusterLeft: 1000, clusterWidth: 900, seamLeft: 1500, viewport: 100, maxScroll: 200 }),
    200
  )
})
