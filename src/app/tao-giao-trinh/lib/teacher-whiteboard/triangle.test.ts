import assert from 'node:assert/strict'
import test from 'node:test'
import { dist } from './geometry'
import { fillTriangleSides, guessTriangleKind, placeTriangle, roundSideLengths, triangleSideError } from './triangle'

test('đoán tam giác đều và vuông 3-4-5', () => {
  assert.equal(guessTriangleKind(5, 5, 5), 'equilateral')
  assert.equal(guessTriangleKind(5, 4, 3), 'right')
  assert.equal(guessTriangleKind(5, 4, 4), 'isosceles')
})

test('cạnh vẽ tay làm tròn số nguyên', () => {
  assert.deepEqual(roundSideLengths({ ab: '100.6', bc: '80.2', ca: '60.4' }), { ab: '101', bc: '80', ca: '60' })
  const fixed = roundSideLengths({ ab: '2.4', bc: '3.4', ca: '5.6' })
  const ab = Number(fixed.ab)
  const bc = Number(fixed.bc)
  const ca = Number(fixed.ca)
  assert.ok(ab + bc > ca && ab + ca > bc && bc + ca > ab)
})

test('tam giác đều điền đủ ba cạnh', () => {
  assert.deepEqual(fillTriangleSides('equilateral', { ab: '6', bc: '', ca: '' }, 'ab'), { ab: '6', bc: '6', ca: '6' })
})

test('tam giác vuông tự tính cạnh huyền từ hai cạnh góc vuông', () => {
  const right = fillTriangleSides('right', { ab: '3', bc: '2', ca: '2' }, 'bc')
  assert.equal(right.bc, '2')
  assert.equal(right.ca, '2')
  assert.equal(right.ab, '2.828')
  assert.equal(triangleSideError('right', right), null)
  assert.equal(fillTriangleSides('right', { ab: '9', bc: '3', ca: '4' }, 'ca').ab, '5')
  const iso = fillTriangleSides('isosceles', { ab: '5', bc: '6', ca: '1' }, 'ab')
  assert.equal(iso.ca, '5')
  assert.equal(iso.ab, '5')
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
  const bc = dist(right![1], right![2])
  const ca = dist(right![2], right![0])
  assert.ok(Math.abs(ab - 5) < 1e-6)
  assert.ok(Math.abs(bc - 4) < 1e-6)
  assert.ok(Math.abs(ca - 3) < 1e-6)
  assert.ok(Math.abs(dist(tilted![0], tilted![1]) - 5) < 1e-6)
  assert.ok(Math.abs(dist(tilted![1], tilted![2]) - 6) < 1e-6)
  assert.equal(triangleSideError('right', { ab: '5', bc: '4', ca: '3' }), null)
  assert.equal(triangleSideError('right', { ab: '6', bc: '4', ca: '3' }), 'right')
})
