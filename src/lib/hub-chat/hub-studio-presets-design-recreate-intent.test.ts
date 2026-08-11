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

test('matchStudioPreset routes recreate phrases to design_recreate', () => {
  assert.equal(matchStudioPreset('tạo lại bản thiết kế')?.id, 'design_recreate')
  assert.equal(matchStudioPreset('Dựng lại thiết kế từ ảnh mẫu')?.id, 'design_recreate')
  assert.equal(matchStudioPreset('làm lại bản thiết kế')?.id, 'design_recreate')
})

test('matchFeatureFlowByMessage starts design_recreate for recreate phrases', () => {
  const match = matchFeatureFlowByMessage('tạo lại bản thiết kế', 'vi')
  assert.equal(match?.kind, 'studio')
  if (match?.kind === 'studio') {
    assert.equal(match.presetId, 'design_recreate')
  }
})
