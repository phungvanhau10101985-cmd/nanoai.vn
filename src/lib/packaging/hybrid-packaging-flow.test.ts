import assert from 'node:assert/strict'
import test from 'node:test'
import { emptyStudioSession } from '@/lib/hub-chat/hub-studio-types'
import { getFlowStep, getFlowSteps } from '@/lib/hub-chat/hub-studio-preset-flows'
import { reconcilePackagingProcessSteps } from './face-print-style'
import { invalidatePackagingFromStep } from './session-dependencies'

test('new packaging flow creates all six faces before mockup and dieline', () => {
  const keys = getFlowSteps('packaging_kit').map((step) => step.key)
  const faceKeys = ['face_top', 'face_front', 'face_right', 'face_bottom', 'face_back', 'face_left']
  assert.deepEqual(keys.filter((key) => faceKeys.includes(key)), faceKeys)
  assert.equal(keys.includes('body_strip'), false)
  assert.ok(keys.indexOf('face_left') < keys.indexOf('box_mockup_3d'))
  assert.ok(keys.indexOf('box_mockup_3d') < keys.indexOf('box_dieline_pdf'))
})

test('legacy six-face definitions and saved process list remain available', () => {
  assert.equal(getFlowStep('packaging_kit', 'face_front')?.generator, 'packaging_face')
  const legacy = {
    ...emptyStudioSession(),
    presetId: 'packaging_kit',
    discoveryComplete: true,
    currentStepKey: 'face_front',
    processSteps: [
      { key: 'face_top', label: 'Top', status: 'done' as const },
      { key: 'face_front', label: 'Front', status: 'in_progress' as const },
      { key: 'face_right', label: 'Right', status: 'pending' as const },
      { key: 'box_dieline_pdf', label: 'Dieline', status: 'pending' as const },
      { key: 'box_mockup_3d', label: 'Mockup', status: 'pending' as const },
    ],
    packaging: { version: 2 as const, dimensionsMm: { length: 100, width: 40, height: 60 }, faces: {} },
  }
  assert.deepEqual(
    reconcilePackagingProcessSteps(legacy, 'en').processSteps.map((step) => step.key),
    legacy.processSteps.map((step) => step.key)
  )
})

test('saved hybrid strip session restarts at front and requires four independent side faces', () => {
  const session = {
    ...emptyStudioSession(),
    presetId: 'packaging_kit',
    discoveryComplete: true,
    currentStepKey: 'box_mockup_3d',
    processSteps: getFlowSteps('packaging_kit')
      .filter((step) => !['face_front', 'face_right', 'face_back', 'face_left'].includes(step.key))
      .map((step) => ({
        key: step.key,
        label: step.key,
        status: step.key === 'box_mockup_3d' ? ('in_progress' as const) : ('done' as const),
      }))
      .concat([{ key: 'body_strip', label: 'Body strip', status: 'done' as const }]),
    packaging: {
      version: 2 as const,
      layout: 'hybrid_strip' as const,
      dimensionsMm: { length: 100, width: 40, height: 60 },
      faces: {},
      bodyStrip: {
        originalUrl: 'strip.png',
        foldOffsetsMm: [100, 140, 240] as [number, number, number],
      },
      faceSlots: {
        top: { sourceMode: 'generate' as const, url: 'top.png' },
        front: { sourceMode: 'generate' as const, url: 'front-slice.png' },
        right: { sourceMode: 'generate' as const, url: 'right-slice.png' },
        back: { sourceMode: 'generate' as const, url: 'back-slice.png' },
        left: { sourceMode: 'generate' as const, url: 'left-slice.png' },
        bottom: { sourceMode: 'generate' as const, url: 'bottom.png' },
      },
      mockupUrl: 'mockup.png',
    },
  }
  const migrated = reconcilePackagingProcessSteps(session, 'vi')
  assert.equal(migrated.packaging?.layout, 'six_faces')
  assert.equal(migrated.currentStepKey, 'face_front')
  assert.equal(migrated.packaging?.faceSlots?.front, undefined)
  assert.equal(migrated.packaging?.faceSlots?.top?.url, 'top.png')
  assert.equal(migrated.packaging?.faceSlots?.bottom?.url, 'bottom.png')
  assert.equal(migrated.packaging?.mockupUrl, undefined)
  assert.equal(migrated.processSteps.find((step) => step.key === 'face_front')?.status, 'in_progress')
})

test('artifact invalidation follows each layout order', () => {
  const base = {
    ...emptyStudioSession(),
    presetId: 'packaging_kit',
    processSteps: [],
    packaging: {
      version: 2 as const,
      dimensionsMm: { length: 100, width: 40, height: 60 },
      faces: {},
      dielineUrl: 'dieline.pdf',
      mockupUrl: 'mockup.png',
    },
  }
  const legacyMockup = invalidatePackagingFromStep(base, 'box_mockup_3d')
  assert.equal(legacyMockup.packaging?.dielineUrl, undefined)

  const hybrid = {
    ...base,
    packaging: {
      ...base.packaging,
      layout: 'hybrid_strip' as const,
      bodyStrip: { originalUrl: 'strip.png', foldOffsetsMm: [100, 140, 240] as [number, number, number] },
      faceSlots: {
        top: { sourceMode: 'generate' as const, url: 'top.png' },
        front: { sourceMode: 'generate' as const, url: 'front.png' },
        right: { sourceMode: 'generate' as const, url: 'right.png' },
        back: { sourceMode: 'generate' as const, url: 'back.png' },
        left: { sourceMode: 'generate' as const, url: 'left.png' },
        bottom: { sourceMode: 'generate' as const, url: 'bottom.png' },
      },
    },
  }
  const invalidated = invalidatePackagingFromStep(hybrid, 'body_strip')
  assert.equal(invalidated.packaging?.faceSlots?.top?.url, 'top.png')
  assert.equal(invalidated.packaging?.faceSlots?.bottom?.url, 'bottom.png')
  assert.equal(invalidated.packaging?.faceSlots?.front, undefined)
  assert.equal(invalidated.packaging?.bodyStrip, undefined)
  assert.equal(invalidated.packaging?.mockupUrl, undefined)
  assert.equal(invalidated.packaging?.dielineUrl, undefined)

  const bottomOnly = invalidatePackagingFromStep(hybrid, 'face_bottom')
  assert.equal(bottomOnly.packaging?.bodyStrip?.originalUrl, 'strip.png')
  assert.equal(bottomOnly.packaging?.faceSlots?.front?.url, 'front.png')
  assert.equal(bottomOnly.packaging?.faceSlots?.bottom, undefined)
})
