import assert from 'node:assert/strict'
import test from 'node:test'
import { nextLauncherPos } from './floating-chat-widget'

test('nút chat không có hộp thì không cộng toạ độ', () => {
  const pos = { x: 100, y: 400 }
  assert.equal(
    nextLauncherPos(pos, { left: 0, top: 0, width: 0, height: 0 }, { x: 8, y: 8 }),
    null,
  )
})

test('nút chat đã nằm trong vùng nhìn thì giữ chỗ', () => {
  assert.equal(
    nextLauncherPos({ x: 20, y: 40 }, { left: 20, top: 40, width: 56, height: 56 }, { x: 20.4, y: 39.6 }),
    null,
  )
})

test('nút chat bị tràn thì kéo một lần vào mép nhìn thấy', () => {
  assert.deepEqual(
    nextLauncherPos({ x: 20, y: 700 }, { left: 20, top: 700, width: 56, height: 56 }, { x: 20, y: 336 }),
    { x: 20, y: 336 },
  )
})
