import assert from 'node:assert/strict'
import test from 'node:test'
import { dist } from './geometry'
import { formatWholeAngle, formatWholeGrid, gridMeasureToWorld, lineFromMeasure, lineMeasure } from './line-measure'
import { clipStrokeEndToMark, derivedTriangles, holdStrokeOnMark, nearestTriangleVertex, nextVertexName, pinLineEnds, reservedVertexNames, triangleForStraightStroke, triangleLinePoints } from './triangle-line'
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

test('kéo từ điểm giao vào tam giác nào thì hỏi tam giác đó', () => {
  const abc: WhiteboardObject = {
    kind: 'shape', id: 'abc', shape: 'triangle', color: '#111', size: 3,
    points: [{ x: 0, y: -40 }, { x: -30, y: 0 }, { x: 30, y: 0 }],
  }
  const dbc: WhiteboardObject = {
    kind: 'shape', id: 'dbc', shape: 'triangle', color: '#111', size: 3,
    points: [{ x: 0, y: 40 }, { x: -30, y: 0 }, { x: 30, y: 0 }],
  }
  const cut: WhiteboardObject = {
    kind: 'shape', id: 'cut', shape: 'line', color: '#111', size: 3,
    points: [{ x: 0, y: -40 }, { x: 0, y: 40 }],
  }
  const objects = [abc, dbc, cut]
  const up = triangleForStraightStroke(objects, [{ x: 0, y: 0 }, { x: 0, y: -16 }], 8)
  assert.equal(up?.triangleId, 'abc')
  assert.equal(up?.vertex, 0)
  const down = triangleForStraightStroke(objects, [{ x: 0, y: 0 }, { x: 0, y: 16 }], 8)
  assert.equal(down?.triangleId, 'dbc')
  assert.equal(down?.vertex, 0)
})

test('phân giác đặt tên D và nét kéo sang phải thuộc tam giác bên phải', () => {
  const abc: WhiteboardObject = {
    kind: 'shape', id: 'abc', shape: 'triangle', color: '#111', size: 3,
    points: [{ x: 0, y: -40 }, { x: -30, y: 0 }, { x: 30, y: 0 }],
  }
  const line: WhiteboardObject = {
    kind: 'shape', id: 'h', shape: 'line', color: '#c00', size: 3,
    points: [{ x: 0, y: -40 }, { x: 0, y: 0 }],
    triangleLine: { role: 'bisector', vertex: 0, triangleId: 'abc', footName: 'D' },
  }
  const regions = derivedTriangles([abc, line])
  const right = regions.find((item) => item.kind === 'shape' && item.vertexNames?.[1] === 'D' && item.vertexNames?.[2] === 'C')
  const left = regions.find((item) => item.kind === 'shape' && item.vertexNames?.[1] === 'B' && item.vertexNames?.[2] === 'D')
  assert.ok(right && right.kind === 'shape')
  assert.ok(left && left.kind === 'shape')
  const intoRight = triangleForStraightStroke([abc, line], [{ x: 0, y: 0 }, { x: 10, y: -13 }], 8)
  assert.equal(intoRight?.triangleId, right && right.kind === 'shape' ? right.id : '')
  assert.equal(intoRight && intoRight.vertexNames[intoRight.vertex], 'D')
  const intoLeft = triangleForStraightStroke([abc, line], [{ x: 0, y: 0 }, { x: -10, y: -13 }], 8)
  assert.equal(intoLeft?.triangleId, left && left.kind === 'shape' ? left.id : '')
  assert.equal(intoLeft && intoLeft.vertexNames[intoLeft.vertex], 'D')
  assert.equal(nextVertexName(reservedVertexNames([abc, line])), 'E')
})

test('nét nối vào điểm thì bỏ đoạn thừa phía sau điểm', () => {
  const corner = { x: 100, y: 0 }
  const tri: WhiteboardObject = {
    kind: 'shape',
    id: 't',
    shape: 'triangle',
    color: '#111',
    size: 2,
    points: [corner, { x: 100, y: 40 }, { x: 140, y: 40 }],
  }
  const stroke = [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }, { x: 118, y: 2 }]
  const cut = clipStrokeEndToMark(stroke, [tri], 18)
  assert.equal(cut[cut.length - 1].x, 100)
  assert.equal(cut[cut.length - 1].y, 0)
  const far = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 200, y: 0 }]
  assert.equal(clipStrokeEndToMark(far, [tri], 18)[2].x, 200)
  const held = holdStrokeOnMark([{ x: 0, y: 0 }, corner], corner, { x: 124, y: 1 }, 18)
  assert.equal(held.point, corner)
  const released = holdStrokeOnMark([{ x: 0, y: 0 }, corner], corner, { x: 100, y: 40 }, 18)
  assert.equal(released.mark, null)
})

test('đoạn thẳng cắt qua điểm thì dừng đúng tại điểm, kể cả khi làm tròn số đo', () => {
  const corner = { x: 210, y: -96 }
  const tri: WhiteboardObject = {
    kind: 'shape',
    id: 't',
    shape: 'triangle',
    color: '#111',
    size: 2,
    points: [corner, { x: 210, y: 40 }, { x: 280, y: 40 }],
  }
  const span = Math.hypot(corner.x, corner.y)
  const end = { x: corner.x + (corner.x / span) * 24, y: corner.y + (corner.y / span) * 24 }
  const bowed = [{ x: 0, y: 0 }, { x: 90, y: 70 }, end]
  const cut = clipStrokeEndToMark(bowed, [tri], 18)
  assert.equal(cut[cut.length - 1].x, corner.x)
  assert.equal(cut[cut.length - 1].y, corner.y)
  const measured = lineMeasure({ x: 0, y: 0 }, corner)
  const rebuilt = lineFromMeasure(
    { x: 0, y: 0 },
    gridMeasureToWorld(Number(formatWholeGrid(measured.length))),
    Number(formatWholeAngle(measured.angleDeg)),
  )
  assert.ok(dist(rebuilt[1], corner) > 0.5)
  const pinned = pinLineEnds(rebuilt[0], rebuilt[1], [tri], 48)
  assert.equal(pinned[1].x, corner.x)
  assert.equal(pinned[1].y, corner.y)
  const past = pinLineEnds({ x: 0, y: 0 }, { x: 400, y: 0 }, [tri], 48)
  assert.equal(past[1].x, 400)
})
