import assert from 'node:assert/strict'
import test from 'node:test'
import {
  bindLiveCategorySurfacesInHtml,
  bindLiveNavPillsToHtml,
  buildLiveNavRowInnerHtml,
  PW_FEATURED_LIVE_ATTR,
  PW_NAV_LIVE_ATTR,
} from '@/lib/partner-website/shop/bind-live-nav-pills'
import type { LiveCategoryBind } from '@/lib/partner-website/shop/bind-live-nav-pills'

const bind: LiveCategoryBind = {
  siteSlug: 'demo-shop',
  locale: 'vi',
  navRow: [
    { id: 'dam', name: 'Đầm', href: '/site/demo-shop/c/dam', children: [] },
    { id: 'tui', name: 'Túi đeo chéo', href: '/site/demo-shop/c/tui', children: [] },
  ],
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

test('buildLiveNavRowInnerHtml paints API pills not seed clothing/bags', () => {
  const html = buildLiveNavRowInnerHtml({
    row: bind.navRow,
    locale: 'vi',
    siteSlug: bind.siteSlug,
  })
  assert.match(html, /Đầm/)
  assert.match(html, /Túi đeo chéo/)
  assert.match(html, /\/site\/demo-shop\/c\/dam/)
  assert.doesNotMatch(html, /Thời trang/)
  assert.doesNotMatch(html, /Túi xách/)
})

test('bindLiveNavPillsToHtml replaces seed nav and stamps live', () => {
  const source = `<header class="pw-header"><nav class="pw-nav-main" data-pw-personalize-nav="recent-categories">
    <a href="/products">Hàng mới</a><a href="/products">Thời trang</a>
  </nav></header>`
  const out = bindLiveNavPillsToHtml(source, bind)
  assert.match(out, new RegExp(`${PW_NAV_LIVE_ATTR}="1"`))
  assert.match(out, /Đầm/)
  assert.match(out, /Túi đeo chéo/)
  assert.doesNotMatch(out, /Thời trang/)
})

test('bindLiveCategorySurfacesInHtml paints featured tiles and stamps live', () => {
  const source = `<section data-pw-featured-categories="1">
    <div data-pw-grid>
      <a class="pw-featured-cat-card" data-pw-el="card" href="#"><span data-pw-el="card-media"></span><span data-pw-el="card-name">Áo sơ mi</span></a>
      <a class="pw-featured-cat-card" data-pw-el="card" href="#"><span data-pw-el="card-name">Giày tây</span></a>
    </div>
    <a data-pw-el="section-more" href="#">Xem tất cả</a>
  </section>`
  const out = bindLiveCategorySurfacesInHtml(source, bind)
  assert.match(out, new RegExp(`${PW_FEATURED_LIVE_ATTR}="1"`))
  assert.match(out, /Đầm maxi/)
  assert.match(out, /cdn\.example\/dam\.jpg/)
  assert.match(out, /hidden/)
  assert.match(out, /href="\/site\/demo-shop\/c"/)
})
