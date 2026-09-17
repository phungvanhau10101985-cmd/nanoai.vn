import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatDepositConfirmedChatBodyForCustomer,
  formatDepositConfirmedEmailContentForCustomer,
  formatDepositReminderEmailContentForCustomer,
  formatOrderCancelledEmailContentForCustomer,
  formatOrderRefundedEmailContentForCustomer,
} from './order-customer-notify-i18n'

const base = {
  shopLabel: 'Gudo',
  customerName: 'Nguyen Van A',
  paymentRef: 'GUDOVN01',
  productName: 'Tui deo cheo',
  orderTotalLabel: '1.000.000đ',
  paidAmountLabel: '300.000đ',
  remainingAmountLabel: '700.000đ',
  remainingAmount: 700000,
} as const

test('deposit confirmed email lists paid amount and remaining on delivery', () => {
  const mail = formatDepositConfirmedEmailContentForCustomer({
    locale: 'vi',
    ...base,
  })
  assert.match(mail.subject, /đã xác nhận đặt cọc 300\.000đ/)
  assert.ok(mail.lines.includes('Số tiền đã cọc: 300.000đ'))
  assert.ok(mail.lines.includes('Số tiền cần thanh toán khi nhận hàng: 700.000đ'))
  assert.ok(mail.lines.includes('Tổng đơn: 1.000.000đ'))
  assert.ok(mail.lines.includes('Quý khách thanh toán số còn lại khi nhận hàng.'))
  assert.doesNotMatch(mail.lines.join('\n'), /Số tiền ghi nhận/)
})

test('deposit confirmed email says paid in full when remaining is 0', () => {
  const mail = formatDepositConfirmedEmailContentForCustomer({
    locale: 'vi',
    ...base,
    paidAmountLabel: '1.000.000đ',
    remainingAmountLabel: '0đ',
    remainingAmount: 0,
  })
  assert.match(mail.subject, /đã thanh toán đủ 1\.000\.000đ/)
  assert.match(mail.lines.join('\n'), /đã thanh toán đủ/)
  assert.ok(mail.lines.includes('Đơn không còn số phải thu khi nhận hàng.'))
})

test('deposit confirmed chat body includes remaining due on delivery', () => {
  const chat = formatDepositConfirmedChatBodyForCustomer({
    locale: 'vi',
    ...base,
    shopNote: 'Da nhan CK',
  })
  assert.match(chat, /Shop đã xác nhận đặt cọc cho đơn GUDOVN01/)
  assert.match(chat, /Số tiền đã cọc: 300\.000đ/)
  assert.match(chat, /Số tiền cần thanh toán khi nhận hàng: 700\.000đ/)
  assert.match(chat, /Ghi chú từ shop: Da nhan CK/)
})

test('cancelled order email names the shop and order', () => {
  const mail = formatOrderCancelledEmailContentForCustomer({
    locale: 'vi',
    shopLabel: 'Gudo',
    customerName: 'Nguyen Van A',
    paymentRef: 'GUDOVN01',
    productName: 'Tui deo cheo',
    reason: 'Khach yeu cau',
  })
  assert.match(mail.subject, /đã hủy/)
  assert.ok(mail.lines.includes('Đơn GUDOVN01 đã được hủy.'))
  assert.ok(mail.lines.includes('Lý do: Khach yeu cau'))
})

test('refunded order email includes amount', () => {
  const mail = formatOrderRefundedEmailContentForCustomer({
    locale: 'vi',
    shopLabel: 'Gudo',
    customerName: 'Nguyen Van A',
    paymentRef: 'GUDOVN01',
    productName: 'Tui deo cheo',
    refundAmountLabel: '300.000đ',
  })
  assert.match(mail.subject, /hoàn tiền/)
  assert.match(mail.lines.join('\n'), /300\.000đ/)
})

test('deposit reminder copy is locale-aware for 2h and 20h', () => {
  const vi = formatDepositReminderEmailContentForCustomer({
    locale: 'vi',
    shopLabel: 'Gudo',
    orderCode: 'GUDOVN01',
    hours: 2,
  })
  assert.match(vi.subject, /Gudo/)
  assert.match(vi.text, /2 giờ/)
  const en = formatDepositReminderEmailContentForCustomer({
    locale: 'en',
    shopLabel: 'Gudo',
    orderCode: 'GUDOVN01',
    hours: 20,
  })
  assert.match(en.text, /20-hour/)
})
