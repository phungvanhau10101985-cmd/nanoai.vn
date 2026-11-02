import assert from 'node:assert/strict'
import test from 'node:test'
import { decideOrnamentPickerTap, ornamentPickerConfirmSrc, ORNAMENT_PICKER_TAP_SLOP_PX } from './wedding-ornament-picker'

test('a light tap on a tile only selects that flower', () => {
  assert.deepEqual(decideOrnamentPickerTap({ src: '/wedding/gold-rose.png', movedPx: 3 }), {
    kind: 'select',
    src: '/wedding/gold-rose.png',
  })
})

test('a scroll or drag across the catalog does not select a flower', () => {
  assert.deepEqual(
    decideOrnamentPickerTap({ src: '/wedding/gold-rose.png', movedPx: ORNAMENT_PICKER_TAP_SLOP_PX + 1 }),
    { kind: 'idle' },
  )
})

test('confirm adds only after a flower is selected', () => {
  assert.equal(ornamentPickerConfirmSrc(null), null)
  assert.equal(ornamentPickerConfirmSrc('   '), null)
  assert.equal(ornamentPickerConfirmSrc('/wedding/gold-rose.png'), '/wedding/gold-rose.png')
})
