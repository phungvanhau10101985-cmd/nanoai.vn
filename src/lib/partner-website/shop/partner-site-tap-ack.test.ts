import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PW_SHOP_TAP_ACK_CSS,
  PW_SHOP_TAP_ACK_STORAGE_KEY,
  PW_SHOP_TAP_ACK_STYLE_ID,
  buildPartnerSiteTapAckScript,
} from './partner-site-tap-ack'
import { buildPartnerSiteNativeNavigationScript } from './partner-site-account-native-navigation'

test('tap-ack css uses theme tokens and stays above chrome without covering Sửa nhanh', () => {
  assert.match(PW_SHOP_TAP_ACK_CSS, /#pw-tap-ack-bar/)
  assert.match(PW_SHOP_TAP_ACK_CSS, /#pw-tap-ack-veil/)
  assert.match(PW_SHOP_TAP_ACK_CSS, /#pw-tap-ack-toast/)
  assert.match(PW_SHOP_TAP_ACK_CSS, /data-pw-tapped/)
  assert.match(PW_SHOP_TAP_ACK_CSS, /var\(--pw-primary/)
  assert.doesNotMatch(PW_SHOP_TAP_ACK_CSS, /#f97316|#ea580c/)
  assert.match(PW_SHOP_TAP_ACK_CSS, /body\.nanoai-ve-active #pw-tap-ack-bar/)
})

test('tap-ack runtime is parser-safe without a document and exposes hooks', () => {
  const script = buildPartnerSiteTapAckScript()
  assert.match(script, /window\.__pwTapAckBound/)
  assert.match(script, /window\.__pwShopTapAckPress/)
  assert.match(script, /window\.__pwShopTapAckNav/)
  assert.match(script, /window\.__pwShopTapAckNavEnd/)
  assert.match(script, /window\.__pwShopTapAckBusy/)
  assert.match(script, new RegExp(PW_SHOP_TAP_ACK_STORAGE_KEY))
  assert.match(script, new RegExp(PW_SHOP_TAP_ACK_STYLE_ID))
  assert.match(script, /Đã nhận thao tác/)
  assert.match(script, /Opening page/)
  assert.match(script, /nanoai-ve-active/)
  const win = {
    __pwTapAckBound: 0,
    addEventListener() {},
    document: null as unknown,
  }
  const run = new Function('window', script)
  run(win)
  assert.equal(typeof (win as { __pwShopTapAckPress?: unknown }).__pwShopTapAckPress, 'function')
  assert.equal(
    (win as { __pwShopTapAckPress: (event: object) => boolean }).__pwShopTapAckPress({
      button: 0,
      clientX: 12,
      clientY: 8,
      target: null,
    }),
    false
  )
})

test('native navigation prepends tap-ack and swallows extra presses while pending', () => {
  const script = buildPartnerSiteNativeNavigationScript('demo-shop')
  assert.match(script, /window\.__pwTapAckBound/)
  assert.match(script, /window\.__pwShopTapAckPress/)
  assert.match(script, /function ackNav\(/)
  assert.match(script, /function ackBusy\(/)
  assert.match(script, /function cardHitLink\(/)
  assert.match(script, /a\.pw-product-card-hit\[href\]/)
  assert.match(script, /ackBusy\(\)\|\|\(lastHref===href/)
  assert.match(script, /jsGateAt/)
  assert.match(script, /window\.location\.assign\(href\)/)
  assert.match(script, /function closeCatPanels\(/)
  assert.match(script, /closeCatPanels\(\)/)
  assert.match(script, /pw-shop-close-cat-panels/)
  assert.match(script, /data-pw-review-vote/)
  assert.match(script, /data-pw-rq-open-write/)
})
