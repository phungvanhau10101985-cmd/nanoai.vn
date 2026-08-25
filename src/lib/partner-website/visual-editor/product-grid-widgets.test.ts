import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildVisualEditorProductGridHtml,
  isPdpOnlyProductGridKind,
  isVisualEditorProductGridKind,
  productGridKindAllowedOnVisualPage,
  productGridWidgetLabel,
} from '@/lib/partner-website/visual-editor/product-grid-widgets'

test('recognizes product grid kinds', () => {
  assert.equal(isVisualEditorProductGridKind('catalog'), true)
  assert.equal(isVisualEditorProductGridKind('recently-viewed'), true)
  assert.equal(isVisualEditorProductGridKind('recommended'), true)
  assert.equal(isVisualEditorProductGridKind('related'), true)
  assert.equal(isVisualEditorProductGridKind('outfit'), true)
  assert.equal(isVisualEditorProductGridKind('cart'), false)
})

test('related and outfit are PDP-only add kinds', () => {
  assert.equal(isPdpOnlyProductGridKind('related'), true)
  assert.equal(isPdpOnlyProductGridKind('outfit'), true)
  assert.equal(isPdpOnlyProductGridKind('catalog'), false)
  assert.equal(productGridKindAllowedOnVisualPage('related', 'product_detail'), true)
  assert.equal(productGridKindAllowedOnVisualPage('outfit', 'product_detail'), true)
  assert.equal(productGridKindAllowedOnVisualPage('related', 'home'), false)
  assert.equal(productGridKindAllowedOnVisualPage('outfit', 'products'), false)
  assert.equal(productGridKindAllowedOnVisualPage('catalog', 'home'), true)
  assert.equal(productGridKindAllowedOnVisualPage('recommended', 'collection'), true)
})

test('stamps live catalog contract', () => {
  const html = buildVisualEditorProductGridHtml({ kind: 'catalog', siteSlug: 'demo-shop', locale: 'vi' })
  assert.match(html, /data-pw-region="catalog"/)
  assert.match(html, /data-pw-catalog/)
  assert.match(html, /data-pw-grid/)
  assert.match(html, /data-pw-grid-cols="5"/)
  assert.match(html, /data-pw-grid-cols-mobile="2"/)
})

test('stamps recently viewed and recommended personalize hooks', () => {
  const viewed = buildVisualEditorProductGridHtml({
    kind: 'recently-viewed',
    siteSlug: 'demo-shop',
    locale: 'vi',
  })
  const rec = buildVisualEditorProductGridHtml({ kind: 'recommended', siteSlug: 'demo-shop', locale: 'vi' })
  assert.match(viewed, /data-pw-personalize="recently-viewed"/)
  assert.match(rec, /data-pw-personalize="recommended"/)
  assert.match(rec, /CÓ THỂ BẠN THÍCH/)
  assert.equal(productGridWidgetLabel('recommended', 'vi'), 'Lưới đề xuất')
})

test('stamps related products strip', () => {
  const html = buildVisualEditorProductGridHtml({ kind: 'related', siteSlug: 'demo-shop', locale: 'vi' })
  assert.match(html, /data-pw-related="1"/)
  assert.match(html, /data-pw-grid-kind="related"/)
  assert.match(html, /Sản phẩm tương tự/)
  assert.match(html, /data-pw-related-more/)
  assert.equal(productGridWidgetLabel('related', 'vi'), 'Sản phẩm tương tự')
})

test('stamps outfit pairing strip', () => {
  const html = buildVisualEditorProductGridHtml({ kind: 'outfit', siteSlug: 'demo-shop', locale: 'vi' })
  assert.match(html, /data-pw-outfit="1"/)
  assert.match(html, /data-pw-grid-kind="outfit"/)
  assert.match(html, /Phối với món này/)
  assert.match(html, /Món khác loại để mặc cùng/)
  assert.match(html, /data-pw-outfit-slot="top"/)
  assert.match(html, /data-pw-outfit-more/)
  assert.equal(productGridWidgetLabel('outfit', 'vi'), 'Phối đồ')
})
