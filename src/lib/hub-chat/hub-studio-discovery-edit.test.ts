import assert from 'node:assert/strict'
import test from 'node:test'

import { emptyStudioSession } from '@/lib/hub-chat/hub-studio-types'
import {
  applyDiscoveryBriefEdit,
  matchDiscoveryBriefEditStep,
} from '@/lib/hub-chat/hub-studio-discovery-edit'

function packagingSessionAtLogo() {
  return {
    ...emptyStudioSession(),
    presetId: 'packaging_kit',
    discoveryComplete: true,
    currentStepKey: 'logo',
    briefNotes: {
      brand_name: '188.com.vn',
      color_palette: 'màu nền màu bìa carton',
    },
    processSteps: [
      { key: 'brand_name', label: 'Brand', status: 'done' as const },
      { key: 'product_type', label: 'Product', status: 'done' as const },
      { key: 'box_size', label: 'Size', status: 'done' as const },
      { key: 'box_face_confirm', label: 'Confirm', status: 'done' as const },
      { key: 'style_mood', label: 'Style', status: 'done' as const },
      { key: 'color_palette', label: 'Color', status: 'done' as const },
      { key: 'logo', label: 'Logo', status: 'in_progress' as const },
    ],
  }
}

test('implicit color correction on logo step updates color brief without resetting flow', () => {
  const session = packagingSessionAtLogo()
  const match = matchDiscoveryBriefEditStep(
    'màu nền màu bìa carton và màu cam và màu xám',
    'vi',
    'packaging_kit',
    session
  )
  assert.deepEqual(match, { stepKey: 'color_palette', reopenStep: false })

  const next = applyDiscoveryBriefEdit(session, 'packaging_kit', 'color_palette', 'màu nền màu bìa carton và màu cam và màu xám', {
    reopenStep: false,
  })
  assert.equal(next.currentStepKey, 'logo')
  assert.equal(next.briefNotes.color_palette, 'màu nền màu bìa carton và màu cam và màu xám')
  assert.equal(next.processSteps.find((s) => s.key === 'logo')?.status, 'in_progress')
})

test('explicit edit brief reopens color step then can continue to logo', () => {
  const session = packagingSessionAtLogo()
  const message = 'sửa lại màu sắc: màu nền carton, cam và xám'
  const match = matchDiscoveryBriefEditStep(message, 'vi', 'packaging_kit', session)
  assert.equal(match?.stepKey, 'color_palette')
  assert.equal(match?.reopenStep, true)

  const next = applyDiscoveryBriefEdit(session, 'packaging_kit', 'color_palette', message, {
    reopenStep: true,
  })
  assert.equal(next.briefNotes.color_palette, 'màu nền carton, cam và xám')
  assert.equal(next.currentStepKey, 'logo')
  assert.equal(next.processSteps.find((s) => s.key === 'color_palette')?.status, 'done')
})
