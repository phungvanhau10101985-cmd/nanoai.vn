import assert from 'node:assert/strict'
import test from 'node:test'

import { emptyStudioSession } from '@/lib/hub-chat/hub-studio-types'
import {
  buildReferencePreviewsPayload,
  isPackagingCompositeArtifactStepKey,
  shouldShowStudioReferencePreviews,
} from '@/lib/hub-chat/hub-studio-reference-limits'

test('isPackagingCompositeArtifactStepKey matches mockup and dieline only', () => {
  assert.equal(isPackagingCompositeArtifactStepKey('box_mockup_3d'), true)
  assert.equal(isPackagingCompositeArtifactStepKey('box_dieline_pdf'), true)
  assert.equal(isPackagingCompositeArtifactStepKey('face_front'), false)
})

test('buildReferencePreviewsPayload hides previews on mockup step', () => {
  const session = {
    ...emptyStudioSession(),
    currentStepKey: 'box_mockup_3d',
    referenceImages: [
      { screenKey: 'logo', screenLabel: 'Logo', url: 'logo', approvedAt: 1 },
      { screenKey: 'face_top', screenLabel: 'Top', url: 'top', approvedAt: 2 },
    ],
  }
  const payload = buildReferencePreviewsPayload(session)
  assert.deepEqual(payload.referencePreviews, [])
  assert.equal(payload.showReferenceRemove, false)
})

test('buildReferencePreviewsPayload still shows previews on face steps', () => {
  const session = {
    ...emptyStudioSession(),
    currentStepKey: 'face_front',
    referenceImages: [{ screenKey: 'logo', screenLabel: 'Logo', url: 'logo', approvedAt: 1 }],
  }
  const payload = buildReferencePreviewsPayload(session)
  assert.equal(payload.referencePreviews?.length, 1)
  assert.equal(payload.showReferenceRemove, true)
})

test('shouldShowStudioReferencePreviews respects explicit step override', () => {
  const session = {
    ...emptyStudioSession(),
    currentStepKey: 'face_front',
    referenceImages: [],
  }
  assert.equal(shouldShowStudioReferencePreviews(session), true)
  assert.equal(shouldShowStudioReferencePreviews(session, 'box_mockup_3d'), false)
})
