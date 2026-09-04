import assert from 'node:assert/strict'
import test from 'node:test'
import type { LiveCategoryBind } from '@/lib/partner-website/shop/bind-live-nav-pills'
import { applyLiveVisualOverlays } from '@/lib/partner-website/shop/compose-live-visual-overlays'

const SHELL = `<!DOCTYPE html><html><body data-pw-page="product">
<header><nav class="pw-nav-main" data-pw-personalize-nav="recent-categories">
  <a href="/products">Thời trang</a>
</nav></header>
<div data-pw-region="pdp-info">
  <h1 data-pw-el="title">Old bag</h1>
</div>
<section data-pw-featured-categories="1">
  <div data-pw-grid>
    <a data-pw-el="card" href="#"><span data-pw-el="card-name">Áo sơ mi</span></a>
  </div>
</section>
</body></html>`

const bind: LiveCategoryBind = {
  siteSlug: 'demo-shop',
  locale: 'vi',
  navRow: [{ id: 'dam', name: 'Đầm', href: '/site/demo-shop/c/dam', children: [] }],
  showNavAll: false,
  tiles: [
    {
      id: 'dam',
      name: 'Đầm maxi',
      short_name: 'Đầm maxi',
      path: 'dam',
      href: '/site/demo-shop/c/dam',
      image_url: 'https://cdn.example/dam.jpg',
      product_count: 4,
      level: 3,
    },
  ],
  hubHref: '/site/demo-shop/c',
}

test('applyLiveVisualOverlays binds product then keeps live pills and featured tiles', () => {
  const out = applyLiveVisualOverlays(SHELL, {
    liveProduct: { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', name: 'New shirt' },
    liveCategoryBind: bind,
    locale: 'vi',
    siteSlug: 'demo-shop',
  })
  assert.match(out, /New shirt/)
  assert.doesNotMatch(out, /Old bag/)
  assert.match(out, /Đầm/)
  assert.match(out, /Đầm maxi/)
  assert.doesNotMatch(out, /Thời trang/)
  assert.doesNotMatch(out, /Áo sơ mi/)
})

test('applyLiveVisualOverlays without product still paints visitor pills', () => {
  const out = applyLiveVisualOverlays(SHELL, {
    liveCategoryBind: bind,
    locale: 'vi',
    siteSlug: 'demo-shop',
  })
  assert.match(out, /Old bag/)
  assert.match(out, /Đầm/)
  assert.doesNotMatch(out, /Thời trang/)
})
