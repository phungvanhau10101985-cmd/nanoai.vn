import assert from 'node:assert/strict'
import test from 'node:test'
import { cameraForPinchGesture, cameraZoomKeepingPoint, screenToWorld, segmentIntersection, whiteboardZoomStepPercent } from './geometry'

test('pinch mở hai ngón phóng to, điểm giữa đứng yên', () => {
  const cam = { x: 10, y: -4, scale: 1 }
  const mid = { x: 200, y: 150 }
  const world = screenToWorld(mid.x, mid.y, cam, 400, 300)
  const next = cameraForPinchGesture(cam, mid, 80, mid, 160, 400, 300)
  assert.equal(next.scale, 2)
  const kept = screenToWorld(mid.x, mid.y, next, 400, 300)
  assert.ok(Math.abs(kept.x - world.x) < 1e-6)
  assert.ok(Math.abs(kept.y - world.y) < 1e-6)
})

test('pinch khép hai ngón thu nhỏ', () => {
  const cam = { x: 0, y: 0, scale: 2 }
  const mid = { x: 100, y: 80 }
  const next = cameraForPinchGesture(cam, mid, 160, mid, 80, 400, 300)
  assert.equal(next.scale, 1)
  const floor = cameraForPinchGesture({ x: 0, y: 0, scale: 1 }, mid, 160, mid, 40, 400, 300)
  assert.equal(floor.scale, 0.5)
})

test('kéo cặp ngón pan theo tâm mới', () => {
  const cam = { x: 0, y: 0, scale: 1 }
  const start = { x: 200, y: 150 }
  const now = { x: 260, y: 170 }
  const world = screenToWorld(start.x, start.y, cam, 400, 300)
  const next = cameraForPinchGesture(cam, start, 100, now, 100, 400, 300)
  const kept = screenToWorld(now.x, now.y, next, 400, 300)
  assert.ok(Math.abs(kept.x - world.x) < 1e-6)
  assert.ok(Math.abs(kept.y - world.y) < 1e-6)
})

test('zoom giữ góc đối diện', () => {
  const cam = { x: 0, y: 0, scale: 1 }
  const opp = { x: 0, y: 0 }
  const world = screenToWorld(opp.x, opp.y, cam, 400, 300)
  const next = cameraZoomKeepingPoint(cam, opp, 2, 400, 300)
  const kept = screenToWorld(opp.x, opp.y, next, 400, 300)
  assert.equal(next.scale, 2)
  assert.ok(Math.abs(kept.x - world.x) < 1e-6)
  assert.ok(Math.abs(kept.y - world.y) < 1e-6)
})

test('nút zoom nhảy đúng nấc 10 phần trăm', () => {
  assert.equal(whiteboardZoomStepPercent(100, 1), 110)
  assert.equal(whiteboardZoomStepPercent(110, 1), 120)
  assert.equal(whiteboardZoomStepPercent(100, -1), 90)
  assert.equal(whiteboardZoomStepPercent(65, 1), 70)
  assert.equal(whiteboardZoomStepPercent(65, -1), 60)
  assert.equal(whiteboardZoomStepPercent(121, 1), 130)
  assert.equal(whiteboardZoomStepPercent(50, -1), 50)
  assert.equal(whiteboardZoomStepPercent(400, 1), 400)
})

test('phân giác cắt cạnh thì có giao, hai cạnh gặp ở đỉnh thì không', () => {
  const foot = segmentIntersection({ x: 0, y: 0 }, { x: 0, y: 40 }, { x: -30, y: 40 }, { x: 30, y: 40 })
  assert.ok(foot && Math.abs(foot.x) < 1e-6 && Math.abs(foot.y - 40) < 1e-6)
  assert.equal(
    segmentIntersection({ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 30 }),
    null,
  )
})
