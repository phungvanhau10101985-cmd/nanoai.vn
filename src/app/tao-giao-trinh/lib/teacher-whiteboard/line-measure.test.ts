import assert from 'node:assert/strict'
import test from 'node:test'
import { formatGridMeasure, formatLineAngle, formatWholeAngle, formatWholeGrid, gridMeasureToWorld, lineFromMeasure, lineMeasure, parseLineAngle, roundWhiteboardSize } from './line-measure'

test('đo dài và góc so với phương ngang', () => {
  const right = lineMeasure({ x: 0, y: 0 }, { x: 100, y: 0 })
  assert.ok(Math.abs(right.length - 100) < 1e-6)
  assert.ok(Math.abs(right.angleDeg) < 1e-6)
  const up = lineMeasure({ x: 0, y: 0 }, { x: 0, y: -40 })
  assert.ok(Math.abs(up.angleDeg - 90) < 1e-6)
  const down = lineMeasure({ x: 2, y: 2 }, { x: 2, y: 12 })
  assert.ok(Math.abs(down.angleDeg - 270) < 1e-6)
  const slant = lineMeasure({ x: 0, y: 0 }, { x: 10, y: -10 })
  assert.ok(Math.abs(slant.angleDeg - 45) < 1e-6)
  const dipped = lineMeasure({ x: 0, y: 0 }, { x: 100, y: 3 })
  assert.ok(dipped.angleDeg > 350 && dipped.angleDeg < 360)
  assert.equal(formatLineAngle(-0.04), '0')
  assert.equal(formatLineAngle(-1.7), '358.3')
  assert.equal(parseLineAngle(''), null)
  assert.equal(parseLineAngle('23,5'), 23.5)
  assert.equal(parseLineAngle('-1.7'), null)
  assert.equal(parseLineAngle('góc'), null)
})

test('ô nhập mặc định là số nguyên', () => {
  assert.equal(formatWholeGrid(32 * 2.99), '3')
  assert.equal(formatWholeAngle(0.9), '1')
  assert.equal(formatWholeAngle(359.6), '0')
  assert.equal(formatWholeAngle(-1.7), '358')
})

test('số đo theo ô lưới', () => {
  assert.equal(formatGridMeasure(32), '1')
  assert.equal(formatGridMeasure(48), '1.5')
  assert.equal(formatGridMeasure(40), '1.25')
  assert.equal(gridMeasureToWorld(1.5), 48)
})

test('kích thước làm tròn số nguyên', () => {
  assert.equal(roundWhiteboardSize(383.774), 384)
  assert.equal(roundWhiteboardSize(16.1), 16)
  assert.equal(roundWhiteboardSize(0.2), 1)
})

test('để trống thì dựng lại đúng nét, có số thì theo số', () => {
  const start = { x: 5, y: 8 }
  const drawn = lineFromMeasure(start, 50, 30)
  const measured = lineMeasure(drawn[0], drawn[1])
  assert.ok(Math.abs(measured.length - 50) < 1e-6)
  assert.ok(Math.abs(measured.angleDeg - 30) < 1e-6)
  const flat = lineFromMeasure(start, 20, 0)
  assert.ok(Math.abs(flat[1].x - 25) < 1e-6)
  assert.ok(Math.abs(flat[1].y - 8) < 1e-6)
  const raised = lineFromMeasure(start, 10, 90)
  assert.ok(Math.abs(raised[1].x - 5) < 1e-6)
  assert.ok(Math.abs(raised[1].y - (8 - 10)) < 1e-6)
})
