import assert from 'node:assert/strict'
import test from 'node:test'
import { applyWhiteboardMessage, emptyWhiteboardState, pickObjectsInMarquee, sanitizeWhiteboardObject } from './model'
import type { WhiteboardObject } from './types'

test('nét nháp tới sau không đè hình tròn đã nhận', () => {
  const base = emptyWhiteboardState()
  const circle = applyWhiteboardMessage(base, {
    type: 'whiteboard-upsert',
    object: {
      kind: 'shape',
      id: 'c1',
      shape: 'circle',
      color: '#111827',
      size: 5,
      points: [],
      cx: 10,
      cy: 20,
      r: 30,
    },
  })
  const late = applyWhiteboardMessage(circle, {
    type: 'whiteboard-draft',
    draft: {
      id: 'c1',
      tool: 'pen',
      color: '#111827',
      size: 5,
      points: [{ x: 0, y: 0 }, { x: 4, y: 8 }, { x: 1, y: 2 }],
    },
  })
  assert.equal(late.draft, null)
  assert.equal(late.objects[0]?.kind, 'shape')
  assert.equal(late.objects[0] && late.objects[0].kind === 'shape' ? late.objects[0].shape : '', 'circle')
})

test('hàm cùng hệ trục giữ frameId', () => {
  const got = sanitizeWhiteboardObject({
    kind: 'graph',
    id: 'g1',
    color: '#111827',
    axis: 'y',
    expr: 'x^2',
    origin: { x: 1, y: 2 },
    unit: 40,
    frameId: 'frame-a',
  })
  assert.equal(got && got.kind === 'graph' ? got.frameId : '', 'frame-a')
})

test('quét phải sang trái chọn phần tử khung chạm, trái sang phải chỉ lấy hình nằm trọn', () => {
  const objects: WhiteboardObject[] = [
    { kind: 'shape', id: 'in', shape: 'circle', color: '#111827', size: 3, points: [], cx: 10, cy: 10, r: 4 },
    { kind: 'shape', id: 'touch', shape: 'circle', color: '#111827', size: 3, points: [], cx: 30, cy: 10, r: 6 },
    { kind: 'shape', id: 'out', shape: 'circle', color: '#111827', size: 3, points: [], cx: 80, cy: 80, r: 4 },
  ]
  const windowPick = pickObjectsInMarquee(objects, { x: 0, y: 0 }, { x: 28, y: 28 }, false)
  const crossPick = pickObjectsInMarquee(objects, { x: 28, y: 28 }, { x: 0, y: 0 }, true)
  assert.deepEqual(windowPick, ['in'])
  assert.deepEqual(crossPick, ['in', 'touch'])
})
