import assert from 'node:assert/strict'
import test from 'node:test'
import type { LiveCategoryBind } from '@/lib/partner-website/shop/bind-live-nav-pills'
import { applyLiveVisualOverlays } from '@/lib/partner-website/shop/compose-live-visual-overlays'
import type { PartnerMarketingBannerPublicItem } from '@/lib/partner-website/promotions/partner-marketing-banner'

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
<section data-pw-personalize-banner="promo">
  <div data-pw-slides><img data-pw-el="media" alt="seed"/><h1 data-pw-el="title">Bộ sưu tập mới</h1></div>
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

const banners: PartnerMarketingBannerPublicItem[] = [
  {
    id: 'sale-1',
    kind: 'sale',
    campaign_key: 'sale-09-09-p6',
    date_key: '09-09',
    discount_percent: 6,
    image_url: 'https://cdn.example/sale.png',
    aspect_ratio: '21:9',
    event_date: '2026-09-09',
    greeting: null,
    version: 1,
    href: '/site/demo-shop/products',
  },
]

test('applyLiveVisualOverlays binds product then keeps live pills and featured tiles', () => {
  const out = applyLiveVisualOverlays(SHELL, {
    liveProduct: { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', name: 'New shirt' },
    liveCategoryBind: bind,
    liveMarketingBanners: banners,
    locale: 'vi',
    siteSlug: 'demo-shop',
  })
  assert.match(out, /New shirt/)
  assert.doesNotMatch(out, /Old bag/)
  assert.match(out, /Đầm/)
  assert.match(out, /Đầm maxi/)
  assert.doesNotMatch(out, /Thời trang/)
  assert.doesNotMatch(out, /Áo sơ mi/)
  assert.doesNotMatch(out, /data-pw-personalize-banner/)
  assert.doesNotMatch(out, /https:\/\/cdn\.example\/sale\.png/)
  assert.doesNotMatch(out, /Bộ sưu tập mới/)
})

test('applyLiveVisualOverlays without product still paints visitor pills', () => {
  const out = applyLiveVisualOverlays(SHELL, {
    liveCategoryBind: bind,
    liveMarketingBanners: banners,
    locale: 'vi',
    siteSlug: 'demo-shop',
  })
  assert.match(out, /Old bag/)
  assert.match(out, /Đầm/)
  assert.doesNotMatch(out, /Thời trang/)
  assert.doesNotMatch(out, /data-pw-personalize-banner/)
  assert.doesNotMatch(out, /https:\/\/cdn\.example\/sale\.png/)
})

test('applyLiveVisualOverlays paints the 21:9 promo slider on home', () => {
  const home = SHELL.replace('data-pw-page="product"', 'data-pw-page="home"')
  const out = applyLiveVisualOverlays(home, {
    liveCategoryBind: bind,
    liveMarketingBanners: banners,
    locale: 'vi',
    siteSlug: 'demo-shop',
  })
  assert.match(out, /https:\/\/cdn\.example\/sale\.png/)
  assert.match(out, /data-pw-banner-live="1"/)
  assert.doesNotMatch(out, /Bộ sưu tập mới/)
})
