import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildPackagingColorPaletteBriefFromDiscovery,
  buildPackagingStyleBriefFromDiscovery,
  formatPackagingColorPaletteBlock,
  formatPackagingStyleBriefBlock,
  appendPackagingFaceOneStylePrompt,
  packagingStyleDiscoveryExcludeKeys,
  PACKAGING_STYLE_DISCOVERY_KEYS,
  resolvePackagingColorPaletteBrief,
} from '@/lib/packaging/packaging-style-brief'
import { emptyStudioSession } from '@/lib/hub-chat/hub-studio-types'
import {
  defaultGenerationReferenceKeys,
  resolveGenerationAttachments,
} from '@/lib/hub-chat/hub-studio-generation-refs'
import { getStepGenerator } from '@/lib/hub-chat/hub-studio-presets'

test('buildPackagingColorPaletteBriefFromDiscovery includes palette only', () => {
  const brief = buildPackagingColorPaletteBriefFromDiscovery({
    style_mood: 'minimal',
    color_palette: 'warm_terracotta',
    face_print_style: 'flat_illustration',
  })
  assert.match(brief, /Color palette:/i)
  assert.doesNotMatch(brief, /Mood:/i)
  assert.doesNotMatch(brief, /Print treatment:/i)
})

test('resolvePackagingColorPaletteBrief prefers discovery color_palette', () => {
  const session = {
    ...emptyStudioSession(),
    briefNotes: { color_palette: 'warm_terracotta', style_mood: 'minimal' },
    packaging: {
      version: 2 as const,
      dimensionsMm: null,
      faces: {},
      packagingStyleBrief: 'Mood: playful\nColor palette: cool blue\nPrint treatment: line art',
    },
  }
  const brief = resolvePackagingColorPaletteBrief(session)
  assert.match(brief, /Color palette:/i)
  assert.doesNotMatch(brief, /Print treatment/i)
})

test('appendPackagingFaceOneStylePrompt uses discovery style only', () => {
  const session = {
    ...emptyStudioSession(),
    briefNotes: {
      style_mood: 'minimal',
      color_palette: 'warm_terracotta',
      face_print_style: 'flat_illustration',
    },
    packaging: {
      version: 2 as const,
      dimensionsMm: null,
      faces: {},
      packagingStyleBrief: 'Warm organic illustration from mood board.',
      packagingStyleBriefSource: 'reference_image' as const,
      styleReferenceUrl: 'https://example.com/style.png',
    },
  }
  const prompt = appendPackagingFaceOneStylePrompt('Base prompt', session)
  assert.match(prompt, /brand discovery/i)
  assert.match(prompt, /Mood:/i)
  assert.doesNotMatch(prompt, /reference image analysis/i)
  assert.match(prompt, /Composite attached LOGO and product photo/i)
})

test('formatPackagingColorPaletteBlock prioritizes primary face reference', () => {
  const block = formatPackagingColorPaletteBlock('Color palette: warm terracotta', {
    referenceImagePriority: 'primary_face',
    matchPrimaryFaceArtwork: true,
  })
  assert.match(block, /PRIMARY FACE #1/i)
})

test('buildPackagingStyleBriefFromDiscovery includes mood palette and print style', () => {
  const brief = buildPackagingStyleBriefFromDiscovery({
    style_mood: 'minimal',
    color_palette: 'warm_terracotta',
    face_print_style: 'flat_illustration',
  })
  assert.match(brief, /Mood:/i)
  assert.match(brief, /Color palette:/i)
  assert.match(brief, /Print treatment:/i)
})

test('packagingStyleDiscoveryExcludeKeys when packagingStyleBrief exists', () => {
  const session = {
    ...emptyStudioSession(),
    packaging: {
      version: 2 as const,
      dimensionsMm: null,
      faces: {},
      packagingStyleBrief: 'Shared style for six faces.',
    },
  }
  assert.deepEqual(packagingStyleDiscoveryExcludeKeys(session), [...PACKAGING_STYLE_DISCOVERY_KEYS])
})

test('face_front generation refs default to logo and primary face style anchor', () => {
  const session = {
    ...emptyStudioSession(),
    presetId: 'packaging_kit',
    currentStepKey: 'face_front',
    referenceImages: [{ screenKey: 'logo', screenLabel: 'Logo', url: 'logo', approvedAt: 1 }],
    packaging: {
      version: 2 as const,
      dimensionsMm: { length: 200, width: 150, height: 100 },
      faces: {},
      faceSlots: {
        top: { sourceMode: 'generate' as const, url: 'top-url' },
      },
    },
  }
  assert.deepEqual(defaultGenerationReferenceKeys(session, 'packaging_kit', 'face_front'), [
    'logo',
    'face_top',
  ])
  const { referenceUrls } = resolveGenerationAttachments(
    session,
    'packaging_kit',
    getStepGenerator('packaging_kit', 'face_front'),
    'face_front'
  )
  assert.deepEqual(referenceUrls, ['logo', 'top-url'])
})

test('face_top generation refs default to logo only', () => {
  const session = {
    ...emptyStudioSession(),
    presetId: 'packaging_kit',
    currentStepKey: 'face_top',
    referenceImages: [{ screenKey: 'logo', screenLabel: 'Logo', url: 'logo', approvedAt: 1 }],
  }
  assert.deepEqual(defaultGenerationReferenceKeys(session, 'packaging_kit', 'face_top'), ['logo'])
})

test('formatPackagingStyleBriefBlock marks reference vs discovery source', () => {
  const refBlock = formatPackagingStyleBriefBlock('Warm terracotta palette.', 'reference_image')
  assert.match(refBlock, /reference image analysis/i)
  const discoveryBlock = formatPackagingStyleBriefBlock('Minimal clean palette.', 'discovery')
  assert.match(discoveryBlock, /brand discovery/i)
  const matchBlock = formatPackagingStyleBriefBlock('Warm terracotta palette.', 'discovery', {
    matchPrimaryFaceArtwork: true,
  })
  assert.match(matchBlock, /PRIMARY FACE #1/i)
})
