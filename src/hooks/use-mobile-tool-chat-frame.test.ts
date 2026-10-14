import assert from 'node:assert/strict'
import test from 'node:test'
import { mobileToolChatFrameFromBox } from './use-mobile-tool-chat-frame'

const base = {
  mobile: true,
  backBottomPx: 128.4,
  dockHeightPx: 88,
  layoutHeightPx: 800,
  visualOffsetTopPx: 0,
  visualHeightPx: 800,
}

test('desktop does not pin the chat frame', () => {
  assert.equal(mobileToolChatFrameFromBox({ ...base, mobile: false }), null)
})

test('missing dock keeps the CSS bottom instead of sinking the frame to 0', () => {
  assert.deepEqual(mobileToolChatFrameFromBox({ ...base, dockHeightPx: 0 }), { top: 128, bottom: null })
  assert.deepEqual(mobileToolChatFrameFromBox({ ...base, dockHeightPx: 40 }), { top: 128, bottom: null })
})

test('measured dock sits the composer on the bar', () => {
  assert.deepEqual(mobileToolChatFrameFromBox(base), { top: 128, bottom: 88 })
})

test('keyboard lift clears the keyboard without stacking the dock height', () => {
  assert.deepEqual(
    mobileToolChatFrameFromBox({ ...base, visualOffsetTopPx: 0, visualHeightPx: 470 }),
    { top: 128, bottom: 330 }
  )
})

test('chat top follows the header when the back control sits inside it', () => {
  assert.deepEqual(
    mobileToolChatFrameFromBox({ ...base, backBottomPx: 40, headerBottomPx: 49 }),
    { top: 49, bottom: 88 }
  )
})

test('a short visual gap such as the URL bar does not lift the composer', () => {
  assert.deepEqual(
    mobileToolChatFrameFromBox({ ...base, visualHeightPx: 760 }),
    { top: 128, bottom: 88 }
  )
})
