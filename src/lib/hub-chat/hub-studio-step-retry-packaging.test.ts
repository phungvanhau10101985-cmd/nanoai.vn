import assert from 'node:assert/strict'
import test from 'node:test'

import type { HubStudioSession } from '@/lib/hub-chat/hub-studio-types'
import {
  findBlockingIncompleteStep,
  getDesignStepIncompleteReason,
  isDesignStepApprovedComplete,
  resolveForwardDesignStepTarget,
  resolvePackagingArtifactStepFromMessage,
  shouldForceGenerateForStep,
  shouldForceDeterministicStep,
  shouldShowPendingRetry,
} from '@/lib/hub-chat/hub-studio-step-retry'
import { preparePackagingFaceSlotsForArtifact } from '@/lib/packaging/hub-face-steps'
import { resolveMockupSlotUrl } from '@/lib/packaging/box-face-slots'

function packagingSession(overrides: Partial<HubStudioSession> = {}): HubStudioSession {
  return {
    presetId: 'packaging_kit',
    discoveryComplete: true,
    currentStepKey: 'box_dieline_pdf',
    processSteps: [
      { key: 'face_top', label: 'Top', status: 'done' },
      { key: 'face_front', label: 'Front', status: 'done' },
      { key: 'face_right', label: 'Right', status: 'done' },
      { key: 'face_bottom', label: 'Bottom', status: 'done' },
      { key: 'face_back', label: 'Back', status: 'done' },
      { key: 'face_left', label: 'Left', status: 'done' },
      { key: 'box_dieline_pdf', label: 'Dieline', status: 'in_progress' },
    ],
    referenceImages: [
      { screenKey: 'face_top', screenLabel: 'Top', url: 'https://example.com/top.png', approvedAt: 1 },
      { screenKey: 'face_front', screenLabel: 'Front', url: 'https://example.com/front.png', approvedAt: 2 },
      { screenKey: 'face_right', screenLabel: 'Right', url: 'https://example.com/right.png', approvedAt: 3 },
      { screenKey: 'face_back', screenLabel: 'Back', url: 'https://example.com/back.png', approvedAt: 4 },
      { screenKey: 'face_left', screenLabel: 'Left', url: 'https://example.com/left.png', approvedAt: 5 },
      { screenKey: 'logo', screenLabel: 'Logo', url: 'https://example.com/logo.png', approvedAt: 6 },
    ],
    packaging: {
      version: 2,
      dimensionsMm: { length: 100, width: 100, height: 200 },
      faces: {
        LxW: 'https://example.com/top.png',
        LxH: 'https://example.com/front.png',
        WxH: 'https://example.com/right.png',
      },
      faceSlots: {
        top: { sourceMode: 'generate', url: 'https://example.com/top.png' },
        front: { sourceMode: 'generate', url: 'https://example.com/front.png' },
        right: { sourceMode: 'generate', url: 'https://example.com/right.png' },
        bottom: { sourceMode: 'empty' },
        back: { sourceMode: 'generate', url: 'https://example.com/back.png' },
        left: { sourceMode: 'generate', url: 'https://example.com/left.png' },
      },
    },
    briefNotes: {},
    ...overrides,
  }
}

test('empty packaging face step counts as complete without reference image', () => {
  const session = packagingSession()
  assert.equal(getDesignStepIncompleteReason(session, 'packaging_kit', 'face_bottom'), 'none')
  assert.equal(isDesignStepApprovedComplete(session, 'packaging_kit', 'face_bottom'), true)
  assert.equal(findBlockingIncompleteStep(session, 'packaging_kit'), null)
})

test('packaging face marked done without faceSlots entry is still incomplete', () => {
  const session = packagingSession({
    packaging: {
      version: 2,
      dimensionsMm: { length: 100, width: 100, height: 200 },
      faces: {},
      faceSlots: {
        top: { sourceMode: 'generate', url: 'https://example.com/top.png' },
        front: { sourceMode: 'generate', url: 'https://example.com/front.png' },
        right: { sourceMode: 'generate', url: 'https://example.com/right.png' },
      },
    },
    processSteps: [
      { key: 'face_top', label: 'Top', status: 'done' },
      { key: 'face_front', label: 'Front', status: 'done' },
      { key: 'face_right', label: 'Right', status: 'done' },
      { key: 'face_bottom', label: 'Bottom', status: 'done' },
      { key: 'box_dieline_pdf', label: 'Dieline', status: 'in_progress' },
    ],
  })
  assert.equal(getDesignStepIncompleteReason(session, 'packaging_kit', 'face_bottom'), 'wrongly_done')
  assert.equal(findBlockingIncompleteStep(session, 'packaging_kit'), 'face_bottom')
})

test('forward jump to dieline when all face steps committed but current step rewound', () => {
  const session = packagingSession({
    currentStepKey: 'face_bottom',
    processSteps: [
      { key: 'face_top', label: 'Top', status: 'done' },
      { key: 'face_front', label: 'Front', status: 'done' },
      { key: 'face_right', label: 'Right', status: 'done' },
      { key: 'face_bottom', label: 'Bottom', status: 'in_progress' },
      { key: 'face_back', label: 'Back', status: 'done' },
      { key: 'face_left', label: 'Left', status: 'done' },
      { key: 'box_dieline_pdf', label: 'Dieline', status: 'pending' },
    ],
  })
  assert.equal(findBlockingIncompleteStep(session, 'packaging_kit'), null)
  assert.equal(
    resolveForwardDesignStepTarget(session, 'packaging_kit', 'vi', 'tạo Dieline PDF kỹ thuật'),
    'box_dieline_pdf'
  )
})

test('mockup recreate with pending preview skips approve gate and forces generate', () => {
  const session = packagingSession({
    currentStepKey: 'box_mockup_3d',
    processSteps: [
      { key: 'face_top', label: 'Top', status: 'done' },
      { key: 'face_front', label: 'Front', status: 'done' },
      { key: 'face_right', label: 'Right', status: 'done' },
      { key: 'face_bottom', label: 'Bottom', status: 'done' },
      { key: 'face_back', label: 'Back', status: 'done' },
      { key: 'face_left', label: 'Left', status: 'done' },
      { key: 'box_dieline_pdf', label: 'Dieline', status: 'done' },
      { key: 'box_mockup_3d', label: 'Mockup', status: 'in_progress' },
    ],
    pendingPreview: {
      screenKey: 'box_mockup_3d',
      screenLabel: 'Mockup',
      url: 'https://example.com/mockup-old.png',
      generationPrompt: 'mockup',
    },
  })
  const message = 'tạo mocup 3d'
  const aiHint = { retryIntent: 'create' as const, retryStepKey: 'box_mockup_3d' }
  assert.equal(shouldShowPendingRetry(session, 'box_mockup_3d', message, aiHint), false)
  assert.equal(
    shouldForceGenerateForStep(session, 'packaging_kit', 'box_mockup_3d', message, false, null, aiHint, {
      locale: 'vi',
    }),
    true
  )
})

test('mockup step forces generate without AI retry hint', () => {
  const session = packagingSession({
    currentStepKey: 'box_mockup_3d',
    processSteps: [
      { key: 'face_top', label: 'Top', status: 'done' },
      { key: 'face_front', label: 'Front', status: 'done' },
      { key: 'face_right', label: 'Right', status: 'done' },
      { key: 'face_bottom', label: 'Bottom', status: 'done' },
      { key: 'face_back', label: 'Back', status: 'done' },
      { key: 'face_left', label: 'Left', status: 'done' },
      { key: 'box_dieline_pdf', label: 'Dieline', status: 'done' },
      { key: 'box_mockup_3d', label: 'Mockup', status: 'in_progress' },
    ],
  })
  const message = 'tạo mockup 3d'
  assert.equal(shouldForceDeterministicStep(session, 'packaging_kit', 'box_mockup_3d', message, 'vi'), true)
  assert.equal(
    shouldForceGenerateForStep(session, 'packaging_kit', 'box_mockup_3d', message, false, null, {
      retryIntent: 'none',
    }, { locale: 'vi' }),
    true
  )
})

test('resolve mockup artifact from typo message on any step', () => {
  const session = packagingSession({ currentStepKey: 'box_dieline_pdf' })
  assert.equal(
    resolvePackagingArtifactStepFromMessage(session, 'vi', 'tạo mocup 3d'),
    'box_mockup_3d'
  )
})

test('hydrate face slots from reference images for compositor', () => {
  const session = packagingSession({ currentStepKey: 'box_mockup_3d' })
  const packaging = preparePackagingFaceSlotsForArtifact({
    packaging: { version: 2, dimensionsMm: session.packaging!.dimensionsMm, faces: {} },
    referenceImages: session.referenceImages,
    processSteps: session.processSteps,
  })
  assert.equal(packaging.faceSlots?.top?.url, 'https://example.com/top.png')
  assert.equal(packaging.faceSlots?.bottom?.sourceMode, 'empty')
})

test('mockup resolves copied secondary face from its primary face', () => {
  const faceSlots = {
    top: { sourceMode: 'generate' as const, url: 'https://example.com/top.png' },
    bottom: { sourceMode: 'copy' as const },
  }
  assert.equal(resolveMockupSlotUrl('top', faceSlots), 'https://example.com/top.png')
  assert.equal(resolveMockupSlotUrl('bottom', faceSlots), 'https://example.com/top.png')
})

test('completed deterministic packaging artifacts use saved output instead of reference images', () => {
  const session = packagingSession({
    processSteps: [
      { key: 'box_mockup_3d', label: 'Mockup', status: 'done' },
      { key: 'box_dieline_pdf', label: 'Dieline', status: 'done' },
    ],
    referenceImages: [],
    packaging: {
      ...packagingSession().packaging!,
      mockupUrl: 'https://example.com/mockup.png',
      dielineUrl: 'https://example.com/dieline.pdf',
    },
  })
  assert.equal(isDesignStepApprovedComplete(session, 'packaging_kit', 'box_mockup_3d'), true)
  assert.equal(isDesignStepApprovedComplete(session, 'packaging_kit', 'box_dieline_pdf'), true)
  assert.equal(getDesignStepIncompleteReason(session, 'packaging_kit', 'box_dieline_pdf'), 'none')
})
