import assert from 'node:assert/strict'
import test from 'node:test'
import { balanceEquation, releaseFigureTune, freshFigureParams, figureItem } from './figures'
import {
  METAL_SERIES,
  RUST_EQUATION,
  SHELLS,
  centripetalAccel,
  chanceLeaves,
  clockReading,
  complexModulus,
  dihybridGrid,
  diceFace,
  elastic1d,
  enzymeActivity,
  equilibriumProduct,
  firstOrderSlope,
  fractionParts,
  hookeForce,
  inscribedAngle,
  integralArea,
  leverForces,
  linePairAngles,
  normalDensity,
  numberLineValue,
  percentCount,
  proportionPair,
  pythagorasParts,
  rlcAmplitude,
  selectionShares,
  sequenceTerms,
  shellTotal,
  tangentSlope,
  thalesSplits,
  vectorSum,
} from './figure-models'

test('số và hình lớp dưới nằm trong miền đã chốt', () => {
  for (const variant of ['ten', 'hundred', 'fraction', 'decimal', 'integer']) {
    for (const t of [0, 0.37, 1]) {
      const [lo, hi] = variant === 'hundred' ? [0, 100] : variant === 'fraction' || variant === 'decimal' ? [0, 1] : variant === 'integer' ? [-5, 5] : [0, 10]
      const value = numberLineValue(variant, t)
      assert.ok(value >= lo - 1e-9 && value <= hi + 1e-9)
    }
  }
  const fraction = fractionParts([1, 1])
  assert.ok(fraction.num <= fraction.den)
  assert.ok(fraction.den >= 2 && fraction.den <= 12)
  assert.equal(percentCount(0), 0)
  assert.equal(percentCount(1), 100)
  const angles = linePairAngles(0.5)
  assert.ok(Math.abs(angles.one + angles.other - 180) < 1e-9)
  assert.ok(angles.one >= 30 && angles.one <= 110)
})

test('hình toán THCS và THPT giữ đúng hệ thức', () => {
  const direct = proportionPair('direct', 3)
  const inverse = proportionPair('inverse', 3)
  assert.equal(direct.ratio, 2)
  assert.equal(inverse.product, 12)
  const thales = thalesSplits(0.4)
  assert.equal(thales.left, thales.right)
  const tri = pythagorasParts(3, 4)
  assert.ok(Math.abs(tri.a2 + tri.b2 - tri.c2) < 1e-9)
  assert.equal(inscribedAngle(80), 40)
  assert.deepEqual(vectorSum(1, 2, 3, 4), { x: 4, y: 6 })
  const leaves = chanceLeaves()
  assert.deepEqual(leaves, [0.5, 0.25, 0.25])
  assert.ok(Math.abs(leaves.reduce((sum, value) => sum + value, 0) - 1) < 1e-9)
  assert.deepEqual(sequenceTerms('arith', 3), [2, 5, 8, 11, 14])
  assert.deepEqual(sequenceTerms('geom', 2), [2, 4, 8, 16, 32])
  assert.equal(tangentSlope(3), 6)
  assert.ok(Math.abs(integralArea() - 1 / 6) < 1e-4)
  assert.ok(Math.abs(complexModulus(3, 4) - 5) < 1e-9)
  const mean = 2
  assert.ok(normalDensity(mean, mean, 1) > normalDensity(mean + 1, mean, 1))
})

test('hình vật lí và hoá giữ đúng đại lượng', () => {
  const lever = leverForces(2)
  assert.ok(Math.abs(lever.f1 * lever.d1 - lever.f2 * lever.d2) < 1e-9)
  assert.equal(lever.f2, 10)
  assert.equal(lever.d2, 1)
  assert.equal(centripetalAccel(4, 2), 8)
  const hit = elastic1d(2, 3, 1, 0)
  assert.ok(Math.abs(hit.before - hit.after) < 1e-9)
  assert.equal(hookeForce(4, 0.5), 2)
  const f0 = 50
  assert.ok(rlcAmplitude(f0, f0) > rlcAmplitude(f0 * 1.4, f0))
  assert.equal(shellTotal('Na'), 11)
  assert.deepEqual(SHELLS.Na, [2, 8, 1])
  assert.equal(shellTotal('Cl'), 17)
  assert.deepEqual(SHELLS.Cl, [2, 8, 7])
  assert.ok(equilibriumProduct(1) < equilibriumProduct(0))
  assert.equal(firstOrderSlope(0.3), -0.3)
  assert.equal(RUST_EQUATION, balanceEquation('Fe + O2 -> Fe2O3'))
  assert.deepEqual([...METAL_SERIES], ['K', 'Na', 'Ca', 'Mg', 'Al', 'Zn', 'Fe', 'H', 'Cu', 'Ag'])
})

test('Punnett hai tính, đồng hồ, xúc xắc và bình thông nhau', () => {
  const grid = dihybridGrid()
  assert.equal(grid.total, 16)
  assert.equal(grid.cells.length, 16)
  assert.equal(grid.both, 9)
  assert.equal(grid.cells[0], 'AABB')
  const shares = selectionShares(0)
  assert.ok(Math.abs(shares.reduce((sum, value) => sum + value, 0) - 1) < 1e-9)
  assert.ok(selectionShares(2)[0] > shares[0])
  assert.ok(enzymeActivity(0.55) > enzymeActivity(0))
  const hour = clockReading('hour', [0, 0.4])
  assert.equal(hour.hour, 0)
  assert.equal(hour.minutes, 0)
  const half = clockReading('half', [0, 0.1])
  assert.equal(half.minutes, 30)
  const minute = clockReading('minute', [0, 0.08])
  assert.equal(minute.minutes % 5, 0)
  assert.equal(diceFace(3.9, true), 4)
  assert.ok(diceFace(0, true) >= 1 && diceFace(0, true) <= 6)
  const item = figureItem('communicating')
  assert.ok(item)
  const released = releaseFigureTune('communicating', { ...freshFigureParams(item), tune: [0.2] }, 'k', 0)
  assert.deepEqual(released.tune, [0.5])
})
