import assert from 'node:assert/strict'
import test from 'node:test'

import {
  planPresetLookSwitch,
  presetIdFromTemplateId,
} from './partner-website-preset-look'

test('first apply generates without snapshot', () => {
  assert.deepEqual(
    planPresetLookSwitch({
      currentPresetId: null,
      targetPresetId: 'fashion-orange',
      hasSavedTargetLook: false,
    }),
    { action: 'generate', snapshotOutgoing: false }
  )
})

test('A → B with no B look generates and snapshots A', () => {
  assert.deepEqual(
    planPresetLookSwitch({
      currentPresetId: 'fashion-orange',
      targetPresetId: 'commerce-blue',
      hasSavedTargetLook: false,
    }),
    { action: 'generate', snapshotOutgoing: true }
  )
})

test('B → A with saved A look restores and snapshots B', () => {
  assert.deepEqual(
    planPresetLookSwitch({
      currentPresetId: 'commerce-blue',
      targetPresetId: 'fashion-orange',
      hasSavedTargetLook: true,
    }),
    { action: 'restore', snapshotOutgoing: true }
  )
})

test('re-applying the same look generates a fresh template (reset)', () => {
  assert.deepEqual(
    planPresetLookSwitch({
      currentPresetId: 'fashion-orange',
      targetPresetId: 'fashion-orange',
      hasSavedTargetLook: true,
    }),
    { action: 'generate', snapshotOutgoing: false }
  )
})

test('ignores a saved look when template id is not a shop preset', () => {
  assert.deepEqual(
    planPresetLookSwitch({
      currentPresetId: 'landing-v1',
      targetPresetId: 'fashion-orange',
      hasSavedTargetLook: true,
    }),
    { action: 'generate', snapshotOutgoing: false }
  )
})

test('presetIdFromTemplateId maps stored template_id to a shop preset', () => {
  assert.equal(presetIdFromTemplateId('fashion-orange'), 'fashion-orange')
  assert.equal(presetIdFromTemplateId('blank-white'), 'blank-white')
  assert.equal(presetIdFromTemplateId('landing-v1'), null)
})

test('fashion-orange → blank-white snapshots the outgoing look', () => {
  assert.deepEqual(
    planPresetLookSwitch({
      currentPresetId: 'fashion-orange',
      targetPresetId: 'blank-white',
      hasSavedTargetLook: false,
    }),
    { action: 'generate', snapshotOutgoing: true }
  )
})
