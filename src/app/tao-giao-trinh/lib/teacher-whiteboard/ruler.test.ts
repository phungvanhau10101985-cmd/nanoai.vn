import assert from 'node:assert/strict'
import test from 'node:test'
import { projectOnRuler, protractorArmDeg, rulerEnd, rulerFromEnds } from './ruler'

test('thước ngang dài 2 ô', () => {
  const end = rulerEnd({ x: 10, y: 20, length: 64, angleDeg: 0 })
  assert.ok(Math.abs(end.x - 74) < 1e-6)
  assert.ok(Math.abs(end.y - 20) < 1e-6)
})

test('kéo hai đầu dựng lại thước', () => {
  const ruler = rulerFromEnds({ x: 0, y: 0 }, { x: 0, y: -96 })
  assert.equal(ruler.angleDeg, 90)
  assert.ok(Math.abs(ruler.length - 96) < 1e-6)
})

test('nét sát mép dính thước, nét xa thì không', () => {
  const ruler = { x: 0, y: 0, length: 128, angleDeg: 0 }
  const near = projectOnRuler(ruler, { x: 40, y: 6 }, 12)
  assert.ok(near && Math.abs(near.x - 40) < 1e-6 && Math.abs(near.y) < 1e-6)
  assert.equal(projectOnRuler(ruler, { x: 40, y: 40 }, 12), null)
})

test('kim thước đo độ nằm trong nửa vòng', () => {
  assert.equal(protractorArmDeg(0, 90), 90)
  assert.equal(protractorArmDeg(0, 180), 180)
  assert.equal(protractorArmDeg(0, 200), 180)
  assert.equal(protractorArmDeg(0, 350), 0)
})

test('compa dính vòng tròn, êke dính cạnh', () => {
  const compass = { kind: 'compass' as const, x: 0, y: 0, length: 40, angleDeg: 0 }
  const near = projectOnRuler(compass, { x: 40, y: 8 }, 12)
  assert.ok(near)
  assert.ok(Math.abs(Math.hypot(near!.x, near!.y) - 40) < 1e-6)
  assert.equal(projectOnRuler(compass, { x: 10, y: 0 }, 12), null)
  const square = { kind: 'set-square-45' as const, x: 0, y: 0, length: 64, angleDeg: 0 }
  const edge = projectOnRuler(square, { x: 20, y: -4 }, 12)
  assert.ok(edge && Math.abs(edge.y) < 1e-6 && Math.abs(edge.x - 20) < 1e-6)
})
