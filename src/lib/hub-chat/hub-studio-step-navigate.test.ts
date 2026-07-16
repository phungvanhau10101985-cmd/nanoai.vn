import assert from 'node:assert/strict'
import test from 'node:test'

import type { HubStudioSession } from '@/lib/hub-chat/hub-studio-types'
import {
  canNavigateToStep,
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

test('can navigate to any reached step up to furthest', () => {
  const session = sessionAtFaceLeft()
  const furthestKey = session.processSteps.filter((s) => s.status !== 'pending').at(-1)?.key
  assert.equal(furthestKey, 'face_left')
  assert.equal(canNavigateToStep(session, 'packaging_kit', 'face_back'), true)
  assert.equal(canNavigateToStep(session, 'packaging_kit', 'face_left'), true)
  assert.equal(canNavigateToStep(session, 'packaging_kit', 'box_dieline_pdf'), false)
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
