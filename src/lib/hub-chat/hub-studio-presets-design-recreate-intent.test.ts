import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  matchStudioPreset,
  matchesDesignRecreateAgainIntent,
} from '@/lib/hub-chat/hub-studio-presets'
import { matchFeatureFlowByMessage } from '@/lib/hub-chat/hub-feature-flow-registry'

test('matchesDesignRecreateAgainIntent requires lại + thiết kế', () => {
  assert.equal(matchesDesignRecreateAgainIntent('tạo lại bản thiết kế'), true)
  assert.equal(matchesDesignRecreateAgainIntent('dựng lại thiết kế'), true)
  assert.equal(matchesDesignRecreateAgainIntent('làm lại thiết kế áo dài'), true)
  assert.equal(matchesDesignRecreateAgainIntent('thiết kế lại từ mẫu'), true)
  assert.equal(matchesDesignRecreateAgainIntent('tao lai ban thiet ke'), true)
  assert.equal(matchesDesignRecreateAgainIntent('thiết kế app bán hàng'), false)
  assert.equal(matchesDesignRecreateAgainIntent('tạo lại'), false)
})

test('matchStudioPreset does not open a hub for recreate phrases', () => {
  assert.equal(matchStudioPreset('tạo lại bản thiết kế'), null)
  assert.equal(matchStudioPreset('Dựng lại thiết kế từ ảnh mẫu'), null)
  assert.equal(matchStudioPreset('làm lại bản thiết kế'), null)
})

test('matchFeatureFlowByMessage does not start a hub for recreate phrases', () => {
  assert.equal(matchFeatureFlowByMessage('tạo lại bản thiết kế', 'vi'), null)
  assert.equal(matchFeatureFlowByMessage('làm giống mẫu', 'vi'), null)
  assert.equal(matchFeatureFlowByMessage('concept sheet từ ảnh', 'vi'), null)
})
