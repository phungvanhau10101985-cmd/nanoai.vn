import assert from 'node:assert/strict'
import test from 'node:test'
import { formulaLabelOrigin } from './render'

test('chữ hàm nằm sát đường thẳng đứng, không đè lên nét', () => {
  const curve = Array.from({ length: 40 }, (_, i) => ({ x: 40, y: i * 8 }))
  const spot = formulaLabelOrigin(90, 16, curve, { left: 0, top: 0, right: 320, bottom: 200 })
  const onLine = spot.x < 46 && spot.x + 90 > 34
  assert.equal(onLine, false)
  assert.ok(spot.x < 160)
})

test('chữ hàm tránh ô tọa độ và không đè chữ hàm khác', () => {
  const curve = Array.from({ length: 12 }, (_, i) => ({ x: 220, y: 30 + i * 12 }))
  const box = { left: 0, top: 0, right: 420, bottom: 260 }
  const coordinate = { x: 250, y: 8, w: 160, h: 42 }
  const first = formulaLabelOrigin(90, 16, curve, box, [coordinate])
  const firstBox = { x: first.x - 8, y: first.y - 6, w: 106, h: 30 }
  const second = formulaLabelOrigin(90, 16, curve, box, [coordinate, firstBox])
  const hitsCoordinate = (spot: { x: number; y: number }) =>
    spot.x < coordinate.x + coordinate.w && spot.x + 90 > coordinate.x && spot.y < coordinate.y + coordinate.h && spot.y + 16 > coordinate.y
  const hitsFirst = second.x < firstBox.x + firstBox.w && second.x + 90 > firstBox.x && second.y < firstBox.y + firstBox.h && second.y + 16 > firstBox.y
  assert.equal(hitsCoordinate(first), false)
  assert.equal(hitsCoordinate(second), false)
  assert.equal(hitsFirst, false)
})

test('chữ hàm tránh đường ngang giữa khung', () => {
  const curve = Array.from({ length: 40 }, (_, i) => ({ x: i * 10, y: 100 }))
  const spot = formulaLabelOrigin(80, 16, curve, { left: 0, top: 0, right: 400, bottom: 220 })
  const overlaps = spot.y < 108 && spot.y + 16 > 92
  assert.equal(overlaps, false)
})
