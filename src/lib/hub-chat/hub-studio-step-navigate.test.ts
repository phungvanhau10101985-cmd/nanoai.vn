import assert from 'node:assert/strict'
import test from 'node:test'

import type { HubStudioSession } from '@/lib/hub-chat/hub-studio-types'
import {
  applyReferenceRemoval,
  canNavigateToStep,
  isForwardOnlyStudioPreset,
  isNavigatedBackEdit,
  navigateSessionToStep,
} from '@/lib/hub-chat/hub-studio-step-navigate'

function sessionAtFaceLeft(): HubStudioSession {
  return {
    presetId: 'packaging_kit',
    discoveryComplete: true,
    currentStepKey: 'face_left',
    processSteps: [
      { key: 'face_top', label: 'Top', status: 'done' },
      { key: 'face_front', label: 'Front', status: 'done' },
      { key: 'face_right', label: 'Right', status: 'done' },
      { key: 'face_bottom', label: 'Bottom', status: 'done' },
      { key: 'face_back', label: 'Back', status: 'done' },
      { key: 'face_left', label: 'Left', status: 'in_progress' },
      { key: 'box_dieline_pdf', label: 'Dieline', status: 'pending' },
    ],
    referenceImages: [],
    briefNotes: {},
  }
}

test('packaging_kit is forward-only — no step navigation', () => {
  assert.equal(isForwardOnlyStudioPreset('packaging_kit'), true)
  assert.equal(isForwardOnlyStudioPreset('brand_kit'), false)
  const session = sessionAtFaceLeft()
  assert.equal(canNavigateToStep(session, 'packaging_kit', 'face_back'), false)
  assert.equal(canNavigateToStep(session, 'packaging_kit', 'face_left'), false)
  assert.equal(canNavigateToStep(session, 'packaging_kit', 'box_dieline_pdf'), false)
})

test('non-packaging presets keep step navigation when steps are reached', () => {
  const session = {
    presetId: 'mobile_app_ui',
    discoveryComplete: true,
    currentStepKey: 'home_mobile',
    processSteps: [
      { key: 'logo', label: 'Logo', status: 'done' as const },
      { key: 'home_mobile', label: 'Home', status: 'in_progress' as const },
      { key: 'product_detail', label: 'Detail', status: 'pending' as const },
    ],
    referenceImages: [],
    briefNotes: {},
  }
  assert.equal(canNavigateToStep(session, 'mobile_app_ui', 'logo'), true)
  assert.equal(canNavigateToStep(session, 'mobile_app_ui', 'product_detail'), false)
})

test('navigate back preserves later step statuses', () => {
  const session = sessionAtFaceLeft()
  const next = navigateSessionToStep(session, 'packaging_kit', 'face_back')
  assert.equal(next.currentStepKey, 'face_back')
  assert.equal(next.processSteps.find((s) => s.key === 'face_back')?.status, 'in_progress')
  assert.equal(next.processSteps.find((s) => s.key === 'face_left')?.status, 'in_progress')
  assert.equal(isNavigatedBackEdit(next, 'packaging_kit'), true)
})

test('navigate forward to furthest clears navigated-back mode', () => {
  let session = sessionAtFaceLeft()
  session = navigateSessionToStep(session, 'packaging_kit', 'face_back')
  session = navigateSessionToStep(session, 'packaging_kit', 'face_left')
  assert.equal(isNavigatedBackEdit(session, 'packaging_kit'), false)
})

test('navigate to a copied face restores an editable preview from its source face', () => {
  const session: HubStudioSession = {
    ...sessionAtFaceLeft(),
    packaging: {
      version: 2,
      dimensionsMm: { length: 200, width: 120, height: 80 },
      faces: { LxW: 'https://example.com/top.png' },
      faceSlots: {
        top: { sourceMode: 'generate', url: 'https://example.com/top.png' },
        bottom: { sourceMode: 'copy' },
      },
    },
  }

  const next = navigateSessionToStep(session, 'packaging_kit', 'face_bottom')

  assert.equal(next.pendingPreview?.screenKey, 'face_bottom')
  assert.equal(next.pendingPreview?.url, 'https://example.com/top.png')
})

test('remove reference on current step restores editable preview', () => {
  const session: HubStudioSession = {
    ...sessionAtFaceLeft(),
    currentStepKey: 'face_top',
    referenceImages: [
      { screenKey: 'face_top', screenLabel: 'Top', url: 'https://example.com/top.png', approvedAt: 1 },
    ],
  }
  const removed = session.referenceImages[0]!
  const next = applyReferenceRemoval(
    { ...session, referenceImages: [] },
    removed,
    'face_top',
    'packaging_kit'
  )
  assert.equal(next.pendingPreview?.screenKey, 'face_top')
  assert.equal(next.pendingPreview?.url, 'https://example.com/top.png')
  assert.equal(next.processSteps.find((s) => s.key === 'face_top')?.status, 'in_progress')
})

test('remove unrelated reference at seal step does not show box face preview', () => {
  const session: HubStudioSession = {
    ...sessionAtFaceLeft(),
    currentStepKey: 'seal_sticker',
    processSteps: [
      ...sessionAtFaceLeft().processSteps,
      { key: 'product_label', label: 'Label', status: 'done' },
      { key: 'seal_sticker', label: 'Seal', status: 'in_progress' },
    ],
    referenceImages: [
      { screenKey: 'logo', screenLabel: 'Logo', url: 'https://example.com/logo.png', approvedAt: 1 },
      { screenKey: 'face_top', screenLabel: 'Top', url: 'https://example.com/top.png', approvedAt: 2 },
    ],
    pendingPreview: null,
  }
  const removed = session.referenceImages.find((r) => r.screenKey === 'face_top')!
  const next = applyReferenceRemoval(
    {
      ...session,
      referenceImages: session.referenceImages.filter((r) => r.screenKey !== 'face_top'),
    },
    removed,
    'seal_sticker',
    'packaging_kit'
  )
  assert.equal(next.currentStepKey, 'seal_sticker')
  assert.equal(next.pendingPreview, null)
})
