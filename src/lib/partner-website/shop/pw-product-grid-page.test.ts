import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clampProductGridRows,
  inferProductGridRows,
  productGridColsForDevice,
  productGridPageSize,
  PW_PRODUCT_GRID_PAGE_JS,
} from '@/lib/partner-website/shop/pw-product-grid-page'

test('page size is rows × cols for the stamped device', () => {
  assert.equal(productGridColsForDevice('desktop'), 5)
  assert.equal(productGridColsForDevice('laptop'), 5)
  assert.equal(productGridColsForDevice('tablet'), 2)
  assert.equal(productGridColsForDevice('mobile'), 2)
  assert.equal(productGridPageSize(2, 5), 10)
  assert.equal(productGridPageSize(2, 2), 4)
  assert.equal(productGridPageSize(3, 5), 15)
})

test('clamps rows to 1–4 and infers from limit when missing', () => {
  assert.equal(clampProductGridRows(0), 1)
  assert.equal(clampProductGridRows(9), 4)
  assert.equal(clampProductGridRows('2'), 2)
  assert.equal(inferProductGridRows({ cols: 5 }), 2)
  assert.equal(inferProductGridRows({ rows: 3, cols: 5 }), 3)
  assert.equal(inferProductGridRows({ limit: 10, cols: 5 }), 2)
  assert.equal(inferProductGridRows({ limit: 4, cols: 2 }), 2)
})

test('bootstrap helpers ship rows × cols page size', () => {
  assert.match(PW_PRODUCT_GRID_PAGE_JS, /function pwGridPageSize/)
  assert.match(PW_PRODUCT_GRID_PAGE_JS, /function pwGridRows/)
  assert.match(PW_PRODUCT_GRID_PAGE_JS, /data-pw-grid-rows/)
})
