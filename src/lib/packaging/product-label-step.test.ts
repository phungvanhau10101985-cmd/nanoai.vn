import assert from 'node:assert/strict'
import test from 'node:test'

import { emptyStudioSession } from '@/lib/hub-chat/hub-studio-types'
import { defaultGenerationReferenceKeys } from '@/lib/hub-chat/hub-studio-generation-refs'
import {
  buildProductLabelPromptBlock,
  parseLabelSizeMm,
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

  const rules = buildProductLabelPromptBlock({ widthMm: 300, heightMm: 200 }, 'product_label')
  assert.doesNotMatch(rules, /300|200/)
  assert.match(rules, /never draw dimensions/i)
  assert.match(rules, /verbatim in its original language/i)
  assert.match(rules, /API supplies the exact aspect ratio and print dimensions separately/i)
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
