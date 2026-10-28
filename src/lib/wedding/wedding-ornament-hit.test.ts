import assert from 'node:assert/strict'
import test from 'node:test'
import { ornamentLocalRatio, pickTopOrnament, type OrnamentPlane } from './wedding-ornament-hit'

const IDENTITY: OrnamentPlane = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }

test('a click on the center of an unrotated flower maps to the middle of the bitmap', () => {
  const ratio = ornamentLocalRatio({
    clientX: 500,
    clientY: 400,
    originX: 500,
    originY: 400,
    scaleX: 1,
    scaleY: 1,
    width: 200,
    height: 100,
    plane: IDENTITY,
  })
  assert.deepEqual(ratio, { u: 0.5, v: 0.5 })
})

test('a flipped flower maps the visual left edge to the right side of the bitmap', () => {
  const ratio = ornamentLocalRatio({
    clientX: 400,
    clientY: 400,
    originX: 500,
    originY: 400,
    scaleX: 1,
    scaleY: 1,
    width: 200,
    height: 100,
    plane: { a: -1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  })
  assert.ok(ratio)
  assert.ok(Math.abs(ratio.u - 1) < 0.001)
  assert.ok(Math.abs(ratio.v - 0.5) < 0.001)
})

test('parent zoom still maps the visual center to the bitmap center', () => {
  const ratio = ornamentLocalRatio({
    clientX: 250,
    clientY: 180,
    originX: 250,
    originY: 180,
    scaleX: 0.5,
    scaleY: 0.5,
    width: 200,
    height: 120,
    plane: IDENTITY,
  })
  assert.deepEqual(ratio, { u: 0.5, v: 0.5 })
})

test('the painted flower on top wins, and a transparent box does not', () => {
  assert.equal(
    pickTopOrnament([
      { index: 2, exact: false, near: false },
      { index: 0, exact: true, near: true },
    ]),
    0,
  )
  assert.equal(
    pickTopOrnament([
      { index: 3, exact: false, near: true },
      { index: 1, exact: true, near: true },
    ]),
    1,
  )
  assert.equal(pickTopOrnament([{ index: 4, exact: false, near: true }]), 4)
  assert.equal(pickTopOrnament([]), null)
})
