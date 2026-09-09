import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  bankTransferMemoFromPaymentReference,
  coreShopOrderCode,
  displayShopOrderCode,
  formatShopSequentialOrderCode,
  isSequentialShopOrderCode,
  paymentReferenceLookupKeys,
  sanitizeShopPrefixForPaymentRef,
  sepayTransferContentFromOrderCode,
} from './shop-payment-reference'

describe('shop sequential order codes', () => {
  it('turns 188.com.vn into 188COMVN01 and increments', () => {
    assert.equal(sanitizeShopPrefixForPaymentRef('188.com.vn'), '188COMVN')
    assert.equal(formatShopSequentialOrderCode('188.com.vn', 1), '188COMVN01')
    assert.equal(formatShopSequentialOrderCode('188.com.vn', 12), '188COMVN12')
    assert.equal(formatShopSequentialOrderCode('188.com.vn', 100), '188COMVN100')
  })

  it('strips SEVQR for display and lookup', () => {
    assert.equal(displayShopOrderCode('SEVQR 188COMVN01'), '188COMVN01')
    assert.equal(displayShopOrderCode('188COMVN01'), '188COMVN01')
    assert.equal(coreShopOrderCode('SEVQR 188COMVN01'), '188COMVN01')
    assert.deepEqual(paymentReferenceLookupKeys('SEVQR 188COMVN01').sort(), [
      '188COMVN01',
      'SEVQR 188COMVN01',
    ])
    assert.deepEqual(paymentReferenceLookupKeys('188COMVN01').sort(), [
      '188COMVN01',
      'SEVQR 188COMVN01',
    ])
  })

  it('builds SePay transfer memo without putting UUID in the order code', () => {
    assert.equal(sepayTransferContentFromOrderCode('188COMVN01'), 'SEVQR 188COMVN01')
    assert.equal(bankTransferMemoFromPaymentReference('188COMVN01', true), 'SEVQR 188COMVN01')
    assert.equal(bankTransferMemoFromPaymentReference('188COMVN01', false), '188COMVN01')
  })

  it('recognizes shop sequential codes and DH, not short SKUs', () => {
    assert.equal(isSequentialShopOrderCode('188COMVN01'), true)
    assert.equal(isSequentialShopOrderCode('SEVQR 188COMVN01'), true)
    assert.equal(isSequentialShopOrderCode('SHOP01'), true)
    assert.equal(isSequentialShopOrderCode('DH131'), true)
    assert.equal(isSequentialShopOrderCode('H9441'), false)
    assert.equal(isSequentialShopOrderCode('C0156'), false)
    assert.equal(isSequentialShopOrderCode('188COMVNF7428AC054'), false)
  })
})
