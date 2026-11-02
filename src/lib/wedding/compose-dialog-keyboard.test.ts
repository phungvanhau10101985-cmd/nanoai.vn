import assert from 'node:assert/strict'
import test from 'node:test'
import { composeDialogKeyboardFrame } from './compose-dialog-keyboard'

test('desktop and a closed keyboard keep the dialog centered', () => {
  assert.equal(
    composeDialogKeyboardFrame({ mobile: false, layoutHeight: 800, offsetTop: 0, visualHeight: 420 }),
    null,
  )
  assert.equal(
    composeDialogKeyboardFrame({ mobile: true, layoutHeight: 800, offsetTop: 0, visualHeight: 760 }),
    null,
  )
})

test('an open keyboard pins the dialog inside the visible viewport', () => {
  const frame = composeDialogKeyboardFrame({
    mobile: true,
    layoutHeight: 800,
    offsetTop: 0,
    visualHeight: 460,
  })
  assert.deepEqual(frame, { top: 8, maxHeight: 444 })
})

test('a scrolled visual viewport still sits above the keyboard', () => {
  const frame = composeDialogKeyboardFrame({
    mobile: true,
    layoutHeight: 844,
    offsetTop: 180,
    visualHeight: 420,
  })
  assert.ok(frame)
  assert.equal(frame.top, 188)
  assert.equal(frame.top + frame.maxHeight, 180 + 420 - 8)
})
