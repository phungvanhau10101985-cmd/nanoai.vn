import assert from 'node:assert/strict'
import test from 'node:test'

import {
  resolveDielineFaceUrls,
  resolveDielineSlotUrls,
  type BoxCreatedFace,
} from '@/lib/packaging/box-face-slots'

function face(
  slot: BoxCreatedFace['slot'],
  sourceMode: BoxCreatedFace['sourceMode'],
  url: string | null
): BoxCreatedFace {
  const sizeKey = slot === 'top' || slot === 'bottom' ? 'LxW' : slot === 'front' || slot === 'back' ? 'LxH' : 'WxH'
  return { id: slot, slot, sizeKey, sourceMode, url }
}

test('resolveDielineSlotUrls keeps each face separate — empty bottom does not borrow top', () => {
  const faces: BoxCreatedFace[] = [
    face('top', 'generate', 'https://example.com/top.png'),
    face('front', 'generate', 'https://example.com/front.png'),
    face('right', 'generate', 'https://example.com/right.png'),
    face('bottom', 'empty', null),
    face('back', 'generate', 'https://example.com/back.png'),
    face('left', 'generate', 'https://example.com/left.png'),
  ]
  const slots = resolveDielineSlotUrls(faces)
  assert.equal(slots.top, 'https://example.com/top.png')
  assert.equal(slots.bottom, undefined)
  assert.equal(slots.front, 'https://example.com/front.png')
  assert.equal(slots.back, 'https://example.com/back.png')
  assert.equal(slots.right, 'https://example.com/right.png')
  assert.equal(slots.left, 'https://example.com/left.png')
})

test('resolveDielineFaceUrls still falls back per dimension group for readiness checks', () => {
  const faces: BoxCreatedFace[] = [
    face('top', 'generate', 'https://example.com/top.png'),
    face('front', 'generate', 'https://example.com/front.png'),
    face('right', 'generate', 'https://example.com/right.png'),
    face('bottom', 'empty', null),
  ]
  const grouped = resolveDielineFaceUrls(faces)
  assert.equal(grouped.LxW, 'https://example.com/top.png')
  assert.equal(grouped.LxH, 'https://example.com/front.png')
  assert.equal(grouped.WxH, 'https://example.com/right.png')
})

test('resolveDielineSlotUrls resolves explicit copy from primary face', () => {
  const faces: BoxCreatedFace[] = [
    face('top', 'generate', 'https://example.com/top.png'),
    face('bottom', 'copy', null),
    face('front', 'generate', 'https://example.com/front.png'),
    face('right', 'generate', 'https://example.com/right.png'),
  ]
  const slots = resolveDielineSlotUrls(faces)
  assert.equal(slots.bottom, 'https://example.com/top.png')
})
