import assert from 'node:assert/strict'
import test from 'node:test'
import type { HubStudioSession } from '@/lib/hub-chat/hub-studio-types'
import {
  buildApprovedPackagingMockupStudio,
  clearStalePendingForArtifactGenerate,
  mergeApprovedPackagingMockupIntoStudio,
  pendingPreviewBlocksWorkflowInput,
} from '@/lib/hub-chat/hub-studio-step-preview'

function packagingSession(overrides: Partial<HubStudioSession> = {}): HubStudioSession {
  return {
    presetId: 'packaging_kit',
    projectTitle: 'Box',
    discoveryComplete: true,
    processSteps: [{ key: 'box_mockup_3d', label: 'Mockup 3D', status: 'done' }],
    currentStepKey: 'box_dieline_pdf',
    briefNotes: {},
    uploadImages: [],
    referenceImages: [],
    pendingPreview: null,
    packaging: {
      version: 2,
      dimensionsMm: { length: 100, width: 80, height: 60 },
      faces: {},
      faceSlots: {
        top: { sourceMode: 'generate', url: 'top.png' },
        front: { sourceMode: 'generate', url: 'front.png' },
        right: { sourceMode: 'generate', url: 'right.png' },
        bottom: { sourceMode: 'generate', url: 'bottom.png' },
        back: { sourceMode: 'generate', url: 'back.png' },
        left: { sourceMode: 'generate', url: 'left.png' },
      },
      mockupUrl: 'https://example.com/mockup.png',
    },
    ...overrides,
  }
}

test('buildApprovedPackagingMockupStudio returns view-only payload when mockup is approved', () => {
  const studio = buildApprovedPackagingMockupStudio(packagingSession())
  assert.equal(studio?.screenKey, 'box_mockup_3d')
  assert.equal(studio?.imageUrl, 'https://example.com/mockup.png')
  assert.equal(studio?.showApproveReference, false)
  assert.equal(studio?.showRegenerate, true)
})

test('mergeApprovedPackagingMockupIntoStudio attaches mockup to timeline messages without image', () => {
  const session = packagingSession()
  const merged = mergeApprovedPackagingMockupIntoStudio(session, {
    processSteps: session.processSteps,
    awaitingRequirements: true,
  })
  assert.equal(merged.screenKey, 'box_mockup_3d')
  assert.equal(merged.imageUrl, 'https://example.com/mockup.png')
  assert.equal(merged.showApproveReference, false)
})

test('clearStalePendingForArtifactGenerate drops done mockup preview on dieline step', () => {
  const session = packagingSession({
    pendingPreview: {
      screenKey: 'box_mockup_3d',
      screenLabel: 'Mockup',
      url: 'https://example.com/mockup-old.png',
      generationPrompt: 'mockup',
    },
  })
  const cleared = clearStalePendingForArtifactGenerate(session, 'box_dieline_pdf')
  assert.equal(cleared.pendingPreview, null)
})

test('clearStalePendingForArtifactGenerate keeps pending when current step awaits approval', () => {
  const pending = {
    screenKey: 'face_front',
    screenLabel: 'Front',
    url: 'https://example.com/front-new.png',
    generationPrompt: 'front',
  }
  const session = packagingSession({
    currentStepKey: 'face_front',
    processSteps: [{ key: 'face_front', label: 'Front', status: 'in_progress' }],
    pendingPreview: pending,
  })
  const kept = clearStalePendingForArtifactGenerate(session, 'face_front')
  assert.deepEqual(kept.pendingPreview, pending)
})

test('pendingPreviewBlocksWorkflowInput ignores stale mockup preview on dieline step', () => {
  const session = packagingSession({
    processSteps: [
      { key: 'box_mockup_3d', label: 'Mockup', status: 'done' },
      { key: 'box_dieline_pdf', label: 'Dieline', status: 'in_progress' },
    ],
    pendingPreview: {
      screenKey: 'box_mockup_3d',
      screenLabel: 'Mockup',
      url: 'https://example.com/mockup-old.png',
      generationPrompt: 'mockup',
    },
  })
  assert.equal(pendingPreviewBlocksWorkflowInput(session), false)
})
