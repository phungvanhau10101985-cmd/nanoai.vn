import assert from 'node:assert/strict'
import test from 'node:test'
import {
  defaultTuckBoxProductionParams,
  normalizeTuckBoxProductionParams,
  validateTuckBoxProductionParams,
} from './tuck-box-production'
import { getTuckEndLayoutData } from '@/lib/packaging/box-net-svg'

test('production defaults use safe straight-tuck values', () => {
  assert.deepEqual(defaultTuckBoxProductionParams(50), {
    bleedMm: 3,
    glueTabMm: 15,
    paperThicknessMm: 0.4,
    compensationGapMm: 0.5,
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
  assert.equal(normalized.paperThicknessMm, 0.4)
  assert.equal(normalized.compensationGapMm, 1)
})

test('glue tab and compensation change only safe flap geometry', () => {
  const dimensions = { lengthMm: 120, widthMm: 40, heightMm: 60 }
  const legacy = getTuckEndLayoutData(dimensions)
  const production = getTuckEndLayoutData(dimensions, {
    bleedMm: 3,
    glueTabMm: 30,
    paperThicknessMm: 0.8,
    compensationGapMm: 1,
  })
  assert.equal(production.bounds.widthMm - legacy.bounds.widthMm, 12)
  assert.deepEqual(
    production.foldSegments.slice(0, 4).map(([x1, y1, x2, y2]) => [x1, x2, y2 - y1]),
    legacy.foldSegments.slice(0, 4).map(([x1, y1, x2, y2]) => [x1, x2, y2 - y1]),
    'body panel widths and heights stay unchanged'
  )
  assert.equal(production.tuckTabMm, legacy.tuckTabMm)
  assert.equal(
    production.cutSegments[6]![2] - production.cutSegments[6]![0],
    legacy.cutSegments[6]![2] - legacy.cutSegments[6]![0] - 2,
    'closure clearance narrows the tuck tongue symmetrically'
  )
})
