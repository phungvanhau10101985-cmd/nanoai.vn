import assert from 'node:assert/strict'
import test from 'node:test'
import { dist } from './geometry'
import { nearestTriangleVertex, triangleLinePoints } from './triangle-line'
import type { WhiteboardObject } from './types'

const right = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 0, y: 8 }]

test('trung tuyến từ A tới trung điểm BC', () => {
  const pts = triangleLinePoints('median', 0, right)
  assert.ok(pts)
  assert.deepEqual(pts![1], { x: 3, y: 4 })
})

test('đường cao từ C vuông góc AB', () => {
  const pts = triangleLinePoints('altitude', 2, right)
  assert.ok(pts)
  assert.ok(Math.abs(pts![1].y) < 1e-6)
  assert.ok(Math.abs(pts![1].x) < 1e-6)
})

test('đỉnh tam giác bấm trúng trong ngưỡng', () => {
  const objects: WhiteboardObject[] = [{
    kind: 'shape', id: 't', shape: 'triangle', color: '#111', size: 3, points: right,
  }]
  const hit = nearestTriangleVertex(objects, { x: 0.4, y: 7.6 }, 1)
  assert.equal(hit?.vertex, 2)
  assert.equal(hit?.triangleId, 't')
  assert.equal(nearestTriangleVertex(objects, { x: 3, y: 3 }, 0.4), null)
  assert.ok(dist(right[2], { x: 0, y: 8 }) === 0)
})
