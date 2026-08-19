import assert from 'node:assert/strict'
import test from 'node:test'
import {
  chromeFloatDefaultBottomPx,
  isChromeFloatKind,
  PARTNER_SHOP_CHROME_FLOAT_CSS,
  PARTNER_SHOP_CHROME_FLOAT_POS_JS,
  PARTNER_SHOP_CHROME_FLOAT_SCRIPT,
  PW_CHROME_FLOAT_DEFAULT_BOTTOM_PX,
  PW_CHROME_FLOAT_KINDS,
  PW_CHROME_FLOAT_Z_INDEX,
  resetChromeFloatUserMoveInHtml,
} from '@/lib/partner-website/shop/chrome-float-widgets'

test('chat Zalo Facebook and top-up are viewport-fixed chrome', () => {
  assert.deepEqual([...PW_CHROME_FLOAT_KINDS], ['chat', 'chat-zalo', 'chat-facebook', 'topup'])
  assert.equal(isChromeFloatKind('chat'), true)
  assert.equal(isChromeFloatKind('chat-zalo'), true)
  assert.equal(isChromeFloatKind('chat-facebook'), true)
  assert.equal(isChromeFloatKind('topup'), true)
  assert.equal(isChromeFloatKind('cart'), false)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_CSS.includes('position:fixed'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_CSS.includes(`z-index:${PW_CHROME_FLOAT_Z_INDEX}!important`), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_CSS.includes('isolation:isolate!important'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_SCRIPT.includes(`'${PW_CHROME_FLOAT_Z_INDEX}'`), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_CSS.includes('[data-pw-chrome-btn="chat-zalo"]'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_SCRIPT.includes('["chat","chat-zalo","chat-facebook","topup"]'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_SCRIPT.includes('data-pw-user-move'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_SCRIPT.includes('pwChromeFloatRemap'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_SCRIPT.includes('pwChromeFloatBakePct'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_SCRIPT.includes('pwChromeFloatSeatDefault'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_POS_JS.includes('pwChromeFloatSeatDefault'), true)
  assert.equal(chromeFloatDefaultBottomPx('topup'), PW_CHROME_FLOAT_DEFAULT_BOTTOM_PX.topup)
  assert.equal(chromeFloatDefaultBottomPx('chat'), PW_CHROME_FLOAT_DEFAULT_BOTTOM_PX.chat)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_SCRIPT.includes("toFixed(2)+'%'"), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_SCRIPT.includes('getBoundingClientRect'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_CSS.includes('pointer-events:auto!important'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_SCRIPT.includes('document.body.appendChild'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_SCRIPT.includes("el.parentNode !== document.body"), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_SCRIPT.includes("tf !== 'none'"), false)
})

test('top-up stays hidden until the page is scrolled on every device', () => {
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_CSS.includes('body.nanoai-ve-active [data-pw-chrome-btn="topup"]'), false)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_CSS.includes('[data-pw-chrome-btn="topup"][data-nanoai-ve-selected]'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_CSS.includes('[data-pw-chrome-btn="topup"].nanoai-ve-highlight'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_SCRIPT.includes('editing()'), false)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_SCRIPT.includes('capture: true'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_SCRIPT.includes('visualViewport'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_SCRIPT.includes('h < 900'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_SCRIPT.includes('__pwChromeTopupSync'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_SCRIPT.includes('dedupeFloats'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_SCRIPT.includes('data-pw-float-dup'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_CSS.includes('[data-pw-float-dup="1"]'), true)
})

test('resetChromeFloatUserMoveInHtml drops leftover Desktop pins on Tư vấn', () => {
  const html =
    '<button data-pw-chrome-btn="chat" data-pw-chrome-float="1" data-pw-user-move="1" style="left:1700px;top:600px;position:fixed">Tư vấn</button>'
  const next = resetChromeFloatUserMoveInHtml(html)
  assert.equal(next.includes('data-pw-user-move'), false)
  assert.equal(next.includes('left:1700px'), false)
  assert.equal(next.includes('top:600px'), false)
  assert.equal(next.includes('data-pw-chrome-btn="chat"'), true)
})
