import assert from 'node:assert/strict'
import test from 'node:test'
import {
  extractCustomerVnMobiles,
  formatCustomerPhoneLeadReply,
  formatPhoneLeadPromptNote,
  phoneLeadShouldTakeConsultReply,
  zaloContactFromShopGuidance,
} from './partner-ai-phone-lead'

test('customer phone is a mobile, not a sample code', () => {
  assert.deepEqual(extractCustomerVnMobiles('Cần tư vấn 0522656868'), ['0522656868'])
  assert.deepEqual(extractCustomerVnMobiles('K4627'), [])
  assert.deepEqual(extractCustomerVnMobiles('nhờ tư vấn 0912 345 678'), ['0912345678'])
})

test('zalo number comes from the shop guidance, not the hotline', () => {
  const guidance = 'Hotline 0987654321. Khách cần gấp thì nhắn Zalo 0901 234 567.'
  assert.equal(zaloContactFromShopGuidance(guidance).dial, '0901234567')
  assert.equal(
    zaloContactFromShopGuidance('Zalo: https://zalo.me/0909988776').dial,
    '0909988776'
  )
  assert.equal(zaloContactFromShopGuidance('Giao hàng 7 ngày. Hotline 0987654321.').dial, null)
})

test('clarify phone gets a zalo reply; order and purchase do not', () => {
  assert.equal(
    phoneLeadShouldTakeConsultReply({
      hasPhone: true,
      orderStatusAsk: false,
      policyAsk: false,
      purchaseAsk: false,
      clarifyOnly: true,
    }),
    true
  )
  assert.equal(
    phoneLeadShouldTakeConsultReply({
      hasPhone: true,
      orderStatusAsk: true,
      policyAsk: false,
      purchaseAsk: false,
      clarifyOnly: true,
    }),
    false
  )
  assert.equal(
    phoneLeadShouldTakeConsultReply({
      hasPhone: true,
      orderStatusAsk: false,
      policyAsk: false,
      purchaseAsk: false,
      clarifyOnly: false,
    }),
    false
  )
})

test('phone reply names the zalo number and asks what they need, without a garment menu', () => {
  const reply = formatCustomerPhoneLeadReply({
    phone: '0522656868',
    zaloDial: '0901234567',
  })
  assert.match(reply, /0522656868/)
  assert.match(reply, /Zalo số 0901234567/)
  assert.match(reply, /muốn xem món gì/)
  assert.doesNotMatch(reply, /áo sơ mi|quần tây/)

  const withSku = formatCustomerPhoneLeadReply({
    phone: '0522656868',
    zaloDial: '0901234567',
    sku: 'K4627',
  })
  assert.match(withSku, /K4627/)
  assert.match(withSku, /size, màu hay giá/)

  const noZalo = formatCustomerPhoneLeadReply({ phone: '0522656868' })
  assert.doesNotMatch(noZalo, /Zalo số/)
  assert.equal(formatPhoneLeadPromptNote({ phone: '0522656868' }), '')
  assert.match(formatPhoneLeadPromptNote({ phone: '0522656868', zaloDial: '0901234567' }), /0901234567/)
})
