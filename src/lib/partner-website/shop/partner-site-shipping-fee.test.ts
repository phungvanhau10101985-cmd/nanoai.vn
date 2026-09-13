import test from 'node:test'
import assert from 'node:assert/strict'
import { matchVietnamProvince } from '@/lib/partner-website/shop/vietnam-provinces'
import { resolvePartnerShippingFeeQuote } from '@/lib/partner-website/shop/partner-site-shipping-fee'

test('matchVietnamProvince: canonical, alias, and free-text address', () => {
  assert.equal(matchVietnamProvince('Hồ Chí Minh'), 'Hồ Chí Minh')
  assert.equal(matchVietnamProvince('TP.HCM'), 'Hồ Chí Minh')
  assert.equal(matchVietnamProvince('123 Nguyễn Trãi, Quận 1, TP Hồ Chí Minh'), 'Hồ Chí Minh')
  assert.equal(matchVietnamProvince('Hà Nội'), 'Hà Nội')
  assert.equal(matchVietnamProvince('Ha Noi'), 'Hà Nội')
  assert.equal(matchVietnamProvince('Q.1, HCM'), 'Hồ Chí Minh')
  assert.equal(matchVietnamProvince(''), null)
  assert.equal(matchVietnamProvince('không rõ'), null)
})

test('unset province uses flat default fee', () => {
  const q = resolvePartnerShippingFeeQuote({
    defaultFeeAmount: 30000,
    provinceFees: { 'Hà Nội': 20000 },
    province: 'Đà Nẵng',
    payableSubtotal: 100000,
    freeThresholdAmount: null,
  })
  assert.equal(q.feeAmount, 30000)
  assert.equal(q.source, 'default')
  assert.equal(q.matchedProvince, 'Đà Nẵng')
})

test('province override wins, including explicit 0', () => {
  const hanoi = resolvePartnerShippingFeeQuote({
    defaultFeeAmount: 30000,
    provinceFees: { 'Hà Nội': 18000 },
    province: 'Hà Nội',
    payableSubtotal: 100000,
  })
  assert.equal(hanoi.feeAmount, 18000)
  assert.equal(hanoi.source, 'province')

  const freeHcm = resolvePartnerShippingFeeQuote({
    defaultFeeAmount: 30000,
    provinceFees: { 'Hồ Chí Minh': 0 },
    shippingAddress: 'Q.1, HCM',
    payableSubtotal: 50000,
  })
  assert.equal(freeHcm.feeAmount, 0)
  assert.equal(freeHcm.source, 'province')
  assert.equal(freeHcm.matchedProvince, 'Hồ Chí Minh')
})

test('free-threshold applies after province or default fee', () => {
  const q = resolvePartnerShippingFeeQuote({
    defaultFeeAmount: 30000,
    provinceFees: { 'Hà Nội': 40000 },
    province: 'Hà Nội',
    payableSubtotal: 500000,
    freeThresholdAmount: 400000,
  })
  assert.equal(q.feeAmount, 0)
  assert.equal(q.configuredFeeAmount, 40000)
  assert.equal(q.source, 'free')
})
