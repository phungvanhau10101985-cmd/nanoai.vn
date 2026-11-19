import assert from 'node:assert/strict'
import test from 'node:test'
import { hitMeasureLabel, measureLabels } from './measure-label'
import type { WhiteboardObject } from './types'

const cam = { x: 0, y: 0, scale: 1 }

test('nhãn đoạn thẳng và đường tròn theo ô', () => {
  const line: WhiteboardObject = {
    kind: 'shape', id: 'l', shape: 'line', color: '#111', size: 3,
    points: [{ x: -32, y: 0 }, { x: 32, y: 0 }],
  }
  const circle: WhiteboardObject = {
    kind: 'shape', id: 'c', shape: 'circle', color: '#111', size: 3, points: [], cx: 0, cy: 80, r: 16,
  }
  const labels = measureLabels([line, circle], cam, 400, 300)
  assert.equal(labels[0]?.text.startsWith('2'), true)
  assert.match(labels[1]?.text ?? '', /Ø 1/)
  const lineLabel = labels[0]
  assert.ok(lineLabel)
  const hit = hitMeasureLabel([line, circle], lineLabel.x + 2, lineLabel.y, cam, 400, 300)
  assert.equal(hit?.id, 'l')
  assert.equal(hitMeasureLabel([line], 0, 0, cam, 400, 300), null)
})
