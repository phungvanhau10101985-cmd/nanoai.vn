import assert from 'node:assert/strict'
import test from 'node:test'
import { pointInPolygon, topClosedRegion } from './fill-region'
import type { WhiteboardObject } from './types'

test('điểm trong đa giác và ngoài đa giác', () => {
  const square = [
    { x: 0, y: 0 },
    { x: 40, y: 0 },
    { x: 40, y: 40 },
    { x: 0, y: 40 },
  ]
  assert.equal(pointInPolygon({ x: 20, y: 20 }, square), true)
  assert.equal(pointInPolygon({ x: 50, y: 20 }, square), false)
})

test('nét khép kín nhận vùng, nét hở thì không', () => {
  const pts = []
  for (let i = 0; i <= 16; i += 1) {
    const a = (i / 16) * Math.PI * 2
    pts.push({ x: 100 + Math.cos(a) * 40, y: 100 + Math.sin(a) * 40 })
  }
  const closed: WhiteboardObject = {
    kind: 'stroke',
    id: 'ink',
    tool: 'pen',
    color: '#111827',
    size: 2,
    points: pts,
  }
  const open: WhiteboardObject = {
    kind: 'stroke',
    id: 'open',
    tool: 'pen',
    color: '#111827',
    size: 2,
    points: [
      { x: 0, y: 0 },
      { x: 20, y: 2 },
      { x: 40, y: 0 },
      { x: 80, y: 1 },
      { x: 120, y: 0 },
      { x: 160, y: 2 },
      { x: 200, y: 0 },
      { x: 240, y: 1 },
    ],
  }
  assert.equal(topClosedRegion([closed], { x: 100, y: 100 })?.id, 'ink')
  assert.equal(topClosedRegion([open], { x: 40, y: 0 }), null)
})

test('vùng khép kín trên cùng, bỏ đường thẳng', () => {
  const square: WhiteboardObject = {
    kind: 'shape',
    id: 'sq',
    shape: 'polygon',
    color: '#111827',
    size: 2,
    points: [
      { x: 0, y: 0 },
      { x: 80, y: 0 },
      { x: 80, y: 80 },
      { x: 0, y: 80 },
    ],
  }
  const line: WhiteboardObject = {
    kind: 'shape',
    id: 'ln',
    shape: 'line',
    color: '#111827',
    size: 2,
    points: [
      { x: 10, y: 10 },
      { x: 30, y: 30 },
    ],
  }
  const circle: WhiteboardObject = {
    kind: 'shape',
    id: 'ci',
    shape: 'circle',
    color: '#111827',
    size: 2,
    points: [],
    cx: 40,
    cy: 40,
    r: 10,
  }
  assert.equal(topClosedRegion([square, line], { x: 20, y: 20 })?.id, 'sq')
  assert.equal(topClosedRegion([square, circle], { x: 40, y: 40 })?.id, 'ci')
  assert.equal(topClosedRegion([line], { x: 20, y: 20 }), null)
})
