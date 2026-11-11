import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyPinAcrossScrollers,
  fieldPinDeltaPx,
  keyboardIsOpen,
  typingSheetFrame,
} from './pin-field-above-keyboard'

test('bàn phím che layout thì coi là đang mở', () => {
  assert.equal(
    keyboardIsOpen({ layoutHeight: 800, offsetTop: 0, visualHeight: 430, heightBeforeFocus: 800 }),
    true,
  )
})

test('viewport co lại sau lúc chạm thì coi là bàn phím, dù layout cũng co', () => {
  assert.equal(
    keyboardIsOpen({ layoutHeight: 430, offsetTop: 0, visualHeight: 430, heightBeforeFocus: 800 }),
    true,
  )
})

test('thanh trình duyệt mỏng không bị nhận là bàn phím', () => {
  assert.equal(
    keyboardIsOpen({ layoutHeight: 800, offsetTop: 0, visualHeight: 760, heightBeforeFocus: 800 }),
    false,
  )
})

test('ô thấp hơn bàn phím thì delta dương, ô cách xa phía trên thì delta âm', () => {
  assert.equal(fieldPinDeltaPx(500, 430), 78)
  assert.equal(fieldPinDeltaPx(280, 430), -142)
  assert.equal(fieldPinDeltaPx(422, 430), 0)
})

test('cuộn vùng trong trước, phần dư chuyển ra vùng ngoài', () => {
  const pinned = applyPinAcrossScrollers(
    [
      { scrollTop: 20, maxScroll: 50 },
      { scrollTop: 0, maxScroll: 400 },
    ],
    80,
  )
  assert.deepEqual(pinned.scrollTops, [50, 50])
  assert.equal(pinned.remain, 0)
})

test('ô đang quá cao thì kéo scroll về phía bàn phím, không âm quá 0', () => {
  const pinned = applyPinAcrossScrollers([{ scrollTop: 40, maxScroll: 200 }], -100)
  assert.deepEqual(pinned.scrollTops, [0])
  assert.equal(pinned.remain, -60)
})

test('sheet mobile bám đúng vùng nhìn thấy, desktop giữ nguyên', () => {
  assert.equal(typingSheetFrame({ mobile: false, offsetTop: 0, visualHeight: 400 }), null)
  assert.deepEqual(typingSheetFrame({ mobile: true, offsetTop: 0, visualHeight: 430 }), {
    top: 8,
    height: 414,
  })
  const shifted = typingSheetFrame({ mobile: true, offsetTop: 120, visualHeight: 400 })
  assert.equal(shifted?.top, 128)
  assert.equal((shifted?.top ?? 0) + (shifted?.height ?? 0), 120 + 400 - 8)
})
