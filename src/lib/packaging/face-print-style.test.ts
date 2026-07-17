import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_FACE_PRINT_STYLE,
  facePrintStylePromptBlock,
  parseFacePrintStyleKey,
  reconcilePackagingProcessSteps,
  resolveFacePrintStyle,
} from '@/lib/packaging/face-print-style'
import { buildStepsFromPreset } from '@/lib/hub-chat/hub-studio-presets'
import type { HubStudioSession } from '@/lib/hub-chat/hub-studio-types'

test('parseFacePrintStyleKey accepts canonical keys and aliases', () => {
  assert.equal(parseFacePrintStyleKey('realistic_photography'), 'realistic_photography')
  assert.equal(parseFacePrintStyleKey('line_art'), 'line_art')
  assert.equal(parseFacePrintStyleKey('Ảnh chụp thật'), 'realistic_photography')
  assert.equal(parseFacePrintStyleKey('màu nước'), 'watercolour_abstract')
})

test('resolveFacePrintStyle defaults when brief missing', () => {
  assert.equal(resolveFacePrintStyle({}), DEFAULT_FACE_PRINT_STYLE)
  assert.equal(resolveFacePrintStyle({ face_print_style: 'line_art' }), 'line_art')
})

test('facePrintStylePromptBlock keeps line art consistent across all faces', () => {
  const block = facePrintStylePromptBlock('line_art')
  assert.match(block, /monochrome outlines/i)
  assert.match(block, /all 6 faces/i)
})

test('reconcilePackagingProcessSteps inserts the visual style step for saved sessions', () => {
  const legacySteps = buildStepsFromPreset('vi', 'packaging_kit').filter(
    (step) => step.key !== 'face_print_style'
  )
  const session: HubStudioSession = {
    projectTitle: 'TSP',
    presetId: 'packaging_kit',
    uploadImages: [],
    briefNotes: { color_palette: 'cam carton' },
    discoveryComplete: false,
    processSteps: legacySteps.map((s) => ({
      ...s,
      status: s.key === 'color_palette' ? 'done' : s.key === 'logo' ? 'pending' : s.status,
    })),
    currentStepKey: 'logo',
    referenceImages: [
      { screenKey: 'face_top', screenLabel: 'Mặt trên', url: 'top', approvedAt: 1 },
      { screenKey: 'face_front', screenLabel: 'Mặt trước', url: 'front', approvedAt: 2 },
    ],
    pendingPreview: null,
    lastGenerationPrompt: null,
    packaging: {
      version: 2,
      layout: 'hybrid_strip',
      dimensionsMm: { length: 100, width: 100, height: 100 },
      faces: {},
    },
  }
  const next = reconcilePackagingProcessSteps(session, 'vi')
  assert.ok(next.processSteps.some((s) => s.key === 'face_print_style'))
  assert.equal(next.currentStepKey, 'face_print_style')
  assert.equal(next.discoveryComplete, false)
  assert.deepEqual(next.referenceImages.map((reference) => reference.screenKey), ['face_top'])
})
