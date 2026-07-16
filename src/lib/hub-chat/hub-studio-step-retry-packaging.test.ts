import assert from 'node:assert/strict'
import test from 'node:test'

import type { HubStudioSession } from '@/lib/hub-chat/hub-studio-types'
import {
  findBlockingIncompleteStep,
  getDesignStepIncompleteReason,
  isDesignStepApprovedComplete,
  resolveForwardDesignStepTarget,
} from '@/lib/hub-chat/hub-studio-step-retry'

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
