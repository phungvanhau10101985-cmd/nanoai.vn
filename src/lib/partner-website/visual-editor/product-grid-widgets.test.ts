import assert from 'node:assert/strict'
import test from 'node:test'
import { parseHTML } from 'linkedom'
import {
  buildVisualEditorProductGridHtml,
  isPdpOnlyProductGridKind,
  isPersonalizeProductGridKind,
  isVisualEditorProductGridKind,
  productGridKindAllowedOnVisualPage,
  productGridKindShownInAddPicker,
  productGridWidgetLabel,
} from '@/lib/partner-website/visual-editor/product-grid-widgets'
import {
  appendFeaturedMarqueeCloneHtml,
  ensureFeaturedCategoriesHostInHtml,
  restoreFeaturedCategorySeedsInDocument,
  stripFeaturedCategoryMarqueeClonesInDocument,
} from '@/lib/partner-website/visual-editor/featured-category-widgets'

test('recognizes product grid kinds', () => {
  assert.equal(isVisualEditorProductGridKind('catalog'), true)
  assert.equal(isVisualEditorProductGridKind('recently-viewed'), true)
  assert.equal(isVisualEditorProductGridKind('recommended'), true)
  assert.equal(isVisualEditorProductGridKind('featured-categories'), true)
  assert.equal(isVisualEditorProductGridKind('related'), true)
  assert.equal(isVisualEditorProductGridKind('outfit'), true)
  assert.equal(isVisualEditorProductGridKind('cart'), false)
})

test('related and outfit are PDP-only picker kinds; personalize stays on every page', () => {
  assert.equal(isPdpOnlyProductGridKind('related'), true)
  assert.equal(isPdpOnlyProductGridKind('outfit'), true)
  assert.equal(isPdpOnlyProductGridKind('catalog'), false)
  assert.equal(productGridKindAllowedOnVisualPage('related', 'product_detail'), true)
  assert.equal(productGridKindAllowedOnVisualPage('outfit', 'product_detail'), true)
  assert.equal(productGridKindAllowedOnVisualPage('related', 'home'), false)
  assert.equal(productGridKindAllowedOnVisualPage('outfit', 'products'), false)
  assert.equal(productGridKindAllowedOnVisualPage('catalog', 'home'), true)
  assert.equal(productGridKindAllowedOnVisualPage('recommended', 'collection'), true)
  assert.equal(isPersonalizeProductGridKind('recently-viewed'), true)
  assert.equal(isPersonalizeProductGridKind('recommended'), true)
  assert.equal(isPersonalizeProductGridKind('featured-categories'), true)
  assert.equal(isPersonalizeProductGridKind('related'), false)
  assert.equal(isPersonalizeProductGridKind('outfit'), false)
  assert.equal(isPersonalizeProductGridKind('catalog'), false)
  assert.equal(productGridKindShownInAddPicker('recently-viewed', 'home'), true)
  assert.equal(productGridKindShownInAddPicker('recommended', 'product_detail'), true)
  assert.equal(productGridKindShownInAddPicker('featured-categories', 'home'), true)
  assert.equal(productGridKindShownInAddPicker('catalog', 'home'), false)
  assert.equal(productGridKindShownInAddPicker('related', 'product_detail'), true)
  assert.equal(productGridKindShownInAddPicker('outfit', 'product_detail'), true)
  assert.equal(productGridKindShownInAddPicker('related', 'home'), false)
  assert.equal(productGridKindShownInAddPicker('outfit', 'home'), false)
})

test('stamps live catalog contract', () => {
  const html = buildVisualEditorProductGridHtml({ kind: 'catalog', siteSlug: 'demo-shop', locale: 'vi' })
  assert.match(html, /data-pw-region="catalog"/)
  assert.match(html, /data-pw-catalog/)
  assert.match(html, /data-pw-grid/)
  assert.match(html, /data-pw-grid-cols="5"/)
  assert.match(html, /data-pw-grid-cols-mobile="2"/)
  assert.match(html, /data-pw-grid-rows="1"/)
  assert.match(html, /data-pw-grid-more/)
  assert.match(html, /Xem thêm/)
  assert.match(html, /data-pw-el="section-more"/)
  assert.match(html, /Xem tất cả các nhóm/)
  assert.match(html, /data-pw-scene="2"/)
  assert.match(html, /data-pw-added-catalog="1"/)
  assert.doesNotMatch(html, /(?:^|[\s"'])pw-section(?:[\s"']|$)/)
  assert.match(html, /min-height:0/)
  assert.match(html, /padding:12px 16px 16px/)
})

test('chosen rows set page size for the device', () => {
  const desktop = buildVisualEditorProductGridHtml({
    kind: 'recommended',
    siteSlug: 'demo-shop',
    locale: 'vi',
    rows: 3,
    device: 'desktop',
  })
  const mobile = buildVisualEditorProductGridHtml({
    kind: 'recommended',
    siteSlug: 'demo-shop',
    locale: 'vi',
    rows: 3,
    device: 'mobile',
  })
  assert.match(desktop, /data-pw-grid-rows="3"/)
  assert.match(desktop, /data-limit="15"/)
  assert.match(mobile, /data-pw-grid-rows="3"/)
  assert.match(mobile, /data-limit="6"/)
})

test('stamps featured category tiles for personalization', () => {
  const html = buildVisualEditorProductGridHtml({
    kind: 'featured-categories',
    siteSlug: 'demo-shop',
    locale: 'vi',
  })
  assert.match(html, /data-pw-region="categories"/)
  assert.match(html, /data-pw-featured-categories="1"/)
  assert.match(html, /data-pw-grid-kind="featured-categories"/)
  assert.match(html, /data-pw-grid-rows="2"/)
  assert.match(html, /data-limit="16"/)
  assert.match(html, /data-pw-featured-viewport="1"/)
  assert.match(html, /data-pw-featured-marquee="1"/)
  assert.match(html, /data-pw-featured-clone="1"/)
  assert.match(html, /Xem tất cả danh mục/)
  assert.match(html, /pw-featured-cat-all-icon/)
  assert.match(html, /\/c"/)
  assert.doesNotMatch(html, /id="pw-featured-categories"/)
  assert.doesNotMatch(html, /data-pw-personalize/)
  assert.doesNotMatch(html, /data-pw-catalog(?:\s|>)/)
  assert.equal(productGridWidgetLabel('featured-categories', 'vi'), 'Danh mục nổi bật')
})

test('stamps seed pw-categories so live hydrates featured-categories', () => {
  const seed =
    '<section class="pw-section pw-categories" data-pw-region="categories"><div class="pw-cat-grid"><a class="pw-cat-card">Túi</a></div></section>'
  const next = ensureFeaturedCategoriesHostInHtml(seed)
  assert.match(next, /data-pw-featured-categories="1"/)
  assert.match(next, /data-pw-grid-kind="featured-categories"/)
  assert.match(next, /data-pw-grid/)
  assert.equal(ensureFeaturedCategoriesHostInHtml(next), next)
})

test('stamps fashion home categoryName slots as featured-categories', () => {
  const seed =
    '<section data-pw-region="categories"><span data-pw-edit="categoryName:0" data-pw-el="card-name">Thời trang</span></section>'
  const next = ensureFeaturedCategoriesHostInHtml(seed)
  assert.match(next, /data-pw-featured-categories="1"/)
})

test('append featured marquee clone duplicates the painted grid', () => {
  const inner = '<div data-pw-grid><a data-pw-el="card">A</a></div>'
  const next = appendFeaturedMarqueeCloneHtml(inner)
  assert.match(next, /data-pw-featured-clone="1"/)
  assert.equal((next.match(/data-pw-el="card"/g) || []).length, 2)
  const twice = appendFeaturedMarqueeCloneHtml(next)
  assert.equal((twice.match(/data-pw-featured-clone/g) || []).length, 1)
})

test('save strips featured marquee clones', () => {
  const { document } = parseHTML(
    '<section class="pw-featured-cat"><div data-pw-grid><a data-pw-el="card">A</a></div><div data-pw-featured-clone="1"><a data-pw-el="card">A</a></div></section>'
  )
  stripFeaturedCategoryMarqueeClonesInDocument(document)
  assert.equal(document.querySelector('[data-pw-featured-clone]'), null)
  assert.equal(document.querySelectorAll('[data-pw-el="card"]').length, 1)
})

test('restore featured seeds writes sample names back before save', () => {
  const { document } = parseHTML(
    '<section><a data-pw-el="card" data-pw-seed-name="Thời trang" data-pw-seed-href="/products" href="/c/giay"><span data-pw-edit="categoryName:0" data-pw-el="card-name">Giày dép</span></a></section>'
  )
  restoreFeaturedCategorySeedsInDocument(document)
  const name = document.querySelector('[data-pw-el="card-name"]')
  const card = document.querySelector('[data-pw-el="card"]')
  assert.equal(name?.textContent, 'Thời trang')
  assert.equal(card?.getAttribute('href'), '/products')
  assert.equal(card?.hasAttribute('data-pw-seed-name'), false)
})

test('stamps recently viewed and recommended personalize hooks', () => {
  const viewed = buildVisualEditorProductGridHtml({
    kind: 'recently-viewed',
    siteSlug: 'demo-shop',
    locale: 'vi',
  })
  const rec = buildVisualEditorProductGridHtml({ kind: 'recommended', siteSlug: 'demo-shop', locale: 'vi' })
  assert.match(viewed, /data-pw-personalize="recently-viewed"/)
  assert.match(viewed, /\/recently-viewed/)
  assert.match(viewed, /Xem tất cả các nhóm/)
  assert.match(rec, /data-pw-personalize="recommended"/)
  assert.match(rec, /\/products/)
  assert.match(rec, /CÓ THỂ BẠN THÍCH/)
  assert.equal(productGridWidgetLabel('recommended', 'vi'), 'Lưới đề xuất')
})

test('stamps related products strip', () => {
  const html = buildVisualEditorProductGridHtml({ kind: 'related', siteSlug: 'demo-shop', locale: 'vi' })
  assert.match(html, /data-pw-related="1"/)
  assert.match(html, /data-pw-scene="2"/)
  assert.match(html, /data-pw-grid-kind="related"/)
  assert.match(html, /Sản phẩm tương tự/)
  assert.match(html, /data-pw-related-more/)
  assert.match(html, /data-pw-grid-more/)
  assert.match(html, /data-pw-grid-rows="1"/)
  assert.match(html, /pw-related-all/)
  assert.match(html, /Xem tất cả các nhóm/)
  assert.equal(productGridWidgetLabel('related', 'vi'), 'Sản phẩm tương tự')
})

test('stamps outfit pairing strip', () => {
  const html = buildVisualEditorProductGridHtml({ kind: 'outfit', siteSlug: 'demo-shop', locale: 'vi' })
  assert.match(html, /data-pw-outfit="1"/)
  assert.match(html, /data-pw-scene="2"/)
  assert.match(html, /data-pw-grid-kind="outfit"/)
  assert.match(html, /Phối với món này/)
  assert.match(html, /Món khác loại để mặc cùng/)
  assert.match(html, /data-pw-outfit-slot="top"/)
  assert.match(html, /data-pw-outfit-more/)
  assert.match(html, /data-pw-grid-more/)
  assert.match(html, /data-pw-grid-rows="1"/)
  assert.match(html, /pw-outfit-all/)
  assert.match(html, /Xem tất cả các nhóm/)
  assert.equal(productGridWidgetLabel('outfit', 'vi'), 'Khối phối đồ')
})
