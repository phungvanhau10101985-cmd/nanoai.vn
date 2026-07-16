import assert from 'node:assert/strict'
import test from 'node:test'

import { briefNotesForStepGeneration } from '@/lib/hub-chat/hub-studio-preset-flows'
import { pickReferencesForGeneration } from '@/lib/hub-chat/hub-studio-reference-limits'
import { navigateSessionToStep } from '@/lib/hub-chat/hub-studio-step-navigate'
import { resolveStepPendingPreview } from '@/lib/hub-chat/hub-studio-step-preview'
import { emptyStudioSession } from '@/lib/hub-chat/hub-studio-types'

test('briefNotesForStepGeneration on logo excludes downstream face briefs', () => {
  const notes = briefNotesForStepGeneration('packaging_kit', 'logo', {
    brand_name: 'TSP',
    product_type: 'mỹ phẩm',
    color_palette: 'cam, xám',
    logo: 'Logo tối giản chữ TSP',
    face_front: 'Mặt trước có hoa',
    face_top: 'Mặt trên gold foil',
  })
  assert.equal(notes.brand_name, 'TSP')
  assert.equal(notes.logo, 'Logo tối giản chữ TSP')
  assert.equal(notes.face_front, undefined)
  assert.equal(notes.face_top, undefined)
})

test('navigate to logo restores pending preview from approved reference', () => {
  let session = {
    ...emptyStudioSession(),
    presetId: 'packaging_kit',
    discoveryComplete: true,
    currentStepKey: 'box_face_confirm',
    briefNotes: { logo: 'Logo cam tối giản' },
    processSteps: [
      { key: 'logo', label: 'Logo', status: 'done' as const },
      { key: 'face_top', label: 'Top', status: 'in_progress' as const },
    ],
    referenceImages: [
      {
        screenKey: 'logo',
        screenLabel: 'Logo',
        url: 'https://example.com/logo.png',
        approvedAt: 1,
      },
    ],
    pendingPreview: null,
  }

  session = navigateSessionToStep(session, 'packaging_kit', 'logo')
  assert.equal(session.currentStepKey, 'logo')
  assert.equal(session.pendingPreview?.screenKey, 'logo')
  assert.equal(session.pendingPreview?.url, 'https://example.com/logo.png')
  assert.match(session.pendingPreview?.generationPrompt ?? '', /Logo cam tối giản/)
})

test('logo generation attaches no reference images from later steps', () => {
  const refs = pickReferencesForGeneration(
    [
      { screenKey: 'logo', screenLabel: 'Logo', url: 'logo', approvedAt: 1 },
      { screenKey: 'face_top', screenLabel: 'Top', url: 'top', approvedAt: 2 },
    ],
    'packaging_kit',
    'logo'
  )
  assert.equal(refs.length, 0)
})

test('navigate to face_top restores pending preview from faceSlots', () => {
  let session = {
    ...emptyStudioSession(),
    presetId: 'packaging_kit',
    discoveryComplete: true,
    currentStepKey: 'face_front',
    briefNotes: { face_top: 'Nắp gold foil' },
    processSteps: [
      { key: 'face_top', label: 'Top', status: 'done' as const },
      { key: 'face_front', label: 'Front', status: 'in_progress' as const },
    ],
    referenceImages: [],
    packaging: {
      version: 2 as const,
      dimensionsMm: { length: 200, width: 100, height: 50 },
      faces: {},
      faceSlots: {
        top: { sourceMode: 'generate' as const, url: 'https://example.com/top.png' },
      },
    },
    pendingPreview: null,
  }

  session = navigateSessionToStep(session, 'packaging_kit', 'face_top')
  assert.equal(session.pendingPreview?.screenKey, 'face_top')
  assert.equal(session.pendingPreview?.url, 'https://example.com/top.png')
})

test('resolveStepPendingPreview restores mockup from packaging state', () => {
  const session = {
    ...emptyStudioSession(),
    presetId: 'packaging_kit',
    processSteps: [{ key: 'box_mockup_3d', label: '3D', status: 'done' as const }],
    referenceImages: [],
    packaging: {
      version: 2 as const,
      dimensionsMm: { length: 200, width: 100, height: 50 },
      faces: {},
      mockupUrl: 'https://example.com/mockup.png',
    },
  }
  const pending = resolveStepPendingPreview(session, 'packaging_kit', 'box_mockup_3d')
  assert.equal(pending?.url, 'https://example.com/mockup.png')
})

test('face_top generation excludes refs from later face steps', () => {
  const refs = pickReferencesForGeneration(
    [
      { screenKey: 'logo', screenLabel: 'Logo', url: 'logo', approvedAt: 1 },
      { screenKey: 'face_top', screenLabel: 'Top', url: 'top', approvedAt: 2 },
      { screenKey: 'face_front', screenLabel: 'Front', url: 'front', approvedAt: 3 },
    ],
    'packaging_kit',
    'face_top'
  )
  assert.equal(refs.length, 2)
  assert.equal(refs[0]?.screenKey, 'logo')
  assert.equal(refs[1]?.screenKey, 'face_top')
})
