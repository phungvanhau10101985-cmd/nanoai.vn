import assert from 'node:assert/strict'
import test from 'node:test'
import { polygonArea } from './fill-region'
import { closedFaceAt } from './region-face'
import type { WhiteboardObject, WhiteboardPoint } from './types'

function line(id: string, a: WhiteboardPoint, b: WhiteboardPoint): WhiteboardObject {
  return { kind: 'shape', id, shape: 'line', color: '#111827', size: 2, points: [a, b] }
}

test('bốn cạnh khép kín cho một miền', () => {
  const objects = [
    line('a', { x: 0, y: 0 }, { x: 80, y: 0 }),
    line('b', { x: 80, y: 0 }, { x: 80, y: 60 }),
    line('c', { x: 80, y: 60 }, { x: 0, y: 60 }),
    line('d', { x: 0, y: 60 }, { x: 0, y: 0 }),
  ]
  const face = closedFaceAt(objects, { x: 40, y: 30 })
  assert.ok(face)
  assert.ok(Math.abs(polygonArea(face) - 4800) < 2)
  assert.equal(closedFaceAt(objects, { x: 120, y: 30 }), null)
})

test('đường thẳng kéo dài quá đỉnh vẫn tô ô bên trong', () => {
  const objects = [
    line('h1', { x: -20, y: 0 }, { x: 120, y: 0 }),
    line('h2', { x: -20, y: 80 }, { x: 120, y: 80 }),
    line('v1', { x: 0, y: -20 }, { x: 0, y: 100 }),
    line('v2', { x: 100, y: -20 }, { x: 100, y: 100 }),
  ]
  const face = closedFaceAt(objects, { x: 50, y: 40 })
  assert.ok(face)
  assert.ok(Math.abs(polygonArea(face) - 8000) < 2)
  assert.equal(closedFaceAt(objects, { x: -30, y: 40 }), null)
})

test('góc lệch nhẹ vẫn kín', () => {
  const objects = [
    line('a', { x: 0, y: 0 }, { x: 70, y: 0 }),
    line('b', { x: 80, y: 0 }, { x: 80, y: 70 }),
    line('c', { x: 80, y: 80 }, { x: 10, y: 80 }),
    line('d', { x: 0, y: 80 }, { x: 0, y: 10 }),
  ]
  assert.ok(closedFaceAt(objects, { x: 40, y: 40 }))
})

test('ba cạnh hở không tô', () => {
  const objects = [
    line('a', { x: 0, y: 0 }, { x: 0, y: 40 }),
    line('b', { x: 0, y: 40 }, { x: 40, y: 40 }),
    line('c', { x: 40, y: 40 }, { x: 40, y: 0 }),
  ]
  assert.equal(closedFaceAt(objects, { x: 20, y: 20 }), null)
})
