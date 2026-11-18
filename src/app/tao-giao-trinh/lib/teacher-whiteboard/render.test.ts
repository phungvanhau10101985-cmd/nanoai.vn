import assert from 'node:assert/strict'
import test from 'node:test'
import { formulaLabelOrigin } from './render'

test('chữ hàm tránh đường thẳng đứng', () => {
  const curve = Array.from({ length: 40 }, (_, i) => ({ x: 40, y: i * 8 }))
  const spot = formulaLabelOrigin(90, 16, curve, { left: 0, top: 0, right: 320, bottom: 200 })
  assert.ok(spot.x > 80)
})

test('chữ hàm tránh đường ngang giữa khung', () => {
  const curve = Array.from({ length: 40 }, (_, i) => ({ x: i * 10, y: 100 }))
  const spot = formulaLabelOrigin(80, 16, curve, { left: 0, top: 0, right: 400, bottom: 220 })
  const overlaps = spot.y < 108 && spot.y + 16 > 92
  assert.equal(overlaps, false)
})
