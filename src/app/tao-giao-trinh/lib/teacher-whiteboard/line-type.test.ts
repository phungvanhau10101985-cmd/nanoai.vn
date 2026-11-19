import assert from 'node:assert/strict'
import test from 'node:test'
import { stampLineType, whiteboardLineDash } from './line-type'
import type { WhiteboardShape } from './types'

test('nét AutoCAD ra đúng dải gạch', () => {
  assert.deepEqual(whiteboardLineDash('continuous', 1), [])
  assert.deepEqual(whiteboardLineDash(undefined, 2), [])
  assert.deepEqual(whiteboardLineDash('center', 1), [22, 6, 5, 6])
  assert.deepEqual(whiteboardLineDash('dashed', 2), [28, 16])
})

test('gắn kiểu nét, nét liền thì bỏ trường', () => {
  const line: WhiteboardShape = { kind: 'shape', id: 'l', shape: 'line', color: '#111827', size: 3, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] }
  assert.equal(stampLineType(line, 'continuous').lineType, undefined)
  assert.equal(stampLineType(line, 'hidden').lineType, 'hidden')
  const kept = stampLineType({ ...line, lineType: 'dot' }, 'dashed')
  assert.equal(kept.lineType, 'dot')
})
