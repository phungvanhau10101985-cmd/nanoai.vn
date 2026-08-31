import assert from 'node:assert/strict'
import test from 'node:test'
import {
  chromeFloatDefaultBottomPx,
  chromeFloatDomOrderFromVisual,
  clampChromeFloatEdge,
  isChromeFloatKind,
  visualOrderOfChromeFloatDom,
  PARTNER_SHOP_CHROME_FLOAT_CSS,
  PARTNER_SHOP_CHROME_FLOAT_POS_JS,
  PARTNER_SHOP_CHROME_FLOAT_SCRIPT,
  PW_CHROME_FLOAT_DEFAULT_BOTTOM_PX,
  PW_CHROME_FLOAT_DEFAULT_RIGHT_PX,
  PW_CHROME_FLOAT_KINDS,
  clampChromeFloatGap,
  chromeFloatItemSizeOf,
  clampChromeFloatSize,
  PW_FLOAT_BOTTOM_ATTR,
  PW_FLOAT_GAP_ATTR,
  PW_FLOAT_GAP_DEFAULT,
  PW_FLOAT_SIZE_ATTR,
  PW_FLOAT_SIZE_DEFAULT,
  PW_FLOAT_RIGHT_ATTR,
  PW_FLOAT_STACK_BOTTOM_ATTR,
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
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_SCRIPT.includes('function pwChromeFloatBakePct(el,box)'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_SCRIPT.includes('function pwChromeFloatLiftAndPin(el,box)'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_CSS.includes('[data-pw-chrome-added][data-pw-pin-screen="1"]'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_CSS.includes('display:inline-flex!important'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_SCRIPT.includes('pwChromeFloatSeatDefault'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_POS_JS.includes('pwChromeFloatSeatDefault'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_POS_JS.includes('pwChromeFloatSeatEdge'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_POS_JS.includes('pwChromeFloatWriteEdge'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_POS_JS.includes('function pwChromeFloatMoveBy'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_POS_JS.includes('function pwChromeFloatDragFrom'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_SCRIPT.includes('nanoai-ve-dragging'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_SCRIPT.includes('[data-nanoai-ve-selected][data-pw-chrome-float="1"]'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_CSS.includes('data-pw-fixed-anchor="right-bottom"'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_CSS.includes('--pw-float-right'), true)
  assert.equal(clampChromeFloatEdge(-20), 0)
  assert.equal(clampChromeFloatEdge(80), 80)
  assert.equal(PW_CHROME_FLOAT_DEFAULT_RIGHT_PX, 16)
  assert.equal(PW_FLOAT_RIGHT_ATTR, 'data-pw-float-right')
  assert.equal(PW_FLOAT_BOTTOM_ATTR, 'data-pw-float-bottom')
  assert.equal(chromeFloatDefaultBottomPx('topup'), PW_CHROME_FLOAT_DEFAULT_BOTTOM_PX.topup)
  assert.equal(chromeFloatDefaultBottomPx('chat'), PW_CHROME_FLOAT_DEFAULT_BOTTOM_PX.chat)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_SCRIPT.includes("toFixed(2)+'%'"), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_SCRIPT.includes('getBoundingClientRect'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_CSS.includes('pointer-events:auto!important'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_SCRIPT.includes('host.appendChild(el)'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_SCRIPT.includes('el.parentNode!==host') || PARTNER_SHOP_CHROME_FLOAT_SCRIPT.includes('el.parentNode !== host'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_SCRIPT.includes('if (!pwChromeFloatShouldBake(el)) continue'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_SCRIPT.includes("classList.contains('nanoai-ve-active')"), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_SCRIPT.includes("tf !== 'none'"), false)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_POS_JS.includes('function pwChromeFloatApplyStack'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_POS_JS.includes('function pwChromeFloatEscapeScaledRoot'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_POS_JS.includes('[data-pw-inline-visual-root]'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_POS_JS.includes('pwChromeFloatEscapeScaledRoot(pwChromeFloatKitHost())'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_POS_JS.includes('function pwChromeFloatStackWrite'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_POS_JS.includes(PW_FLOAT_STACK_BOTTOM_ATTR), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_POS_JS.includes(PW_FLOAT_GAP_ATTR), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_CSS.includes('[data-pw-hidden="1"]'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_CSS.includes('[data-pw-hidden="1"][data-nanoai-ve-selected]'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_CSS.includes('visibility:visible!important;pointer-events:auto!important;opacity:1!important'), false)
  assert.equal(clampChromeFloatGap(12), 36)
  assert.equal(clampChromeFloatGap(80), 80)
  assert.equal(PW_FLOAT_GAP_DEFAULT, 56)
  assert.equal(PW_FLOAT_SIZE_DEFAULT, 40)
  assert.equal(PW_FLOAT_SIZE_ATTR, 'data-pw-float-size')
  assert.equal(clampChromeFloatSize(8), 16)
  assert.equal(clampChromeFloatSize(40), 40)
  assert.equal(clampChromeFloatSize(240), 200)
  assert.equal(chromeFloatItemSizeOf(60, 40), 60)
  assert.equal(chromeFloatItemSizeOf('', 44), 44)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_POS_JS.includes('pwChromeFloatEnsureCircle'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_POS_JS.includes('pwChromeFloatApplyIconSize'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_POS_JS.includes('pwChromeFloatItemSize'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_POS_JS.includes('pwChromeFloatApplyIconSize(el,st.size)'), false)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_POS_JS.includes(PW_FLOAT_SIZE_ATTR), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_CSS.includes('--pw-float-size'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_CSS.includes('[data-pw-chrome-btn]:not([data-pw-chrome-size])'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_CSS.includes('icon-circle'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_CSS.includes('[data-pw-chrome-kit="float"] .pw-chrome-icon-wrap svg'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_POS_JS.includes("querySelector('.pw-chrome-icon-wrap')"), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_POS_JS.includes("setAttribute('width',String(size))"), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_POS_JS.includes("setProperty('width',px,'important')"), true)
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
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_SCRIPT.includes('pwChromeFloatShouldBake'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_SCRIPT.includes('pwChromeFloatKeepScore'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_SCRIPT.includes('data-pw-chrome-kit="float"'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_CSS.includes('[data-pw-float-dup="1"]'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_CSS.includes('html[data-pw-edit-device]'), true)
  assert.equal(PARTNER_SHOP_CHROME_FLOAT_CSS.includes('--pw-scene-w'), true)
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

test('float panel order is screen top-to-bottom, opposite of bottom-up DOM', () => {
  const dom = ['topup', 'chat', 'chat-zalo', 'chat-facebook']
  const visual = visualOrderOfChromeFloatDom(dom)
  assert.deepEqual(visual, ['chat-facebook', 'chat-zalo', 'chat', 'topup'])
  assert.deepEqual(chromeFloatDomOrderFromVisual(visual), [...dom])
  const afterUp = ['chat-zalo', 'chat-facebook', 'chat', 'topup']
  assert.deepEqual(chromeFloatDomOrderFromVisual(afterUp), ['topup', 'chat', 'chat-facebook', 'chat-zalo'])
})
