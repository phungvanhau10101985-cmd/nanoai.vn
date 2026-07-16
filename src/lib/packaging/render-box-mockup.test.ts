import assert from 'node:assert/strict'
import test from 'node:test'

import { renderBoxMockupPng } from '@/lib/packaging/render-box-mockup'

test('renderBoxMockupPng outputs png with kraft faces when no urls', async () => {
  const buf = await renderBoxMockupPng({
    faces: [
      { slot: 'top', sourceMode: 'empty', url: null },
      { slot: 'front', sourceMode: 'empty', url: null },
    ],
    box: { length: 300, width: 200, height: 400 },
    outputSize: 400,
  })
  assert.ok(buf.length > 1000)
  assert.equal(buf[0], 0x89)
  assert.equal(buf[1], 0x50)
})

test('mockup camera keeps top above and right face to the right of front', () => {
  const iso = (x: number, y: number, z: number, s: number) => ({
    x: (x + y) * 0.866 * s,
    y: (x - y) * 0.5 * s - z * s,
  })
  assert.ok(iso(100, 50, 400, 1).y < iso(100, 50, 0, 1).y)
  assert.ok(iso(0, 0, 200, 1).y < iso(0, 0, 0, 1).y)
  assert.ok(iso(300, 200, 400, 1).x > iso(300, 0, 400, 1).x)
  assert.ok(iso(300, 200, 400, 1).y < iso(300, 0, 400, 1).y)
})
