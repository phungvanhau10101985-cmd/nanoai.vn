import assert from 'node:assert/strict'
import test from 'node:test'

import { formatStudioExampleLabel } from '@/lib/hub-chat/hub-studio-example-label'
import { getStudioStepSuggestions } from '@/lib/hub-chat/hub-studio-step-suggestions'

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
