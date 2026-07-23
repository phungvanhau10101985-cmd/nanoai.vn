import assert from 'node:assert/strict'
import test from 'node:test'

import { formatStudioExampleLabel } from '@/lib/hub-chat/hub-studio-example-label'
import {
  extractExampleFromAsk,
  getStudioStepInputPlaceholder,
  getStudioStepSuggestions,
} from '@/lib/hub-chat/hub-studio-step-suggestions'

test('formatStudioExampleLabel prefixes once', () => {
  assert.equal(formatStudioExampleLabel('vi', 'Glow Lab'), 'Ví dụ: Glow Lab')
  assert.equal(formatStudioExampleLabel('vi', 'Ví dụ: Glow Lab'), 'Ví dụ: Glow Lab')
  assert.equal(formatStudioExampleLabel('en', 'Glow Lab'), 'Example: Glow Lab')
})

test('packaging_kit box_size returns dimension suggestions', () => {
  const items = getStudioStepSuggestions('packaging_kit', 'box_size', 'vi')
  assert.ok(items.length >= 3)
  assert.ok(items.some((item) => item.message.includes('50×30×10')))
  assert.ok(items.every((item) => item.label.startsWith('Ví dụ:')))
})

test('unknown step returns empty suggestions', () => {
  assert.deepEqual(getStudioStepSuggestions('packaging_kit', 'unknown_step', 'en'), [])
})

test('shared discovery step falls back to common suggestions', () => {
  const items = getStudioStepSuggestions('mobile_shop', 'brand_name', 'en')
  assert.ok(items.length >= 2)
  assert.ok(items.every((item) => item.label.startsWith('Example:')))
})

test('extractExampleFromAsk reads parenthetical hints', () => {
  assert.equal(
    extractExampleFromAsk('① Tên chiến dịch / sự kiện? (khai trương, sale 8/3…)'),
    'khai trương, sale 8/3'
  )
  assert.equal(
    extractExampleFromAsk('② Tên miền (domain)? (vd: vananh.fashion)'),
    'vananh.fashion'
  )
})

test('sale_banner product_offer placeholder is banner-specific not mobile shop', () => {
  const placeholder = getStudioStepInputPlaceholder(
    'sale_banner',
    'product_offer',
    'vi',
    'VD: Tôi muốn thiết kế giao diện app mobile bán hàng thời trang…'
  )
  assert.ok(placeholder.includes('Serum Vitamin C'))
  assert.ok(!placeholder.includes('app mobile'))
})

test('design step keeps step-specific placeholder after discovery', () => {
  const placeholder = getStudioStepInputPlaceholder(
    'sale_banner',
    'banner_design',
    'vi',
    'fallback'
  )
  assert.ok(placeholder.includes('GIẢM 50%'))
  assert.notEqual(placeholder, 'fallback')
})
