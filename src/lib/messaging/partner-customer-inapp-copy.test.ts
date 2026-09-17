import assert from 'node:assert/strict'
import test from 'node:test'
import { formatCustomerInAppCopy } from './partner-customer-inapp-copy'
import { pickPartnerCustomerEmsNotifyEvent } from './partner-customer-webapp-notify'
import { mergePartnerCustomerNotifyGuestIds } from '@/lib/db/messaging-partner-customer-notifications-pg'

test('order placed in-app goes to the customer, not the owner copy', () => {
  const vi = formatCustomerInAppCopy('vi', {
    kind: 'order_placed',
    orderCode: 'GUDOVN14',
    shopName: 'gudo.vn',
    productName: 'Đầm voan',
    needsDeposit: true,
    depositLabel: '190.000đ',
  })
  assert.equal(vi.title, 'Đơn hàng đã được ghi nhận')
  assert.match(vi.body, /gudo\.vn/)
  assert.match(vi.body, /190\.000đ/)
  assert.doesNotMatch(vi.body, /vừa đặt đơn/)
  const en = formatCustomerInAppCopy('en', {
    kind: 'order_placed',
    orderCode: 'GUDOVN14',
    shopName: 'gudo.vn',
    needsDeposit: false,
  })
  assert.equal(en.title, 'Order received')
})

test('customer notify guest ids keep both chat session and email account', () => {
  assert.deepEqual(
    mergePartnerCustomerNotifyGuestIds('aaa', 'bbb', 'aaa', '', null),
    ['aaa', 'bbb']
  )
})

test('cancelled in-app matches 188, not Payment status dump', () => {
  const vi = formatCustomerInAppCopy('vi', { kind: 'cancelled', orderCode: 'GUDOVN08' })
  assert.equal(vi.title, 'Đơn hàng đã hủy')
  assert.match(vi.body, /GUDOVN08/)
  assert.doesNotMatch(vi.body, /Payment status/i)
  const en = formatCustomerInAppCopy('en', { kind: 'cancelled', orderCode: 'GUDOVN08', byCustomer: true })
  assert.equal(en.title, 'Order cancelled')
  assert.match(en.body, /You cancelled/)
})

test('deposit confirmed uses 188 title Đã nhận đặt cọc', () => {
  const copy = formatCustomerInAppCopy('vi', {
    kind: 'deposit_confirmed',
    orderCode: 'GUDOVN08',
    paidLabel: '300.000đ',
    remaining: 700_000,
    remainingLabel: '700.000đ',
  })
  assert.equal(copy.title, 'Đã nhận đặt cọc')
  assert.match(copy.body, /300\.000đ/)
  assert.match(copy.body, /700\.000đ/)
})

test('shipper / delivered / thanks copy matches 188', () => {
  const ship = formatCustomerInAppCopy('vi', {
    kind: 'shipper_confirmed',
    orderCode: 'DH1',
    shopName: 'gudo.vn',
    tracking: 'EN123',
  })
  assert.equal(ship.title, 'Hàng đang được giao')
  assert.match(ship.body, /Đã nhận hàng/)
  const ems = formatCustomerInAppCopy('vi', {
    kind: 'delivered_ems',
    orderCode: 'DH1',
    shopName: 'gudo.vn',
  })
  assert.equal(ems.title, 'Đã giao hàng thành công')
  const thanks = formatCustomerInAppCopy('vi', {
    kind: 'delivered_customer',
    orderCode: 'DH1',
    shopName: 'gudo.vn',
  })
  assert.equal(thanks.title, 'Cảm ơn bạn đã nhận hàng')
})

test('promo grant copy matches 188', () => {
  const copy = formatCustomerInAppCopy('vi', {
    kind: 'promo_grant',
    promotionName: 'Quay lại',
    code: 'COME10',
    days: 5,
    percent: 10,
    maxLabel: '100.000đ',
  })
  assert.equal(copy.title, 'Bạn nhận quà: Quay lại')
  assert.match(copy.body, /COME10/)
  assert.match(copy.body, /Khuyến mãi/)
})

test('EMS notify picks highest-priority event like 188', () => {
  const tracking = pickPartnerCustomerEmsNotifyEvent({
    orderCode: 'GUDOVN08',
    before: { shippingStatus: 'pending', trackingNumber: '', emsPhase: 'unknown' },
    after: { shippingStatus: 'shipping', trackingNumber: 'EN99', emsPhase: 'posted', emsStatus: 'Đã nhận' },
  })
  assert.equal(tracking?.kind, 'ems_phase')
  if (tracking?.kind === 'ems_phase') assert.equal(tracking.phase, 'posted')

  const delivered = pickPartnerCustomerEmsNotifyEvent({
    orderCode: 'GUDOVN08',
    before: { shippingStatus: 'shipping', trackingNumber: 'EN99', emsPhase: 'out_for_delivery' },
    after: { shippingStatus: 'delivered', trackingNumber: 'EN99', emsPhase: 'delivered' },
  })
  assert.equal(delivered?.kind, 'delivered_ems')

  const none = pickPartnerCustomerEmsNotifyEvent({
    orderCode: 'GUDOVN08',
    before: { shippingStatus: 'shipping', trackingNumber: 'EN99', emsPhase: 'in_transit' },
    after: { shippingStatus: 'shipping', trackingNumber: 'EN99', emsPhase: 'in_transit' },
  })
  assert.equal(none, null)
})
