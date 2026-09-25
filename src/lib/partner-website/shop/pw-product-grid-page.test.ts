import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clampProductGridRows,
  inferProductGridRows,
  productGridActionsHtml,
  productGridColsForDevice,
  productGridPageSize,
  productGridRowsMax,
  PW_GRID_ROWS_DEFAULT,
  PW_PRODUCT_GRID_PAGE_JS,
} from '@/lib/partner-website/shop/pw-product-grid-page'

test('page size is rows × cols for the stamped device', () => {
  assert.equal(productGridColsForDevice('desktop'), 5)
  assert.equal(productGridColsForDevice('laptop'), 4)
  assert.equal(productGridColsForDevice('tablet'), 3)
  assert.equal(productGridColsForDevice('mobile'), 2)
  assert.equal(productGridPageSize(2, 5), 10)
  assert.equal(productGridPageSize(2, 4), 8)
  assert.equal(productGridPageSize(2, 3), 6)
  assert.equal(productGridPageSize(2, 2), 4)
  assert.equal(productGridPageSize(3, 5), 15)
})

test('clamps rows to 1–4 and infers from limit when missing', () => {
  assert.equal(clampProductGridRows(0), 1)
  assert.equal(clampProductGridRows(9), 4)
  assert.equal(clampProductGridRows('2'), 2)
  assert.equal(inferProductGridRows({ cols: 5 }), 1)
  assert.equal(inferProductGridRows({ rows: 3, cols: 5 }), 3)
  assert.equal(inferProductGridRows({ limit: 10, cols: 5 }), 2)
  assert.equal(inferProductGridRows({ limit: 4, cols: 2 }), 2)
})

test('recently viewed and recommended allow 1–8 rows on every device', () => {
  assert.equal(productGridRowsMax('recently-viewed'), 8)
  assert.equal(productGridRowsMax('recommended'), 8)
  assert.equal(productGridRowsMax('related'), 4)
  assert.equal(clampProductGridRows(8, 'recently-viewed'), 8)
  assert.equal(clampProductGridRows(9, 'recommended'), 8)
  assert.equal(clampProductGridRows(8, 'outfit'), 4)
  assert.equal(productGridPageSize(8, 5, 'recommended'), 40)
  assert.equal(productGridPageSize(8, 4, 'recommended'), 32)
  assert.equal(productGridPageSize(8, 3, 'recently-viewed'), 24)
  assert.equal(productGridPageSize(8, 2, 'recently-viewed'), 16)
  assert.equal(inferProductGridRows({ rows: 6, cols: 2, kind: 'recently-viewed' }), 6)
  assert.match(PW_PRODUCT_GRID_PAGE_JS, /function pwGridRowsMax/)
  assert.match(PW_PRODUCT_GRID_PAGE_JS, /recently-viewed/)
  assert.match(PW_PRODUCT_GRID_PAGE_JS, /return 8;/)
})

test('bootstrap helpers ship rows × cols page size', () => {
  assert.equal(PW_GRID_ROWS_DEFAULT, 1)
  assert.match(PW_PRODUCT_GRID_PAGE_JS, /function pwGridPageSize/)
  assert.match(PW_PRODUCT_GRID_PAGE_JS, /function pwGridRows/)
  assert.match(PW_PRODUCT_GRID_PAGE_JS, /data-pw-grid-rows/)
  assert.match(PW_PRODUCT_GRID_PAGE_JS, /data-pw-grid-cols-tablet/)
  assert.match(PW_PRODUCT_GRID_PAGE_JS, /data-pw-grid-cols-laptop/)
  assert.match(PW_PRODUCT_GRID_PAGE_JS, /return 1;/)
})

test('grid actions ship see-more and see-all in flow', () => {
  const html = productGridActionsHtml({
    loadMoreLabel: 'Xem thêm',
    seeAllLabel: 'Xem tất cả các nhóm',
    seeAllHref: '/site/demo/products',
  })
  assert.match(html, /data-pw-grid-more/)
  assert.match(html, /data-pw-el="section-more"/)
  assert.match(html, /Xem tất cả các nhóm/)
  assert.match(html, /\/site\/demo\/products/)
})

test('recommended actions omit see-all like 188', () => {
  const html = productGridActionsHtml({
    loadMoreLabel: 'Xem thêm',
    seeAllLabel: 'Xem tất cả các nhóm',
    seeAllHref: '/site/demo/products',
    hideSeeAll: true,
  })
  assert.match(html, /data-pw-grid-more/)
  assert.match(html, /Xem thêm/)
  assert.doesNotMatch(html, /data-pw-el="section-more"/)
  assert.doesNotMatch(html, /Xem tất cả các nhóm/)
})
