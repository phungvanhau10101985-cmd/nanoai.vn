import assert from 'node:assert/strict'
import test from 'node:test'

import { emptyStudioSession } from '@/lib/hub-chat/hub-studio-types'
import { defaultGenerationReferenceKeys } from '@/lib/hub-chat/hub-studio-generation-refs'
import {
  buildProductLabelPromptBlock,
  parseLabelSizeMm,
  resolveLogoCompositeReference,
  resolveLogoCompositeReferenceUrls,
  resolveProductLabelShape,
  resolveSealStickerAspectRatio,
  resolveSealStickerShape,
  stripLabelTechnicalMeasurementsFromVisualPrompt,
} from '@/lib/packaging/product-label-step'

test('parseLabelSizeMm accepts common formats', () => {
  assert.deepEqual(parseLabelSizeMm('50x80 mm'), { widthMm: 50, heightMm: 80 })
  assert.deepEqual(parseLabelSizeMm('kích thước 60×100'), { widthMm: 60, heightMm: 100 })
  assert.equal(parseLabelSizeMm('no size here'), null)
})

test('label visual prompt excludes parsed dimensions and bleed settings', () => {
  const visualPrompt = stripLabelTechnicalMeasurementsFromVisualPrompt(
    'Create a cosmetics label, exact label size: 300 × 200 mm, bleed 10mm. Keep the brand text "188".'
  )
  assert.doesNotMatch(visualPrompt, /300|200|10mm/i)
  assert.match(visualPrompt, /brand text "188"/i)

  const rules = buildProductLabelPromptBlock('product_label', { aspectRatio: '3:4' })
  assert.doesNotMatch(rules, /300|200/)
  assert.match(rules, /3:4/)
  assert.match(rules, /never draw dimensions/i)
  assert.match(rules, /verbatim in its original language/i)
  assert.match(rules, /Canvas aspect ratio/i)
})

test('product_label step uses logo reference only', () => {
  const session = {
    ...emptyStudioSession(),
    presetId: 'packaging_kit',
    currentStepKey: 'product_label',
    referenceImages: [
      { screenKey: 'logo', screenLabel: 'Logo', url: 'logo.png', approvedAt: 1 },
      { screenKey: 'face_top', screenLabel: 'Top', url: 'top.png', approvedAt: 2 },
    ],
  }
  assert.deepEqual(defaultGenerationReferenceKeys(session, 'packaging_kit', 'product_label'), ['logo'])
})

test('resolveLogoCompositeReference returns approved logo for label generation', () => {
  const session = {
    ...emptyStudioSession(),
    presetId: 'packaging_kit',
    referenceImages: [
      { screenKey: 'logo', screenLabel: 'Logo thương hiệu', url: 'https://cdn/logo.png', approvedAt: 1 },
      { screenKey: 'face_top', screenLabel: 'Top', url: 'https://cdn/top.png', approvedAt: 2 },
    ],
  }
  assert.deepEqual(resolveLogoCompositeReference(session, 'packaging_kit'), {
    screenKey: 'logo',
    screenLabel: 'Logo thương hiệu',
    url: 'https://cdn/logo.png',
  })
  assert.deepEqual(resolveLogoCompositeReferenceUrls(session, 'packaging_kit'), ['https://cdn/logo.png'])
  assert.equal(resolveLogoCompositeReference({ ...session, referenceImages: [] }, 'packaging_kit'), null)
})

test('seal_sticker prompt uses Gemini aspect ratio not mm size', () => {
  const rules = buildProductLabelPromptBlock('seal_sticker', { aspectRatio: '1:1', shape: 'round' })
  assert.match(rules, /1:1/)
  assert.match(rules, /Canvas aspect ratio/i)
  assert.match(rules, /perfect circle/i)
  assert.doesNotMatch(rules, /40\s*[x×]|40\s*mm/i)

  assert.equal(resolveSealStickerAspectRatio({ sealStickerAspectRatio: '4:5' }), '4:5')
  assert.equal(resolveSealStickerAspectRatio({ sealStickerSizeMm: { widthMm: 40, heightMm: 40 } }), '1:1')
  assert.equal(resolveSealStickerShape({ sealStickerShape: 'ellipse' }), 'ellipse')
  assert.equal(resolveProductLabelShape({}), 'rectangle')
})
