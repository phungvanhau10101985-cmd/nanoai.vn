import assert from 'node:assert/strict'
import test from 'node:test'

import { getActiveStepKey } from '@/lib/hub-chat/hub-studio-preset-intent'
import { emptyStudioSession, type HubStudioSession } from '@/lib/hub-chat/hub-studio-types'
import { navigateSessionToStep } from '@/lib/hub-chat/hub-studio-step-navigate'

function sessionAtFaceLeft(): HubStudioSession {
  return {
    ...emptyStudioSession(),
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

test('getActiveStepKey stays on edited face when navigated back', () => {
  let session = sessionAtFaceLeft()
  session = navigateSessionToStep(session, 'packaging_kit', 'face_back')
  session = {
    ...session,
    processSteps: session.processSteps.map((step) =>
      step.key === 'face_back' ? { ...step, status: 'done' as const } : step
    ),
  }
  assert.equal(getActiveStepKey(session), 'face_back')
})

test('getActiveStepKey ignores stale done mockup preview when workflow moved on', () => {
  const session: HubStudioSession = {
    ...emptyStudioSession(),
    presetId: 'packaging_kit',
    discoveryComplete: true,
    currentStepKey: 'box_dieline_pdf',
    processSteps: [
      { key: 'face_top', label: 'Top', status: 'done' },
      { key: 'box_mockup_3d', label: 'Mockup', status: 'done' },
      { key: 'box_dieline_pdf', label: 'Dieline', status: 'in_progress' },
    ],
    referenceImages: [],
    briefNotes: {},
    pendingPreview: {
      screenKey: 'box_mockup_3d',
      screenLabel: 'Mockup',
      url: 'https://example.com/mockup-old.png',
      generationPrompt: 'mockup',
    },
  }
  assert.equal(getActiveStepKey(session), 'box_dieline_pdf')
})
