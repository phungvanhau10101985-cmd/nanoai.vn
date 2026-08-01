import assert from 'node:assert/strict'
import test from 'node:test'

import { parseBagDimensions, getBagFaceDimensionsMm } from '@/lib/packaging/bag-dimensions'
import { allBagPrintFacesCommitted } from '@/lib/hub-chat/bag-kit-shared'

test('parseBagDimensions accepts W×H×depth in mm', () => {
  assert.deepEqual(parseBagDimensions('200 × 280 × 60 mm'), {
    ok: true,
    dimensionsMm: { width: 200, height: 280, gusset: 60 },
  })
})

test('parseBagDimensions rejects depth >= height', () => {
  assert.equal(parseBagDimensions('200 × 60 × 280 mm').ok, false)
})

test('front and back share the same print size', () => {
  const dims = { width: 200, height: 280, gusset: 60 }
  assert.deepEqual(getBagFaceDimensionsMm('face_back', dims), [200, 280])
  assert.deepEqual(getBagFaceDimensionsMm('face_front', dims), [200, 280])
  assert.equal(getBagFaceDimensionsMm('face_gusset', dims), null)
})

test('allBagPrintFacesCommitted requires back and front only', () => {
  assert.equal(allBagPrintFacesCommitted({ faceSlots: { back: { sourceMode: 'generate', url: 'a' } } }), false)
  assert.equal(
    allBagPrintFacesCommitted({
      faceSlots: {
        back: { sourceMode: 'generate', url: 'a' },
        front: { sourceMode: 'empty' },
      },
    }),
    true
  )
})
