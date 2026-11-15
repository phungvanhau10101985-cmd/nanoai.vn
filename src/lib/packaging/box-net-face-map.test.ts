import assert from 'node:assert/strict'
import test from 'node:test'
import { applyBoxNetFaceMap, normalizeBoxNetFaceMap } from './box-net-face-map'

test('net face map keeps the source face and places it on the chosen panel', () => {
  const slots = {
    top: { sourceMode: 'generate' as const, url: 'top.png' },
    front: { sourceMode: 'generate' as const, url: 'front.png' },
    back: { sourceMode: 'empty' as const },
  }
  const mapped = applyBoxNetFaceMap(slots, { top: 'front' })
  assert.equal(mapped.top?.url, 'front.png')
  assert.equal(mapped.front?.url, 'front.png')
  assert.equal(slots.top.url, 'top.png')
  assert.deepEqual(normalizeBoxNetFaceMap({ top: 'front', front: 'front', left: 'nope' }), {
    top: 'front',
  })
})
