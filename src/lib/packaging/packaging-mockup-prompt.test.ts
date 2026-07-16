import assert from 'node:assert/strict'
import test from 'node:test'

import { buildPackagingMockupRefsAndMapping } from '@/lib/packaging/packaging-mockup-prompt'
import type { BoxCreatedFace } from '@/lib/packaging/box-face-slots'

function face(
  slot: BoxCreatedFace['slot'],
  sourceMode: BoxCreatedFace['sourceMode'],
  url: string | null
): BoxCreatedFace {
  const sizeKey = slot === 'top' || slot === 'bottom' ? 'LxW' : slot === 'front' || slot === 'back' ? 'LxH' : 'WxH'
  return { id: slot, slot, sizeKey, sourceMode, url }
}

test('mockup refs use each face slot — no logo, empty bottom stays empty', () => {
  const faces: BoxCreatedFace[] = [
    face('top', 'generate', 'https://example.com/top.png'),
    face('front', 'generate', 'https://example.com/front.png'),
    face('right', 'generate', 'https://example.com/right.png'),
    face('bottom', 'empty', null),
    face('back', 'generate', 'https://example.com/back.png'),
    face('left', 'generate', 'https://example.com/left.png'),
  ]
  const { refUrls, mappingBlock, resolvedFaces } = buildPackagingMockupRefsAndMapping(faces, {
    length: 300,
    width: 200,
    height: 400,
  })
  assert.equal(refUrls.length, 5)
  assert.deepEqual(
    resolvedFaces.map((f) => f.slot),
    ['top', 'front', 'right', 'back', 'left']
  )
  assert.equal(refUrls.includes('https://example.com/top.png'), true)
  assert.equal(refUrls.includes('https://example.com/back.png'), true)
  assert.match(mappingBlock, /Image 1 → TOP FACE/)
  assert.match(mappingBlock, /BOTTOM/)
  assert.match(mappingBlock, /Plain unprinted kraft/)
  assert.match(mappingBlock, /NOT from logo alone/)
})

test('mockup mapping lists distinct image index per face', () => {
  const faces: BoxCreatedFace[] = [
    face('top', 'generate', 'https://example.com/top.png'),
    face('front', 'generate', 'https://example.com/front.png'),
    face('right', 'generate', 'https://example.com/right.png'),
  ]
  const { mappingBlock } = buildPackagingMockupRefsAndMapping(faces, {
    length: 100,
    width: 80,
    height: 50,
  })
  assert.match(mappingBlock, /Image 1 → TOP FACE/)
  assert.match(mappingBlock, /Image 2 → FRONT FACE/)
  assert.match(mappingBlock, /Image 3 → RIGHT FACE/)
})
