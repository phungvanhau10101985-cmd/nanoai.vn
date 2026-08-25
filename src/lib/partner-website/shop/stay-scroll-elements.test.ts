import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PARTNER_SHOP_HIDDEN_CSS,
  PARTNER_SHOP_STAY_SCROLL_CSS,
  PARTNER_SHOP_STAY_SCROLL_SCRIPT,
  PW_HIDDEN_ATTR,
  PW_STAY_SCROLL_ATTR,
  PW_STAY_SCROLL_LAYER_ATTR,
  PW_STAY_SCROLL_SCRIPT_ID,
  PW_STAY_SCROLL_X_ATTR,
  PW_STAY_SCROLL_Y_ATTR,
  prepareVisualDomForStore,
  rehomeInflowSceneChromeInDocument,
  restoreLiveChromePins,
  restoreStayScrollPins,
} from '@/lib/partner-website/shop/stay-scroll-elements'

test('stay-scroll keeps the element in place without floating overlay', () => {
  assert.equal(PW_STAY_SCROLL_ATTR, 'data-pw-stay-scroll')
  assert.equal(PW_STAY_SCROLL_X_ATTR, 'data-pw-stay-x')
  assert.equal(PW_STAY_SCROLL_Y_ATTR, 'data-pw-stay-y')
  assert.equal(PW_STAY_SCROLL_SCRIPT_ID, 'pw-shop-stay-scroll')
  assert.equal(PARTNER_SHOP_STAY_SCROLL_CSS.includes(PW_STAY_SCROLL_ATTR), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes('restackLayer'), false)
  assert.equal(PW_STAY_SCROLL_LAYER_ATTR, 'data-pw-stay-layer')
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes('document.body.appendChild'), false)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes('document.documentElement.insertBefore'), false)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes('html.insertBefore'), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes("position', 'fixed'"), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes('addEventListener(\'scroll\''), false)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_CSS.includes('position:fixed'), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_CSS.includes(PW_STAY_SCROLL_LAYER_ATTR), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_CSS.includes('display:contents'), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_CSS.includes('z-index:210'), false)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_CSS.includes('[data-pw-stay-scroll="1"][data-pw-scene="1"]{z-index:100!important}'), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_CSS.includes('[data-pw-stay-layer="1"]>[data-pw-scene="4"]{z-index:400!important}'), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_CSS.includes('pointer-events:none'), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_CSS.includes('[data-pw-stay-scroll="1"][data-pw-added-bg="1"]{pointer-events:none!important}'), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes('scene *'), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes('rehomeInflowSceneChrome'), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes('escapeHigherScenes'), false)
  assert.equal(typeof rehomeInflowSceneChromeInDocument, 'function')
  assert.equal(typeof prepareVisualDomForStore, 'function')
  assert.equal(PARTNER_SHOP_STAY_SCROLL_CSS.includes('body:not(.nanoai-ve-active)'), false)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes('__pwStayScrollCapture'), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes('ensurePlaceholder'), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes('data-pw-stay-w'), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes('data-pw-stay-h'), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_CSS.includes('data-pw-stay-ph-slot'), true)
  assert.equal(PW_HIDDEN_ATTR, 'data-pw-hidden')
  assert.equal(PARTNER_SHOP_HIDDEN_CSS.includes('[data-pw-hidden="1"]{display:none!important}'), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes('--pw-scene-w'), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes('--pw-scene-zoom'), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes('data-pw-inline-visual-root'), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes("querySelector('[data-pw-inline-visual-root]')"), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes("if (document.querySelector('[data-pw-inline-visual-root]')) return"), false)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes("left', x + '%'"), false)
  assert.equal(typeof restoreStayScrollPins, 'function')
  assert.equal(typeof restoreLiveChromePins, 'function')
})
