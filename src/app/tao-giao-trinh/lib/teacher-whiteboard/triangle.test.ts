import assert from 'node:assert/strict'
import test from 'node:test'
import { dist } from './geometry'
import { fillTriangleSides, guessTriangleKind, placeTriangle, triangleSideError } from './triangle'

test('đoán tam giác đều và vuông 3-4-5', () => {
  assert.equal(guessTriangleKind(5, 5, 5), 'equilateral')
  assert.equal(guessTriangleKind(5, 4, 3), 'right')
  assert.equal(guessTriangleKind(5, 4, 4), 'isosceles')
})

test('tam giác đều điền đủ ba cạnh', () => {
  assert.deepEqual(fillTriangleSides('equilateral', { ab: '6', bc: '', ca: '' }, 'ab'), { ab: '6', bc: '6', ca: '6' })
})

test('dựng tam giác có một cạnh song song trục hoành', () => {
  const sketch = [{ x: 40, y: 10 }, { x: 5, y: 80 }, { x: 90, y: 70 }]
  const tilted = placeTriangle({ kind: 'isosceles', ab: '5', bc: '6', ca: '5' }, sketch)
  assert.ok(tilted)
  assert.ok(Math.abs(tilted![1].y - tilted![2].y) < 1e-6)
  const right = placeTriangle({ kind: 'right', ab: '5', bc: '4', ca: '3' }, sketch)
  assert.ok(right)
  assert.ok(Math.abs(right![1].y - right![2].y) < 1e-6)
  assert.ok(Math.abs(right![0].x - right![2].x) < 1e-6)
  const ab = dist(right![0], right![1])
  const ca = dist(right![2], right![0])
  assert.ok(Math.abs(ab / ca - 5 / 3) < 0.05)
  assert.equal(triangleSideError('right', { ab: '5', bc: '4', ca: '3' }), null)
  assert.equal(triangleSideError('right', { ab: '6', bc: '4', ca: '3' }), 'right')
})
