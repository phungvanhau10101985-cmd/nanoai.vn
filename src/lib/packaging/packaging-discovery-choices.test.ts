import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getPackagingDiscoveryInputKind,
  resolvePackagingPrintColors,
} from '@/lib/packaging/packaging-discovery-choices'

test('packaging discovery steps map to the correct bottom input', () => {
  assert.equal(getPackagingDiscoveryInputKind('brand_name'), 'chat')
  assert.equal(getPackagingDiscoveryInputKind('product_type'), 'print_language_picker')
  assert.equal(getPackagingDiscoveryInputKind('box_size'), 'box_dimensions')
  assert.equal(getPackagingDiscoveryInputKind('box_face_confirm'), 'box_face_confirm')
  assert.equal(
    getPackagingDiscoveryInputKind('box_face_confirm', { reenteringBoxSize: true }),
    'box_dimensions'
  )
  assert.equal(getPackagingDiscoveryInputKind('style_mood'), 'style_mood_picker')
  assert.equal(getPackagingDiscoveryInputKind('color_palette'), 'color_palette_picker')
  assert.equal(getPackagingDiscoveryInputKind('face_print_style'), 'face_print_style_picker')
})

test('packaging print colors resolve uniquely from keys', () => {
  const colors = resolvePackagingPrintColors(['white', 'gold', 'white', 'unknown', 'blue'])
  assert.equal(colors.length, 3)
  assert.deepEqual(
    colors.map((c) => c.key),
    ['white', 'gold', 'blue']
  )
})
