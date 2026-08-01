import assert from 'node:assert/strict'

import test from 'node:test'



import { emptyStudioSession } from '@/lib/hub-chat/hub-studio-types'

import {

  buildReferencePreviewsPayload,

  filterStaleReferencePreviews,

  isPackagingCompositeArtifactStepKey,

  pickReferencesForGeneration,

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



test('filterStaleReferencePreviews drops references removed from live session', () => {

  const session = {

    ...emptyStudioSession(),

    referenceImages: [{ screenKey: 'logo', screenLabel: 'Logo', url: 'logo', approvedAt: 1 }],

  }

  const previews = [

    { screenKey: 'logo', label: 'Logo', url: 'logo' },

    { screenKey: 'banner_design', label: 'Banner 1', url: 'banner' },

  ]

  assert.deepEqual(filterStaleReferencePreviews(previews, session), [

    { screenKey: 'logo', label: 'Logo', url: 'logo' },

  ])

})



test('pickReferencesForGeneration landing_page uses no style anchor refs', () => {

  const refs = [

    { screenKey: 'landing_full', screenLabel: 'Full', url: 'https://full.png', approvedAt: 1 },

    { screenKey: 'hero_desktop', screenLabel: 'Hero', url: 'https://hero.png', approvedAt: 2 },

  ]

  const none = pickReferencesForGeneration(refs, 'landing_page', 'landing_full')

  assert.deepEqual(none, [])

})

