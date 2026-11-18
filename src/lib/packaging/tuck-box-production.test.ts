import assert from 'node:assert/strict'
import test from 'node:test'
import {
  defaultTuckBoxProductionParams,
  normalizeTuckBoxProductionParams,
  validateTuckBoxProductionParams,
} from './tuck-box-production'
import { getTuckEndLayoutData } from '@/lib/packaging/box-net-svg'

test('production defaults use ivory 350 and a 12–20 mm glue tab', () => {
  assert.deepEqual(defaultTuckBoxProductionParams(50), {
    bleedMm: 3,
    glueTabMm: 15,
    paperThicknessMm: 0.42,
    compensationGapMm: 1,
    paperStock: 'ivory_350',
    fingerNotch: true,
    lockDetails: true,
    safeZoneMm: 4,
    insertCols: 2,
    insertRows: 3,
    jarDiameterMm: 0,
    neckDiameterMm: 0,
  })
  assert.deepEqual(validateTuckBoxProductionParams(defaultTuckBoxProductionParams(50)), {})
})

test('invalid saved production values fall back independently', () => {
  const normalized = normalizeTuckBoxProductionParams(
    { bleedMm: 99, glueTabMm: 20, paperThicknessMm: -1, compensationGapMm: 1 },
    50
  )
  assert.equal(normalized.bleedMm, 3)
  assert.equal(normalized.glueTabMm, 20)
  assert.equal(normalized.paperThicknessMm, 0.42)
  assert.equal(normalized.compensationGapMm, 1)
  assert.equal(normalized.paperStock, 'custom')
})

function topOuterWidth(layout: ReturnType<typeof getTuckEndLayoutData>) {
  const topY = Math.min(...layout.cutSegments.flatMap((seg) => [seg[1], seg[3]]))
  const spans = layout.cutSegments.filter(
    (seg) => Math.abs(seg[1] - seg[3]) < 0.2 && Math.min(seg[1], seg[3]) < topY + 1.5
  )
  return Math.max(...spans.map((seg) => Math.abs(seg[2] - seg[0])))
}

test('glue tab, caliper and side relief change only the flaps', () => {
  const dimensions = { lengthMm: 120, widthMm: 40, heightMm: 60 }
  const legacy = getTuckEndLayoutData(dimensions)
  const base = {
    bleedMm: 3,
    paperThicknessMm: 0.5,
    compensationGapMm: 1,
    fingerNotch: false,
    lockDetails: false,
  }
  const wide = getTuckEndLayoutData(dimensions, { ...base, glueTabMm: 20 })
  const narrow = getTuckEndLayoutData(dimensions, { ...base, glueTabMm: 12 })
  assert.equal(wide.bounds.widthMm - narrow.bounds.widthMm, 8)
  assert.deepEqual(
    wide.foldSegments.slice(0, 4).map(([x1, y1, x2, y2]) => [x1, x2, y2 - y1]),
    legacy.foldSegments.slice(0, 4).map(([x1, y1, x2, y2]) => [x1, x2, y2 - y1])
  )
  const bottom = (layout: ReturnType<typeof getTuckEndLayoutData>) =>
    layout.panels.find((panel) => panel.slot === 'bottom')!
  assert.equal(bottom(wide).h - bottom(legacy).h, 1)
  assert.equal(topOuterWidth(legacy) - topOuterWidth(wide), 2)
})
