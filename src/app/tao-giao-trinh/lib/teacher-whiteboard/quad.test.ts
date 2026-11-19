import assert from 'node:assert/strict'
import test from 'node:test'
import { dist } from './geometry'
import { angleAtCorner, fillQuadSides, guessQuadKind, orientTrapezoid, placeQuad, quadSideError } from './quad'
import type { WhiteboardPoint } from './types'

function cosAtA(pts: WhiteboardPoint[]): number {
  const u = { x: pts[1].x - pts[0].x, y: pts[1].y - pts[0].y }
  const v = { x: pts[3].x - pts[0].x, y: pts[3].y - pts[0].y }
  return (u.x * v.x + u.y * v.y) / ((Math.hypot(u.x, u.y) || 1) * (Math.hypot(v.x, v.y) || 1))
}

test('đoán vuông, chữ nhật, thoi, bình hành', () => {
  assert.equal(guessQuadKind([{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 }, { x: 0, y: 40 }]), 'square')
  assert.equal(guessQuadKind([{ x: 0, y: 0 }, { x: 80, y: 0 }, { x: 80, y: 30 }, { x: 0, y: 30 }]), 'rectangle')
  assert.equal(guessQuadKind([{ x: 0, y: 20 }, { x: 60, y: 0 }, { x: 120, y: 20 }, { x: 60, y: 40 }]), 'rhombus')
  assert.equal(guessQuadKind([{ x: 0, y: 0 }, { x: 80, y: 0 }, { x: 110, y: 40 }, { x: 30, y: 40 }]), 'parallelogram')
})

test('hình vuông và chữ nhật có một cạnh nằm ngang', () => {
  const sketch = [{ x: 10, y: 80 }, { x: 70, y: 20 }, { x: 120, y: 90 }, { x: 40, y: 140 }]
  const square = placeQuad({ kind: 'square', ab: '5', bc: '5', cd: '5', da: '5', angle: '90' }, sketch)
  assert.ok(square)
  assert.ok(Math.abs(square![0].y - square![1].y) < 1e-6)
  assert.ok(Math.abs(square![1].x - square![2].x) < 1e-6)
  assert.ok(Math.abs(dist(square![0], square![1]) - 5) < 1e-6)
  const rect = placeQuad({ kind: 'rectangle', ab: '8', bc: '3', cd: '8', da: '3', angle: '90' }, sketch)
  assert.ok(rect)
  assert.ok(Math.abs(rect![0].y - rect![1].y) < 1e-6)
  assert.ok(Math.abs(rect![1].x - rect![2].x) < 1e-6)
  assert.ok(Math.abs(dist(rect![0], rect![1]) - 8) < 1e-6)
  assert.ok(Math.abs(dist(rect![1], rect![2]) - 3) < 1e-6)
  const mid = {
    x: (square![0].x + square![1].x + square![2].x + square![3].x) / 4,
    y: (square![0].y + square![1].y + square![2].y + square![3].y) / 4,
  }
  assert.ok(Math.abs(mid.x - 60) < 1e-6)
  assert.ok(Math.abs(mid.y - 82.5) < 1e-6)
})

test('hình bình hành có cạnh đáy nằm ngang', () => {
  const sketch = [{ x: 0, y: 10 }, { x: 40, y: 0 }, { x: 70, y: 30 }, { x: 20, y: 50 }]
  const pts = placeQuad({ kind: 'parallelogram', ab: '6', bc: '4', cd: '6', da: '4', angle: '60' }, sketch)
  assert.ok(pts)
  assert.ok(Math.abs(pts![0].y - pts![1].y) < 1e-6)
  assert.ok(Math.abs(dist(pts![0], pts![1]) - 6) < 1e-6)
  assert.ok(Math.abs(dist(pts![0], pts![3]) - 4) < 1e-6)
  assert.ok(Math.abs(cosAtA(pts!) - Math.cos((60 * Math.PI) / 180)) < 1e-6)
  assert.equal(quadSideError('parallelogram', { ab: '6', bc: '4', cd: '6', da: '4' }, '60'), null)
  assert.equal(quadSideError('parallelogram', { ab: '6', bc: '4', cd: '5', da: '4' }, '60'), 'opposite')
})

test('hình thoi để đường chéo nằm ngang', () => {
  const sketch = [{ x: 20, y: 20 }, { x: 80, y: 10 }, { x: 90, y: 70 }, { x: 30, y: 80 }]
  const pts = placeQuad({ kind: 'rhombus', ab: '10', bc: '10', cd: '10', da: '10', angle: '60' }, sketch)
  assert.ok(pts)
  assert.ok(Math.abs(pts![0].y - pts![2].y) < 1e-6)
  assert.ok(Math.abs(pts![1].x - pts![3].x) < 1e-6)
  assert.ok(Math.abs(pts![0].y - pts![1].y) > 1)
  assert.ok(Math.abs(dist(pts![0], pts![1]) - 10) < 1e-6)
  assert.ok(Math.abs(cosAtA(pts!) - 0.5) < 1e-6)
  assert.equal(angleAtCorner([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]), 90)
  assert.deepEqual(fillQuadSides('rhombus', { ab: '6', bc: '4', cd: '5', da: '3' }, 'ab'), { ab: '6', bc: '6', cd: '6', da: '6' })
  assert.deepEqual(fillQuadSides('rectangle', { ab: '8', bc: '3', cd: '7', da: '2' }, 'ab'), { ab: '8', bc: '3', cd: '8', da: '3' })
})

test('hình thang đúng một cặp đáy song song và dựng được cả khi cao', () => {
  const trap = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 80, y: 40 }, { x: 20, y: 40 }]
  assert.equal(guessQuadKind(trap), 'trapezoid')
  assert.equal(guessQuadKind([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 40 }, { x: 20, y: 40 }]), 'trapezoid')
  assert.equal(guessQuadKind([{ x: 0, y: 0 }, { x: 80, y: 0 }, { x: 110, y: 40 }, { x: 30, y: 40 }]), 'parallelogram')
  const turned = orientTrapezoid([trap[1], trap[2], trap[3], trap[0]])
  assert.ok(turned)
  assert.ok(dist(turned![0], turned![1]) + 1e-6 >= dist(turned![2], turned![3]))
  const sketch = [{ x: 10, y: 30 }, { x: 90, y: 10 }, { x: 70, y: 80 }, { x: 20, y: 70 }]
  const pts = placeQuad({ kind: 'trapezoid', ab: '100', bc: '1', cd: '60', da: '1', angle: '40' }, sketch)
  assert.ok(pts)
  assert.ok(Math.abs(pts![0].y - pts![1].y) < 1e-6)
  assert.ok(Math.abs(pts![2].y - pts![3].y) < 1e-6)
  assert.ok(Math.abs(dist(pts![0], pts![1]) - 100) < 1e-6)
  assert.ok(Math.abs(dist(pts![2], pts![3]) - 60) < 1e-6)
  assert.ok(Math.abs(dist(pts![1], pts![2]) - dist(pts![3], pts![0])) < 1e-6)
  assert.ok(Math.abs(Math.abs(pts![0].y - pts![3].y) - 40) < 1e-6)
  const mid = {
    x: (pts![0].x + pts![1].x + pts![2].x + pts![3].x) / 4,
    y: (pts![0].y + pts![1].y + pts![2].y + pts![3].y) / 4,
  }
  assert.ok(Math.abs(mid.x - 47.5) < 1e-6)
  assert.ok(Math.abs(mid.y - 47.5) < 1e-6)
  const tall = placeQuad({ kind: 'trapezoid', ab: '8', bc: '1', cd: '4', da: '1', angle: '192' }, sketch)
  assert.ok(tall)
  assert.equal(quadSideError('trapezoid', { ab: '6', bc: '1', cd: '4', da: '1' }, '3'), null)
  assert.equal(quadSideError('trapezoid', { ab: '6', bc: '', cd: '4', da: '' }, '0'), 'height')
})
