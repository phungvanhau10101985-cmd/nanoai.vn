import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { classifyShopReturnStatus, parseWarehouseSkuParts } from './shop-return'

describe('classifyShopReturnStatus', () => {
  it('requires EMS-reported return before shop can confirm', () => {
    assert.equal(
      classifyShopReturnStatus({ hasRecord: true, alreadyReturned: false, emsReportedReturn: false }).status,
      'not_ready',
    )
    assert.equal(
      classifyShopReturnStatus({ hasRecord: true, alreadyReturned: false, emsReportedReturn: true }).status,
      'ready_to_confirm',
    )
  })

  it('keeps already-returned and missing records separate', () => {
    assert.equal(
      classifyShopReturnStatus({ hasRecord: false, alreadyReturned: false, emsReportedReturn: false }).status,
      'not_found',
    )
    assert.equal(
      classifyShopReturnStatus({ hasRecord: true, alreadyReturned: true, emsReportedReturn: true }).status,
      'already_returned',
    )
  })
})

describe('parseWarehouseSkuParts', () => {
  it('splits warehouse SKU into base / size / color', () => {
    assert.deepEqual(parseWarehouseSkuParts('B7796/41/2'), { base: 'B7796', size: '41', color: '2' })
  })

  it('treats A…/4 as color gallery index, not size', () => {
    assert.deepEqual(parseWarehouseSkuParts('A1234567890/4'), { base: '1234567890', size: '', color: '4' })
  })
})
