import assert from 'node:assert/strict'
import test from 'node:test'

import type { HubStudioSession } from '@/lib/hub-chat/hub-studio-types'
import { isPackagingFaceReEdit } from '@/lib/packaging/hub-face-steps'

test('isPackagingFaceReEdit detects committed face artwork', () => {
  const session: HubStudioSession = {
    presetId: 'packaging_kit',
    discoveryComplete: true,
    currentStepKey: 'face_left',
    processSteps: [],
    referenceImages: [{ screenKey: 'face_top', screenLabel: 'Top', url: 'https://x/top.png', approvedAt: 1 }],
    briefNotes: {},
    packaging: {
      version: 2,
      dimensionsMm: { length: 200, width: 120, height: 80 },
      faces: {},
      faceSlots: {
        left: { sourceMode: 'generate', url: 'https://x/left.png' },
      },
    },
  }
  assert.equal(isPackagingFaceReEdit(session, 'face_left'), true)
  assert.equal(isPackagingFaceReEdit(session, 'face_front'), false)
})

test('isPackagingFaceReEdit is false before first face commit', () => {
  const session: HubStudioSession = {
    presetId: 'packaging_kit',
    discoveryComplete: true,
    currentStepKey: 'face_left',
    processSteps: [],
    referenceImages: [],
    briefNotes: {},
    packaging: {
      version: 2,
      dimensionsMm: { length: 200, width: 120, height: 80 },
      faces: {},
    },
  }
  assert.equal(isPackagingFaceReEdit(session, 'face_left'), false)
})
