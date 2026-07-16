import assert from 'node:assert/strict'
import test from 'node:test'

import {
  discoveryReadyForBoxSize,
  isPresetTitleEcho,
  reconcileDiscoveryProgress,
  syncDiscoveryCurrentStep,
} from '@/lib/hub-chat/hub-studio-preset-intent'
import { buildStepsFromPreset } from '@/lib/hub-chat/hub-studio-presets'
import type { HubStudioSession } from '@/lib/hub-chat/hub-studio-types'

function packagingDiscoverySession(
  overrides: Partial<HubStudioSession> = {}
): HubStudioSession {
  const steps = buildStepsFromPreset('vi', 'packaging_kit')
  return {
    projectTitle: 'TSP',
    presetId: 'packaging_kit',
    uploadImages: [],
    briefNotes: {},
    discoveryComplete: false,
    processSteps: steps,
    currentStepKey: 'product_type',
    referenceImages: [],
    pendingPreview: null,
    lastGenerationPrompt: null,
    packaging: { version: 2, dimensionsMm: null, faces: {} },
    ...overrides,
  }
}

test('reconcile marks product_type done when briefNotes has answer but step pending', () => {
  let session = packagingDiscoverySession({
    briefNotes: { brand_name: 'TSP', product_type: 'mỹ phẩm' },
    processSteps: buildStepsFromPreset('vi', 'packaging_kit').map((s) =>
      s.key === 'brand_name' ? { ...s, status: 'done' as const } : s
    ),
    currentStepKey: 'product_type',
  })

  session = reconcileDiscoveryProgress(session)
  assert.equal(session.processSteps.find((s) => s.key === 'product_type')?.status, 'done')
  assert.equal(session.currentStepKey, 'box_size')
})

test('discoveryReadyForBoxSize after brand and product done', () => {
  const session = packagingDiscoverySession({
    briefNotes: { brand_name: 'TSP', product_type: 'mỹ phẩm' },
    processSteps: buildStepsFromPreset('vi', 'packaging_kit').map((s) =>
      s.key === 'brand_name' || s.key === 'product_type'
        ? { ...s, status: 'done' as const }
        : s
    ),
  })
  assert.equal(discoveryReadyForBoxSize(session), true)
})

test('reconcile advances to box_face_confirm when dimensions in briefNotes', () => {
  let session = packagingDiscoverySession({
    briefNotes: {
      brand_name: 'TSP',
      product_type: 'mỹ phẩm',
      box_size: '20,0×30,0×40,0 cm',
    },
    processSteps: buildStepsFromPreset('vi', 'packaging_kit').map((s) =>
      s.key === 'brand_name' || s.key === 'product_type'
        ? { ...s, status: 'done' as const }
        : s
    ),
    currentStepKey: 'product_type',
  })

  session = reconcileDiscoveryProgress(session)
  assert.equal(session.processSteps.find((s) => s.key === 'box_size')?.status, 'done')
  assert.equal(session.currentStepKey, 'box_face_confirm')
})

test('reconcile does not mark brand done when brief echoes preset chip title', () => {
  const title = 'Bộ đóng gói / bao bì'
  let session = packagingDiscoverySession({
    briefNotes: { brand_name: title },
    processSteps: buildStepsFromPreset('vi', 'packaging_kit'),
    currentStepKey: 'brand_name',
    projectTitle: title,
  })

  session = reconcileDiscoveryProgress(session, 'vi')
  assert.equal(session.processSteps.find((s) => s.key === 'brand_name')?.status, 'in_progress')
  assert.equal(session.currentStepKey, 'brand_name')
})

test('reconcile rewinds brand when brief wrongly used preset chip title', () => {
  const title = 'Bộ đóng gói / bao bì'
  let session = packagingDiscoverySession({
    briefNotes: { brand_name: title },
    processSteps: buildStepsFromPreset('vi', 'packaging_kit').map((s) =>
      s.key === 'brand_name'
        ? { ...s, status: 'done' as const }
        : s.key === 'product_type'
          ? { ...s, status: 'in_progress' as const }
          : s
    ),
    currentStepKey: 'product_type',
    projectTitle: title,
  })

  session = reconcileDiscoveryProgress(session, 'vi')
  assert.equal(session.processSteps.find((s) => s.key === 'brand_name')?.status, 'in_progress')
  assert.equal(session.currentStepKey, 'brand_name')
})

test('isPresetTitleEcho detects packaging preset chip label', () => {
  assert.equal(isPresetTitleEcho('vi', 'packaging_kit', 'Bộ đóng gói / bao bì'), true)
  assert.equal(isPresetTitleEcho('vi', 'packaging_kit', 'TSP'), false)
})

test('syncDiscoveryCurrentStep skips rewind when navigated back on design steps', () => {
  let session = packagingDiscoverySession({
    discoveryComplete: true,
    currentStepKey: 'face_back',
    processSteps: [
      { key: 'face_top', label: 'Top', status: 'done' },
      { key: 'face_front', label: 'Front', status: 'done' },
      { key: 'face_back', label: 'Back', status: 'in_progress' },
      { key: 'face_left', label: 'Left', status: 'in_progress' },
    ],
  })

  session = syncDiscoveryCurrentStep(session)
  assert.equal(session.currentStepKey, 'face_back')
})
