import assert from 'node:assert/strict'
import test from 'node:test'
import {
  annotateFashionSizeWeightTextForAi,
  formatKgRangeFromChineseJin,
  looksLikeChineseJinWeightRange,
  sanitizeFashionSizeWeightMessageForCustomer,
} from './fashion-size-weight-units'

test('looksLikeChineseJinWeightRange detects typical TQ size chart numbers', () => {
  assert.equal(looksLikeChineseJinWeightRange(90, 105), true)
  assert.equal(looksLikeChineseJinWeightRange(45, 52), false)
  assert.equal(looksLikeChineseJinWeightRange(90, 50), false)
})

test('formatKgRangeFromChineseJin converts jin to kg', () => {
  assert.equal(formatKgRangeFromChineseJin(90, 105), '45–52,5 kg')
  assert.equal(formatKgRangeFromChineseJin(105, 125), '52,5–62,5 kg')
})

test('annotateFashionSizeWeightTextForAi prioritizes kg for AI consultation', () => {
  const out = annotateFashionSizeWeightTextForAi('["M (90-105)","L (105-125)"]')
  assert.match(out, /≈ 45–52,5 kg/)
  assert.match(out, /bảng gốc 90–105 cân TQ\/斤/)
  assert.match(out, /≈ 52,5–62,5 kg/)
})

test('sanitizeFashionSizeWeightMessageForCustomer converts to kg only', () => {
  const msg =
    'Dạ, size nhỏ nhất của mẫu này là M (dành cho cân nặng 90-105). Nếu chị nhẹ hơn mức đó thì áo có thể hơi rộng.'
  const out = sanitizeFashionSizeWeightMessageForCustomer(msg)
  assert.match(out, /45–52,5 kg/)
  assert.doesNotMatch(out, /90-105/)
  assert.doesNotMatch(out, /cân TQ/)
})

test('sanitizeFashionSizeWeightMessageForCustomer clarifies bare size parentheses as kg', () => {
  const msg = 'Giá: 990.000đ — có các size M (90-105), L (105-125).'
  const out = sanitizeFashionSizeWeightMessageForCustomer(msg)
  assert.match(out, /M \(45–52,5 kg\)/)
  assert.match(out, /L \(52,5–62,5 kg\)/)
  assert.doesNotMatch(out, /90-105/)
})

test('sanitizeFashionSizeWeightMessageForCustomer leaves explicit kg alone', () => {
  const msg = 'Size M phù hợp cân nặng 48-55 kg.'
  assert.equal(sanitizeFashionSizeWeightMessageForCustomer(msg), msg)
})
