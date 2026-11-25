import assert from 'node:assert/strict'
import test from 'node:test'
import { FIGURE_ITEMS, figureItem } from './figures'
import { lessonFigures } from './figures-lesson-data'
import { registeredFigureIds } from './figure-registry'
import {
  defaultFigureScope,
  figureBandOf,
  figureItemVisible,
  figureShown,
  missingGradeAssignments,
} from './figure-grade'

test('mã lớp học đổi thành dải hình', () => {
  assert.equal(figureBandOf('lop-5'), 'p45')
  assert.equal(figureBandOf('nha-tre'), 'mn')
  assert.equal(figureBandOf('dai-hoc'), 'uni')
  assert.equal(figureBandOf('hoc-nghe'), 'voc')
  assert.equal(defaultFigureScope('uni'), 'stage')
  assert.equal(defaultFigureScope('g11'), 'band')
  assert.equal(defaultFigureScope(null), 'all')
})

test('menu chỉ hiện hình đúng lớp và đúng cấp', () => {
  const photo = figureItem('photoelectric')
  const bio = figureItem('formula-bio')
  const ray = figureItem('ray')
  const spatial = figureItem('spatial')
  const geometry = figureItem('math-geometry')
  assert.ok(photo && bio && ray && spatial && geometry)
  assert.equal(figureShown(photo.grades, 'p45', 'band'), false)
  assert.equal(figureItemVisible(bio, 'p45', 'band'), false)
  assert.equal(figureItemVisible(ray, 'g11', 'band'), true)
  assert.equal(figureItemVisible(ray, 'uni', 'stage'), true)
  assert.equal(figureItemVisible(spatial, 'uni', 'stage'), true)
  assert.equal(figureItemVisible(geometry, 'g8', 'band'), false)
  assert.equal(geometry.menu, false)
})

test('mọi hình và mọi biến thể đều có cấp học', () => {
  assert.deepEqual(missingGradeAssignments(FIGURE_ITEMS), [])
  const ids = new Set(FIGURE_ITEMS.map((item) => item.id))
  const drawn = new Set(registeredFigureIds())
  for (const lesson of lessonFigures) {
    assert.equal(ids.has(lesson.id), true, lesson.id)
    assert.equal(drawn.has(lesson.id), true, lesson.id)
  }
  const graph = figureItem('math-graph')
  assert.equal(graph?.menu, undefined)
  assert.ok(graph?.variants?.some((entry) => entry.id === 'line'))
  assert.ok(figureItem('standing')?.variants?.some((entry) => entry.id === 'pipe-open'))
  assert.ok(figureItem('formula-physics')?.variants?.some((entry) => entry.id === 'electric-power'))
  assert.equal(figureItem('formula-chem')?.variants?.find((entry) => entry.id === 'titrate')?.menu, undefined)
  assert.ok(figureItem('punnett')?.variants?.some((entry) => entry.id === 'dihybrid'))
})
