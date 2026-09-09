import assert from 'node:assert/strict'
import test from 'node:test'
import { bindLiveCategoryListingToHtml } from '@/lib/partner-website/shop/bind-live-category-listing-to-html'

const SHELL = `<!DOCTYPE html><html><head><title>Bộ sưu tập</title></head>
<body data-pw-page="listing">
<header class="pw-header" data-pw-region="header"><h1>Shop</h1></header>
<main>
<nav class="pw-page-crumbs" data-pw-region="breadcrumb"><a data-pw-el="crumb">Trang chủ</a><span>/</span><span data-pw-el="crumb">Bộ sưu tập</span></nav>
<header class="pw-page-head">
  <h1 data-pw-el="heading">Bộ sưu tập</h1>
  <p class="pw-muted" data-pw-el="body">Lưới sản phẩm theo nhóm</p>
</header>
<section data-pw-region="catalog" data-pw-catalog data-sort="default">
  <h2 class="pw-visually-hidden" data-pw-el="section-title">Bộ sưu tập</h2>
  <div data-pw-grid class="pw-product-grid"></div>
</section>
</main>
</body></html>`

const LISTING = {
  id: '11111111-1111-4111-8111-111111111111',
  path: 'thoi-trang-nu/ao-blouse',
  name: 'áo blouse nữ đi làm thanh lịch',
  description: 'Áo blouse công sở',
  seoBody: 'Đoạn SEO danh mục.',
  ancestors: [{ path: 'thoi-trang-nu', name: 'Thời trang Nữ' }],
}

test('bindLiveCategoryListingToHtml paints title breadcrumb and categoryId', () => {
  const next = bindLiveCategoryListingToHtml(SHELL, LISTING, { locale: 'vi', siteSlug: 'demo-shop' })
  assert.match(next, /<title>áo blouse nữ đi làm thanh lịch<\/title>/)
  assert.match(next, /<h1 data-pw-el="heading">áo blouse nữ đi làm thanh lịch<\/h1>/)
  assert.match(next, /Thời trang Nữ/)
  assert.match(next, /data-category-id="11111111-1111-4111-8111-111111111111"/)
  assert.match(next, /data-pw-listing-href="\/site\/demo-shop\/c\/thoi-trang-nu\/ao-blouse"/)
  assert.match(next, /Áo blouse công sở/)
  assert.match(next, /data-pw-listing-seo="1"/)
  assert.match(next, /Đoạn SEO danh mục/)
})

test('bindLiveCategoryListingToHtml is a no-op without listing id', () => {
  assert.equal(bindLiveCategoryListingToHtml(SHELL, { id: '', path: 'ao', name: 'Áo' }), SHELL)
})
