import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { sepayIpnDisposition } from './sepay-ipn'

describe('sepayIpnDisposition', () => {
  it('credits a bank notify that has transferType in and no status', () => {
    assert.equal(sepayIpnDisposition({ transferType: 'in', status: '' }), 'credit')
    assert.equal(sepayIpnDisposition({ transferType: 'in' }), 'credit')
  })

  it('credits an inbound transfer even when SePay labels it processing', () => {
    assert.equal(sepayIpnDisposition({ transferType: 'in', status: 'processing' }), 'credit')
  })

  it('asks SePay to retry a processing ping that is not an inbound transfer', () => {
    assert.equal(sepayIpnDisposition({ status: 'processing' }), 'retry')
  })

  it('ignores outgoing and failed transfers', () => {
    assert.equal(sepayIpnDisposition({ transferType: 'out', status: 'success' }), 'ignore')
    assert.equal(sepayIpnDisposition({ transferType: 'in', status: 'failed' }), 'ignore')
    assert.equal(sepayIpnDisposition({ status: 'cancelled' }), 'ignore')
  })
})
