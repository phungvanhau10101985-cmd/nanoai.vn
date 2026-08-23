import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PARTNER_SHOP_HIDDEN_CSS,
  PARTNER_SHOP_STAY_SCROLL_CSS,
  PARTNER_SHOP_STAY_SCROLL_SCRIPT,
  PW_HIDDEN_ATTR,
  PW_STAY_SCROLL_ATTR,
  PW_STAY_SCROLL_SCRIPT_ID,
  PW_STAY_SCROLL_X_ATTR,
  PW_STAY_SCROLL_Y_ATTR,
} from '@/lib/partner-website/shop/stay-scroll-elements'

test('stay-scroll keeps the element in place without floating overlay', () => {
  assert.equal(PW_STAY_SCROLL_ATTR, 'data-pw-stay-scroll')
  assert.equal(PW_STAY_SCROLL_X_ATTR, 'data-pw-stay-x')
  assert.equal(PW_STAY_SCROLL_Y_ATTR, 'data-pw-stay-y')
  assert.equal(PW_STAY_SCROLL_SCRIPT_ID, 'pw-shop-stay-scroll')
  assert.equal(PARTNER_SHOP_STAY_SCROLL_CSS.includes(PW_STAY_SCROLL_ATTR), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes("z-index"), false)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes('document.body.appendChild'), false)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes("position', 'fixed'"), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes('addEventListener(\'scroll\''), false)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_CSS.includes('position:fixed'), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes('__pwStayScrollCapture'), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes('ensurePlaceholder'), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes('data-pw-stay-w'), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes('data-pw-stay-h'), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_CSS.includes('data-pw-stay-ph-slot'), true)
  assert.equal(PW_HIDDEN_ATTR, 'data-pw-hidden')
  assert.equal(PARTNER_SHOP_HIDDEN_CSS.includes('[data-pw-hidden="1"]{display:none!important}'), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes('--pw-scene-w'), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes('data-pw-inline-visual-root'), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes("left', x + '%'"), false)
})
