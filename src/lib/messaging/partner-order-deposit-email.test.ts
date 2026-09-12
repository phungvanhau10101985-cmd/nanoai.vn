import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildCustomerDepositQrEmailBlock,
  customerDepositOrderUrl,
  customerOrderDetailUrl,
  DEPOSIT_QR_EMAIL_CID,
  orderNeedsCustomerDepositMail,
} from './partner-order-deposit-email'

test('orderNeedsCustomerDepositMail is true while unpaid deposit remains', () => {
  assert.equal(orderNeedsCustomerDepositMail({ requiredAmount: 150000, paidAmount: 0 }), true)
  assert.equal(orderNeedsCustomerDepositMail({ requiredAmount: 150000, paidAmount: 150000 }), false)
  assert.equal(orderNeedsCustomerDepositMail({ requiredAmount: 0, paidAmount: 0 }), false)
})

test('customer deposit URL is storefront /orders/{id}/deposit, not chat', () => {
  assert.equal(
    customerDepositOrderUrl({
      shopUrl: 'https://gudo.vn',
      siteSlug: 'gudo',
      orderId: 'ord-1',
    }),
    'https://gudo.vn/orders/ord-1/deposit'
  )
  assert.equal(
    customerDepositOrderUrl({
      shopUrl: 'https://nanoai.example/site/gudo',
      siteSlug: 'gudo',
      orderId: 'ord-1',
    }),
    'https://nanoai.example/site/gudo/orders/ord-1/deposit'
  )
  assert.equal(
    customerDepositOrderUrl({ shopUrl: 'https://gudo.vn', siteSlug: '', orderId: 'ord-1' }),
    null
  )
})

test('customer order detail URL is storefront /orders/{id}', () => {
  assert.equal(
    customerOrderDetailUrl({
      shopUrl: 'https://gudo.vn',
      siteSlug: 'gudo',
      orderId: 'ord-1',
    }),
    'https://gudo.vn/orders/ord-1'
  )
})

test('deposit QR email block embeds CID image and CK memo', () => {
  const block = buildCustomerDepositQrEmailBlock({
    qrImageSrc: `cid:${DEPOSIT_QR_EMAIL_CID}`,
    amountLabel: '150.000đ',
    transferMemo: 'GUDOVN01',
  })
  assert.match(block.html, /cid:deposit-qr/)
  assert.match(block.html, /Quét mã QR để đặt cọc/)
  assert.match(block.html, /GUDOVN01/)
  assert.doesNotMatch(block.html, /NanoAI/i)
  assert.match(block.text, /150\.000đ/)
  assert.match(block.text, /GUDOVN01/)
  assert.doesNotMatch(block.text, /cid:/)
})
