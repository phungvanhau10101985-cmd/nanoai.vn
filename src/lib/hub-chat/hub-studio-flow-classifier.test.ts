import assert from 'node:assert/strict'
import test from 'node:test'

import {
  FLOW_SWITCH_AI_MIN_CONFIDENCE,
  shouldSkipFlowSwitchAiClassification,
} from '@/lib/hub-chat/hub-studio-flow-guard'
import {
  isHighConfidenceFlowSwitch,
  parseFlowSwitchClassifierJson,
} from '@/lib/hub-chat/hub-studio-flow-classifier'

test('parseFlowSwitchClassifierJson accepts valid preset id and confidence', () => {
  const parsed = parseFlowSwitchClassifierJson(
    '{"switchPresetId":"landing_page","confidence":0.92}'
  )
  assert.equal(parsed.switchPresetId, 'landing_page')
  assert.equal(parsed.confidence, 0.92)
})

test('parseFlowSwitchClassifierJson rejects invalid preset ids', () => {
  const parsed = parseFlowSwitchClassifierJson('{"switchPresetId":"not_a_preset","confidence":0.99}')
  assert.equal(parsed.switchPresetId, null)
  assert.equal(parsed.confidence, 0)
})

test('parseFlowSwitchClassifierJson clamps confidence to 0..1', () => {
  const parsed = parseFlowSwitchClassifierJson('{"switchPresetId":"brand_kit","confidence":1.8}')
  assert.equal(parsed.switchPresetId, 'brand_kit')
  assert.equal(parsed.confidence, 1)
})

test('shouldSkipFlowSwitchAiClassification skips multi-line packaging briefs', () => {
  const message = `MẶT 1: MẶT CHÍNH
Mặt này tập trung vào nhận diện thương hiệu để thu hút khách hàng.
Logo/Thương hiệu: NANOCOSMETIC`
  assert.equal(shouldSkipFlowSwitchAiClassification(message), true)
})

test('shouldSkipFlowSwitchAiClassification allows compact switch phrases', () => {
  assert.equal(shouldSkipFlowSwitchAiClassification('muốn làm trang giới thiệu công ty'), false)
})

test('isHighConfidenceFlowSwitch requires threshold and different preset', () => {
  assert.equal(
    isHighConfidenceFlowSwitch(
      { switchPresetId: 'landing_page', confidence: FLOW_SWITCH_AI_MIN_CONFIDENCE },
      'packaging_kit'
    ),
    true
  )
  assert.equal(
    isHighConfidenceFlowSwitch(
      { switchPresetId: 'landing_page', confidence: FLOW_SWITCH_AI_MIN_CONFIDENCE - 0.01 },
      'packaging_kit'
    ),
    false
  )
  assert.equal(
    isHighConfidenceFlowSwitch(
      { switchPresetId: 'packaging_kit', confidence: 0.99 },
      'packaging_kit'
    ),
    false
  )
})
