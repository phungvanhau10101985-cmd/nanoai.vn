import assert from 'node:assert/strict'
import test from 'node:test'
import { angleAtPlace, angleFromTwoLines, chainFromDim, composeDim, dimLabel, measurePickedArc, measurePickedCircle, measurePickedLine, nearestDimCircle } from './dim'
import type { WhiteboardObject } from './types'

test('dim thẳng đo bề ngang khi đường kích thước nằm trên', () => {
  const built = composeDim('linear', [
    { x: 0, y: 0 },
    { x: 64, y: 8 },
    { x: 32, y: -40 },
  ], null)
  assert.equal(built?.dim, 'linear')
  assert.ok(built)
  assert.equal(dimLabel(built), '2')
})

test('dim song song đo đủ đoạn', () => {
  const built = composeDim('aligned', [
    { x: 0, y: 0 },
    { x: 96, y: 0 },
    { x: 48, y: -30 },
  ], null)
  assert.ok(built)
  assert.equal(dimLabel(built), '3')
})

test('dim góc vuông', () => {
  const built = composeDim('angular', [
    { x: 0, y: 0 },
    { x: 40, y: 0 },
    { x: 0, y: -40 },
  ], null)
  assert.ok(built)
  assert.equal(dimLabel(built), '90°')
})

test('bán kính và đường kính', () => {
  const radius = composeDim('radius', [{ x: 0, y: 0 }, { x: 32, y: 0 }], null)
  const diameter = composeDim('diameter', [{ x: 0, y: 0 }, { x: 32, y: 0 }], null)
  assert.ok(radius && diameter)
  assert.equal(dimLabel(radius), 'R 1')
  assert.equal(dimLabel(diameter), 'Ø 2')
})

test('tiếp tục giữ đúng đường kích thước vừa đặt', () => {
  const first = composeDim('linear', [
    { x: 0, y: 0 },
    { x: 64, y: 0 },
    { x: 32, y: -40 },
  ], null)
  assert.ok(first?.chain)
  const next = composeDim('continue', [{ x: 128, y: 4 }], first.chain)
  assert.equal(next?.points[0].x, 64)
  assert.equal(next?.points[2].y, -40)
  assert.equal(dimLabel(next!), '2')
})

test('đo góc bằng cách chọn hai cạnh tam giác', () => {
  const built = angleFromTwoLines(
    { a: { x: 0, y: 0 }, b: { x: 40, y: 0 }, at: { x: 20, y: 0 } },
    { a: { x: 0, y: 0 }, b: { x: -20, y: -10 }, at: { x: -10, y: -5 } },
  )
  assert.ok(built)
  const label = dimLabel({ dim: 'angular', points: built })
  const deg = Number(label.replace('°', ''))
  assert.ok(deg > 90 && deg < 180)
})

test('hai đường cắt nhau thì lấy góc phía vừa bấm', () => {
  const built = angleFromTwoLines(
    { a: { x: -30, y: 0 }, b: { x: 30, y: 0 }, at: { x: 16, y: 0 } },
    { a: { x: 0, y: -30 }, b: { x: 0, y: 30 }, at: { x: 0, y: -12 } },
  )
  assert.ok(built)
  assert.equal(dimLabel({ dim: 'angular', points: built }), '90°')
})

test('hai đường song song không tạo góc', () => {
  assert.equal(angleFromTwoLines(
    { a: { x: 0, y: 0 }, b: { x: 40, y: 0 }, at: { x: 10, y: 0 } },
    { a: { x: 0, y: 20 }, b: { x: 40, y: 20 }, at: { x: 10, y: 20 } },
  ), null)
})

test('bán kính và đường kính lấy số của đường tròn đã chọn', () => {
  const circle = { kind: 'shape', id: 'c', shape: 'circle', color: '#111', size: 2, points: [], cx: 0, cy: 0, r: 32 } satisfies WhiteboardObject
  assert.deepEqual(nearestDimCircle([circle], { x: 33, y: 0 }, 8), { cx: 0, cy: 0, r: 32 })
  assert.equal(nearestDimCircle([circle], { x: 80, y: 0 }, 8), null)
  const radius = measurePickedCircle('radius', { cx: 0, cy: 0, r: 32 }, { x: 90, y: 0 })
  const diameter = measurePickedCircle('diameter', { cx: 0, cy: 0, r: 32 }, { x: 0, y: -80 })
  assert.ok(radius && diameter)
  assert.equal(dimLabel(radius), 'R 1')
  assert.equal(radius.points[1].x, 32)
  assert.equal(dimLabel(diameter), 'Ø 2')
})

test('đo thẳng lấy độ dài đoạn đã chọn', () => {
  const built = measurePickedLine('linear', { a: { x: 0, y: 0 }, b: { x: 64, y: 0 } }, { x: 8, y: -40 })
  assert.ok(built)
  assert.equal(dimLabel(built), '2')
  assert.equal(built.points[2].y, -40)
})

test('đặt góc sau khi đã chọn hai đường', () => {
  const first = { a: { x: -40, y: 0 }, b: { x: 40, y: 0 } }
  const second = { a: { x: 0, y: 0 }, b: { x: 20, y: -34.64 } }
  const acute = angleAtPlace(first, second, { x: 24, y: -6 })
  const obtuse = angleAtPlace(first, second, { x: 24, y: 16 })
  assert.ok(acute && obtuse)
  const narrow = Number(dimLabel({ dim: 'angular', points: acute }).replace('°', ''))
  const wide = Number(dimLabel({ dim: 'angular', points: obtuse }).replace('°', ''))
  assert.ok(Math.abs(narrow - 60) < 1)
  assert.ok(Math.abs(wide - 120) < 1)
})

test('chiều dài cung lấy chu vi đường tròn đã chọn', () => {
  const built = measurePickedArc({ cx: 0, cy: 0, r: 32 }, { x: 80, y: 0 })
  assert.ok(built)
  assert.equal(dimLabel(built), '6.28')
  const chain = chainFromDim({ dim: 'linear', points: [{ x: 0, y: 0 }, { x: 64, y: 0 }, { x: 32, y: -40 }] })
  assert.equal(chain?.mode, 'linear')
  assert.equal(chain?.p2.x, 64)
})

test('tọa độ kéo ngang là Y, kéo dọc là X', () => {
  const yDim = composeDim('ordinate', [{ x: 64, y: -32 }, { x: 120, y: -32 }], null)
  const xDim = composeDim('ordinate', [{ x: 64, y: -32 }, { x: 64, y: 20 }], null)
  assert.ok(yDim && xDim)
  assert.equal(dimLabel(yDim), 'Y 1')
  assert.equal(dimLabel(xDim), 'X 2')
})
