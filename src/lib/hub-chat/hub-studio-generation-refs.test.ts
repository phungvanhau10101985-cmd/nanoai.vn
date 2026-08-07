import assert from 'node:assert/strict'
import test from 'node:test'

import { emptyStudioSession, type HubStudioSession } from '@/lib/hub-chat/hub-studio-types'
import {
  buildGenerationRefPickerPayload,
  sanitizeGenerationSelection,
  stepSupportsGenerationRefPicker,
} from '@/lib/hub-chat/hub-studio-generation-refs'
import { applyReferenceRemoval } from '@/lib/hub-chat/hub-studio-step-navigate'

test('logo design step does not show generation ref / product compositing picker', () => {
  assert.equal(stepSupportsGenerationRefPicker('packaging_kit', 'logo'), false)
  const session = {
    ...emptyStudioSession(),
    presetId: 'packaging_kit',
    discoveryComplete: true,
    currentStepKey: 'logo',
    referenceImages: [],
  }
  assert.deepEqual(buildGenerationRefPickerPayload(session, 'packaging_kit', 'logo'), {})
})

test('packaging face step still supports generation ref picker', () => {
  assert.equal(stepSupportsGenerationRefPicker('packaging_kit', 'face_front'), true)
})

test('web ui mockup steps do not show packaging product compositing picker', () => {
  assert.equal(stepSupportsGenerationRefPicker('mobile_shop', 'home_mobile'), false)
  assert.equal(stepSupportsGenerationRefPicker('mobile_shop', 'home_desktop'), false)
  assert.equal(stepSupportsGenerationRefPicker('mobile_shop', 'product_detail_mobile'), false)
  const session = {
    ...emptyStudioSession(),
    presetId: 'mobile_shop',
    discoveryComplete: true,
    currentStepKey: 'home_mobile',
    referenceImages: [{ screenKey: 'logo', screenLabel: 'Logo', url: 'logo', approvedAt: 1 }],
  }
  assert.deepEqual(buildGenerationRefPickerPayload(session, 'mobile_shop', 'home_mobile'), {})
})

test('mockup 3d and dieline pdf do not show generation ref picker', () => {
  assert.equal(stepSupportsGenerationRefPicker('packaging_kit', 'box_mockup_3d'), false)
  assert.equal(stepSupportsGenerationRefPicker('packaging_kit', 'box_dieline_pdf'), false)
  const session = {
    ...emptyStudioSession(),
    presetId: 'packaging_kit',
    discoveryComplete: true,
    currentStepKey: 'box_mockup_3d',
    referenceImages: [{ screenKey: 'face_top', screenLabel: 'Top', url: 'top', approvedAt: 1 }],
  }
  assert.deepEqual(buildGenerationRefPickerPayload(session, 'packaging_kit', 'box_mockup_3d'), {})
})

test('sanitizeGenerationSelection drops stale reference keys after logo removal', () => {
  const session = {
    ...emptyStudioSession(),
    presetId: 'packaging_kit',
    referenceImages: [],
    generationSelection: {
      referenceScreenKeys: ['logo', 'face_top'],
      productUrls: ['p1', 'p2', 'p3'],
    },
  }
  const next = sanitizeGenerationSelection(session, 'packaging_kit')
  assert.deepEqual(next.generationSelection?.referenceScreenKeys, [])
  assert.equal(next.generationSelection?.productUrls.length, 3)
})

test('sanitizeGenerationSelection keeps valid reference keys', () => {
  const session = {
    ...emptyStudioSession(),
    presetId: 'packaging_kit',
    referenceImages: [{ screenKey: 'logo', screenLabel: 'Logo', url: 'logo', approvedAt: 1 }],
    generationSelection: {
      referenceScreenKeys: ['logo', 'face_top'],
      productUrls: ['p1'],
    },
  }
  const next = sanitizeGenerationSelection(session, 'packaging_kit')
  assert.deepEqual(next.generationSelection?.referenceScreenKeys, ['logo'])
})

test('remove reference preserves current step and process progress', () => {
  const session: HubStudioSession = {
    ...emptyStudioSession(),
    presetId: 'packaging_kit',
    currentStepKey: 'face_bottom',
    discoveryComplete: true,
    processSteps: [
      { key: 'logo', label: 'Logo', status: 'done' as const },
      { key: 'face_top', label: 'Top', status: 'done' as const },
      { key: 'face_front', label: 'Front', status: 'done' as const },
      { key: 'face_right', label: 'Right', status: 'done' as const },
      { key: 'face_bottom', label: 'Bottom', status: 'in_progress' as const },
    ],
    referenceImages: [
      { screenKey: 'logo', screenLabel: 'Logo', url: 'logo-url', approvedAt: 1 },
      { screenKey: 'face_top', screenLabel: 'Top', url: 'top-url', approvedAt: 2 },
    ],
    packaging: {
      version: 2 as const,
      dimensionsMm: { length: 200, width: 150, height: 100 },
      faces: { LxW: 'top-url', LxH: 'front-url', WxH: 'right-url' },
      faceSlots: {
        top: { sourceMode: 'generate' as const, url: 'top-url' },
        front: { sourceMode: 'generate' as const, url: 'front-url' },
        right: { sourceMode: 'generate' as const, url: 'right-url' },
      },
    },
  }

  const removed = session.referenceImages.find((r) => r.screenKey === 'logo')!
  const savedCurrentStepKey = session.currentStepKey
  let next: HubStudioSession = {
    ...session,
    referenceImages: session.referenceImages.filter((r) => r.screenKey !== 'logo'),
  }
  next = sanitizeGenerationSelection(next, 'packaging_kit')
  next = applyReferenceRemoval(next, removed, savedCurrentStepKey, 'packaging_kit')

  assert.equal(next.currentStepKey, 'face_bottom')
  assert.equal(next.processSteps.find((s) => s.key === 'logo')?.status, 'done')
  assert.equal(next.processSteps.find((s) => s.key === 'face_bottom')?.status, 'in_progress')
  assert.equal(next.packaging?.faceSlots?.top?.url, 'top-url')
  assert.equal(next.referenceImages.length, 1)
  assert.notEqual(next.pendingPreview?.screenKey, 'logo')
  assert.equal(next.pendingPreview, null)
})
