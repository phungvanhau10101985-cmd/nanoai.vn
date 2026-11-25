import assert from 'node:assert/strict'
import test from 'node:test'
import { applyWhiteboardMessage, deleteWhiteboardSelection, emptyWhiteboardState, hitTestDraft, hitTestTop, overviewCamera, pickObjectsInMarquee, placeWhiteboardImage, sanitizeWhiteboardObject, topFigureHandle, translateObject, whiteboardMarqueeIsSelection, whiteboardOverviewBounds } from './model'
import { figureItem, freshFigureParams } from './figures'
import { screenToWorld } from './geometry'
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

test('quét nét trên thí nghiệm không kéo theo cả sơ đồ', () => {
  const lab = figureItem('experiment-phys')
  if (!lab) throw new Error('thiếu sơ đồ')
  const figure: WhiteboardObject = {
    kind: 'figure',
    id: 'lab',
    color: '#111',
    figure: 'experiment-phys',
    x: 0,
    y: 0,
    w: lab.w,
    h: lab.h,
    params: freshFigureParams(lab),
  }
  const ink: WhiteboardObject = {
    kind: 'stroke',
    id: 'ink',
    tool: 'pen',
    color: '#111',
    size: 3,
    points: [{ x: 40, y: 40 }, { x: 90, y: 70 }],
  }
  const picked = pickObjectsInMarquee([figure, ink], { x: 100, y: 90 }, { x: 30, y: 30 }, true)
  assert.deepEqual(picked, ['ink'])
  assert.equal(hitTestDraft({ id: 'd', color: '#111', size: 3, points: [{ x: 10, y: 10 }, { x: 40, y: 10 }] }, { x: 22, y: 12 }, 4), true)
  assert.equal(hitTestDraft(null, { x: 22, y: 12 }, 4), false)
})

test('nút chạy và núm kéo nhận dù chưa chọn và có nét đè', () => {
  const lab = figureItem('experiment-phys')
  const lens = figureItem('ray')
  if (!lab || !lens) throw new Error('thiếu sơ đồ')
  const experiment: WhiteboardObject = {
    kind: 'figure',
    id: 'lab',
    color: '#111',
    figure: 'experiment-phys',
    x: 40,
    y: 30,
    w: lab.w,
    h: lab.h,
    params: freshFigureParams(lab),
  }
  const ray: WhiteboardObject = {
    kind: 'figure',
    id: 'lens',
    color: '#111',
    figure: 'ray',
    x: 500,
    y: 40,
    w: lens.w,
    h: lens.h,
    params: freshFigureParams(lens),
  }
  const stroke: WhiteboardObject = {
    kind: 'stroke',
    id: 'ink',
    tool: 'pen',
    color: '#111',
    size: 4,
    points: [
      { x: 40 + lab.w - 28, y: 30 },
      { x: 40 + lab.w - 8, y: 46 },
    ],
  }
  const runAt = { x: 40 + lab.w - 18, y: 46 }
  const grabbed = topFigureHandle([experiment, ray, stroke], runAt, 4, 0)
  assert.equal(grabbed?.object.id, 'lab')
  assert.equal(grabbed?.handle, 'run')
  const knob = topFigureHandle([ray], { x: 570, y: 130 }, 4, 0)
  assert.equal(knob?.handle, 'object')
  const body = topFigureHandle([experiment], { x: 40 + lab.w / 2, y: 30 + lab.h / 2 }, 4, 0)
  assert.equal(body, null)
})

test('ảnh nằm dưới nét, bấm nét không chọn ảnh', () => {
  const src = `data:image/jpeg;base64,${'A'.repeat(80)}`
  const image: WhiteboardObject = { kind: 'image', id: 'pic', src, x: 0, y: 0, w: 200, h: 160 }
  const ink: WhiteboardObject = {
    kind: 'stroke',
    id: 'ink',
    tool: 'pen',
    color: '#111',
    size: 3,
    points: [{ x: 10, y: 10 }, { x: 40, y: 10 }],
  }
  assert.equal(hitTestTop([image, ink], { x: 20, y: 10 }, 6)?.id, 'ink')
  assert.equal(hitTestTop([ink, image], { x: 120, y: 80 }, 6)?.id, 'pic')
  const kept = sanitizeWhiteboardObject(image)
  assert.equal(kept && kept.kind === 'image' ? kept.src : '', src)
  assert.equal(sanitizeWhiteboardObject({ ...image, src: 'https://example.com/a.jpg' }), null)
  const moved = translateObject(image, 12, -4)
  assert.equal(moved.kind === 'image' ? moved.x : 0, 12)
  assert.equal(moved.kind === 'image' ? moved.y : 0, -4)
  const crossed = pickObjectsInMarquee([image, ink], { x: 80, y: 80 }, { x: 0, y: 0 }, true)
  assert.deepEqual(crossed, ['ink'])
})

function boxesHit(a: { x: number; y: number }, aw: number, ah: number, b: { x: number; y: number }, bw: number, bh: number) {
  return a.x < b.x + bw + 16 && a.x + aw > b.x - 16 && a.y < b.y + bh + 16 && a.y + ah > b.y - 16
}

test('ảnh mới tránh khung phần tử đang có', () => {
  const block: WhiteboardObject = {
    kind: 'stroke',
    id: 's',
    tool: 'pen',
    color: '#111',
    size: 3,
    points: [{ x: -20, y: -10 }, { x: 20, y: 10 }],
  }
  const spot = placeWhiteboardImage([block], { x: 0, y: 0, scale: 1 }, 80, 60, 800, 600)
  const overlaps = spot.x < 28 && spot.x + 80 > -28 && spot.y < 18 && spot.y + 60 > -18
  assert.equal(overlaps, false)
})

test('hai ảnh chèn liên tiếp không đè nhau', () => {
  const src = `data:image/jpeg;base64,${'A'.repeat(80)}`
  const first: WhiteboardObject = { kind: 'image', id: 'a', src, x: -40, y: -30, w: 80, h: 60 }
  const cam = { x: 0, y: 0, scale: 1 }
  const secondAt = placeWhiteboardImage([first], cam, 80, 60, 800, 600)
  assert.equal(boxesHit(secondAt, 80, 60, first, 80, 60), false)
  const second: WhiteboardObject = { ...first, id: 'b', x: secondAt.x, y: secondAt.y }
  const thirdAt = placeWhiteboardImage([first, second], cam, 80, 60, 800, 600)
  assert.equal(boxesHit(thirdAt, 80, 60, first, 80, 60), false)
  assert.equal(boxesHit(thirdAt, 80, 60, second, 80, 60), false)
})

test('giữa màn bị lấp thì ảnh không rơi đè', () => {
  const cover: WhiteboardObject = {
    kind: 'shape',
    id: 'r',
    shape: 'rect',
    color: '#111',
    size: 2,
    points: [{ x: -200, y: -150 }, { x: 200, y: 150 }],
  }
  const spot = placeWhiteboardImage([cover], { x: 0, y: 0, scale: 1 }, 80, 60, 500, 400)
  assert.equal(spot.x < 216 && spot.x + 80 > -216 && spot.y < 166 && spot.y + 60 > -166, false)
})

test('bấm giữa bản đồ con là tâm vùng đang có nét', () => {
  const far: WhiteboardObject = { kind: 'stroke', id: 's', tool: 'pen', color: '#111', size: 3, points: [{ x: 400, y: 200 }, { x: 800, y: 600 }] }
  const bounds = whiteboardOverviewBounds([far], { x: 0, y: 0, scale: 1 }, 400, 300)
  assert.ok(bounds.minX < 0)
  assert.ok(bounds.maxX > 800)
  const cam = overviewCamera(bounds, 168, 112)
  const mid = screenToWorld(84, 56, cam, 168, 112)
  assert.ok(Math.abs(mid.x - (bounds.minX + bounds.maxX) / 2) < 1)
  assert.ok(Math.abs(mid.y - (bounds.minY + bounds.maxY) / 2) < 1)
})

test('xóa chỉ bỏ phần tử được chọn', () => {
  const objects: WhiteboardObject[] = [
    { kind: 'stroke', id: 'keep', tool: 'pen', color: '#111', size: 3, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] },
    { kind: 'stroke', id: 'drop', tool: 'pen', color: '#111', size: 3, points: [{ x: 20, y: 0 }, { x: 30, y: 0 }] },
    { kind: 'graph', id: 'axis', color: '#111', axis: 'y', expr: 'x', origin: { x: 0, y: 0 }, unit: 40, frameId: 'frame-a' },
    { kind: 'graph', id: 'curve', color: '#111', axis: 'y', expr: 'x^2', origin: { x: 0, y: 0 }, unit: 40, frameId: 'frame-a' },
  ]
  const gone = deleteWhiteboardSelection(objects, ['drop', 'missing', 'drop'])
  assert.deepEqual(gone.removedIds, ['drop'])
  assert.deepEqual(gone.objects.map((item) => item.id), ['keep', 'axis', 'curve'])
  const curve = deleteWhiteboardSelection(gone.objects, ['curve'])
  assert.deepEqual(curve.removedIds, ['curve'])
  assert.deepEqual(curve.objects.map((item) => item.id), ['keep', 'axis'])
  const none = deleteWhiteboardSelection(curve.objects, [])
  assert.equal(none.objects, curve.objects)
  assert.deepEqual(none.removedIds, [])
  assert.equal(whiteboardMarqueeIsSelection('touch', 80), false)
  assert.equal(whiteboardMarqueeIsSelection('mouse', 12), false)
  assert.equal(whiteboardMarqueeIsSelection('mouse', 28), true)
})
