import assert from 'node:assert/strict'
import test from 'node:test'
import { usesSystemKeyboard } from './system-keyboard'

test('điện thoại dùng bàn phím của máy', () => {
  assert.equal(usesSystemKeyboard({ pointerCoarse: true, hoverNone: true, maxTouchPoints: 5 }), true)
})

test('máy tính bảng dùng bàn phím của máy', () => {
  assert.equal(usesSystemKeyboard({ pointerCoarse: true, hoverNone: true, maxTouchPoints: 5, userAgent: 'Android' }), true)
  assert.equal(
    usesSystemKeyboard({
      pointerCoarse: false,
      hoverNone: false,
      maxTouchPoints: 5,
      platform: 'MacIntel',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    }),
    true
  )
})

test('desktop giữ bộ gõ dù cửa sổ hẹp hoặc có màn hình cảm ứng', () => {
  assert.equal(usesSystemKeyboard({ pointerCoarse: false, hoverNone: false, maxTouchPoints: 0 }), false)
  assert.equal(usesSystemKeyboard({ pointerCoarse: false, hoverNone: false, maxTouchPoints: 10, userAgent: 'Windows' }), false)
})
