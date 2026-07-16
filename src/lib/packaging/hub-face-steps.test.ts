import assert from 'node:assert/strict'
import test from 'node:test'

import { parseSecondaryFaceIntent } from '@/lib/packaging/hub-face-steps'

test('parseSecondaryFaceIntent: empty on any slot', () => {
  for (const slot of ['top', 'front', 'right', 'bottom', 'back', 'left'] as const) {
    assert.equal(parseSecondaryFaceIntent('bỏ trống', slot), 'empty')
    assert.equal(parseSecondaryFaceIntent('leave blank', slot), 'empty')
  }
})

test('parseSecondaryFaceIntent: copy only on secondary slots', () => {
  assert.equal(parseSecondaryFaceIntent('giống mặt trên', 'bottom'), 'copy')
  assert.equal(parseSecondaryFaceIntent('same as top', 'bottom'), 'copy')
  assert.equal(parseSecondaryFaceIntent('giống mặt trên', 'top'), null)
  assert.equal(parseSecondaryFaceIntent('giống mặt trên', 'front'), null)
})
