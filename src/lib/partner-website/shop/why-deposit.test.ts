import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { partnerSiteWhyDepositPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import { getWhyDepositCopy } from '@/lib/partner-website/shop/why-deposit-copy'
import {
  safeWhyDepositOrderCode,
  safeWhyDepositOrderId,
  whyDepositPolicyFromSettings,
  whyDepositZaloMessage,
} from '@/lib/partner-website/shop/why-deposit'

test('why-deposit query keeps a shop order id and code, drops junk', () => {
  assert.equal(safeWhyDepositOrderId('3f1c0c2a-4b5d-4e6f-8a9b-0c1d2e3f4a5b'), '3f1c0c2a-4b5d-4e6f-8a9b-0c1d2e3f4a5b')
  assert.equal(safeWhyDepositOrderId('188'), '188')
  assert.equal(safeWhyDepositOrderId('0'), null)
  assert.equal(safeWhyDepositOrderId('../etc'), null)
  assert.equal(safeWhyDepositOrderCode('188COMVN01'), '188COMVN01')
  assert.equal(safeWhyDepositOrderCode('SEVQR 188'), '')
  assert.equal(safeWhyDepositOrderCode('<script>'), '')
})

test('why-deposit policy uses shop percent, minimum, and large-order rule', () => {
  const policy = whyDepositPolicyFromSettings({
    default_deposit_percent: 30,
    min_deposit_amount_vnd: 100000,
    high_unit_price_deposit_threshold_vnd: 3000000,
    high_unit_price_min_deposit_percent: 30,
  })
  assert.deepEqual(policy, {
    percent: 30,
    minAmount: 100000,
    highOrderAmount: 3000000,
    highOrderPercent: 30,
  })
  const off = whyDepositPolicyFromSettings({
    default_deposit_percent: 20,
    high_unit_price_deposit_threshold_vnd: 0,
    high_unit_price_min_deposit_percent: 0,
  })
  assert.equal(off.highOrderAmount, 0)
  assert.equal(off.highOrderPercent, 0)
})

test('zalo message matches 188 wording and uses the shop name', () => {
  assert.equal(
    whyDepositZaloMessage('vi', '188COMVN01', '188.com.vn'),
    'Em cần hỏi về đặt cọc đơn #188COMVN01. Em đang xem trang thanh toán cọc trên 188.com.vn.'
  )
  assert.equal(
    whyDepositZaloMessage('vi', '', '188.com.vn'),
    'Em cần hỏi về chính sách đặt cọc trên 188.com.vn.'
  )
  assert.match(whyDepositZaloMessage('en', 'AB12', 'Shop'), /order #AB12/)
  assert.equal(getWhyDepositCopy('vi').askButton, 'Hỏi tại sao phải cọc?')
  assert.equal(getWhyDepositCopy('vi').zaloButton, 'Nhắn Zalo cho shop')
  for (const locale of ['vi', 'en', 'zh', 'ja', 'ko'] as const) {
    const copy = getWhyDepositCopy(locale)
    assert.ok(copy.askButton.trim())
    assert.ok(copy.zaloButton.includes('Zalo'))
    assert.match(copy.zaloMessageWithCode, /\{code\}/)
    assert.match(copy.zaloMessageWithCode, /\{shop\}/)
  }
})

test('why-deposit link keeps order and code for the shop path', () => {
  assert.equal(
    partnerSiteWhyDepositPath('188-com-vn-rl56', {
      orderId: '3f1c0c2a-4b5d-4e6f-8a9b-0c1d2e3f4a5b',
      orderCode: '188COMVN01',
    }),
    '/site/188-com-vn-rl56/tai-sao-dat-coc?order=3f1c0c2a-4b5d-4e6f-8a9b-0c1d2e3f4a5b&code=188COMVN01'
  )
  assert.equal(
    partnerSiteWhyDepositPath('188-com-vn-rl56', {
      customDomain: true,
      orderId: '12',
      orderCode: 'AB',
    }),
    '/tai-sao-dat-coc?order=12&code=AB'
  )
})

test('deposit QR page links to why-deposit', () => {
  const source = readFileSync(
    new URL('../../../components/partner-website/shop/partner-site-shop-deposit-client.tsx', import.meta.url),
    'utf8'
  )
  assert.match(source, /partnerSiteWhyDepositPath/)
  assert.match(source, /pw-shop-deposit-why/)
  assert.match(source, /deposit_why_open/)
})
