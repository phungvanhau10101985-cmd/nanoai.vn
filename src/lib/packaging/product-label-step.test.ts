import assert from 'node:assert/strict'
import test from 'node:test'

import { emptyStudioSession } from '@/lib/hub-chat/hub-studio-types'
import { defaultGenerationReferenceKeys } from '@/lib/hub-chat/hub-studio-generation-refs'
import { parseLabelSizeMm } from '@/lib/packaging/product-label-step'

test('parseLabelSizeMm accepts common formats', () => {
  assert.deepEqual(parseLabelSizeMm('50x80 mm'), { widthMm: 50, heightMm: 80 })
  assert.deepEqual(parseLabelSizeMm('kích thước 60×100'), { widthMm: 60, heightMm: 100 })
  assert.equal(parseLabelSizeMm('no size here'), null)
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
