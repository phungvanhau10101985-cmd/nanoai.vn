import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildVisualEditorProductGridHtml,
  isVisualEditorProductGridKind,
  productGridWidgetLabel,
} from '@/lib/partner-website/visual-editor/product-grid-widgets'

test('recognizes product grid kinds', () => {
  assert.equal(isVisualEditorProductGridKind('catalog'), true)
  assert.equal(isVisualEditorProductGridKind('recently-viewed'), true)
  assert.equal(isVisualEditorProductGridKind('recommended'), true)
  assert.equal(isVisualEditorProductGridKind('cart'), false)
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
