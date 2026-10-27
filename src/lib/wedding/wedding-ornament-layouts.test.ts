import assert from 'node:assert/strict'
import test from 'node:test'
import { WEDDING_COVER_PRESETS } from './wedding-cover-presets'
import {
  ORNAMENT_FRAME_PIECES,
  ORNAMENT_LAYOUTS,
  getOrnamentComposition,
  listOrnamentCompositionIds,
  type OrnamentPieceId,
} from './wedding-ornament-layouts'

const EDGE_FLORALS = new Set<OrnamentPieceId>(['butterfly', 'garland', 'sprig', 'peony', 'vine'])

test('ornament layouts keep flowers on the edges and a readable center', () => {
  const layouts = Object.values(ORNAMENT_LAYOUTS)
  assert.ok(layouts.length >= 6)
  const framed = layouts.filter((layout) => layout.layers.some((layer) => ORNAMENT_FRAME_PIECES.has(layer.piece)))
  assert.ok(framed.length >= 3)

  for (const layout of layouts) {
    assert.ok(layout.layers.length >= 3, layout.id)
    assert.ok(layout.pad.left + layout.pad.right <= 48, layout.id)
    assert.ok(layout.pad.top + layout.pad.bottom <= 55, layout.id)
    assert.ok(layout.layers.some((layer) => EDGE_FLORALS.has(layer.piece)), layout.id)
    const photo = layout.photo
    assert.ok(photo.w >= 30 && photo.h >= 24, layout.id)
    assert.ok(photo.x >= 8 && photo.y >= 4 && photo.x + photo.w <= 96 && photo.y + photo.h <= 96, layout.id)

    for (const layer of layout.layers) {
      assert.ok(layer.w > 0 && layer.w <= 120, `${layout.id} ${layer.piece}`)
      assert.ok(layer.x >= -20 && layer.x <= 100, `${layout.id} ${layer.piece}`)
      assert.ok(layer.y >= -20 && layer.y <= 100, `${layout.id} ${layer.piece}`)
      const opacity = layer.opacity ?? 1
      assert.ok(opacity > 0 && opacity <= 1)
      if (!EDGE_FLORALS.has(layer.piece) || opacity < 0.25) continue
      const onEdge = layer.anchor === 'bottom' || layer.x < 18 || layer.y < 14 || layer.x + layer.w > 82 || layer.y > 58
      assert.equal(onEdge, true, `${layout.id} ${layer.piece} sits in the center`)
    }
  }
})

test('each composed cover preset pairs a kit with a layout', () => {
  const ids = listOrnamentCompositionIds()
  assert.ok(ids.length >= 8)
  const composed = WEDDING_COVER_PRESETS.filter((preset) => preset.layout === 'composed')
  assert.equal(composed.length, ids.length)
  for (const preset of composed) {
    const composition = getOrnamentComposition(preset.compositionId)
    assert.ok(composition, preset.id)
    assert.equal(composition.id, preset.id)
    assert.ok(preset.label.vi && preset.label.en && preset.label.zh && preset.label.ja && preset.label.ko)
  }
  assert.equal(getOrnamentComposition('missing'), undefined)
})
