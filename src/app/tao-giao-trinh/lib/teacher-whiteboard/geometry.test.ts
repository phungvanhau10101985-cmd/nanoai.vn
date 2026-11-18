import assert from 'node:assert/strict'
import test from 'node:test'
import { cameraForPinchGesture, cameraZoomKeepingPoint, screenToWorld } from './geometry'

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
