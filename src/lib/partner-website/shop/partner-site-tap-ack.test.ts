import assert from 'node:assert/strict'
import test from 'node:test'
import { parseHTML } from 'linkedom'
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
    (win as unknown as { __pwShopTapAckPress: (event: object) => boolean }).__pwShopTapAckPress({
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
  assert.match(script, /button,\.pw-shop-order-card/)
  assert.match(script, /a\.pw-product-card-hit\[href\]/)
  assert.match(script, /ackBusy\(\)\|\|\(lastHref===href/)
  assert.match(script, /jsGateAt/)
  assert.match(script, /window\.location\.assign\(href\)/)
  assert.match(script, /function closeCatPanels\(/)
  assert.match(script, /closeCatPanels\(\)/)
  assert.match(script, /pw-shop-close-cat-panels/)
  assert.match(script, /data-pw-review-vote/)
  assert.match(script, /data-pw-rq-open-write/)
  assert.match(script, /new RegExp\('\^\/site\/\[\^\/\]\+'\)/)
  assert.doesNotThrow(() => new Function(script))
})

test('order list buttons do not follow the product link inside the card', () => {
  const { window, document } = parseHTML(`<!doctype html><html><body>
    <li class="pw-shop-order-card" data-pw-el="card">
      <a class="pw-shop-product-hit-name" href="/products/giay-sneaker">Giày sneaker</a>
      <button type="button" class="detail" data-pw-native-nav="off">Chi tiết đơn</button>
      <button type="button" class="track">Theo dõi đơn</button>
    </li>
  </body></html>`)
  const navigated: string[] = []
  const location = {
    href: 'http://localhost:3000/site/demo-shop/orders',
    origin: 'http://localhost:3000',
    pathname: '/site/demo-shop/orders',
    search: '',
    assign(href: string) {
      navigated.push(String(href))
    },
  }
  Object.defineProperty(window, 'location', { value: location, configurable: true })
  const script = buildPartnerSiteNativeNavigationScript('demo-shop')
  new Function('window', 'document', script)(window, document)

  const detail = document.querySelector('button.detail') as HTMLButtonElement
  const track = document.querySelector('button.track') as HTMLButtonElement
  const name = document.querySelector('.pw-shop-product-hit-name') as HTMLAnchorElement
  let detailClicks = 0
  detail.addEventListener('click', () => {
    detailClicks += 1
  })

  const press = (el: Element, type: string) => {
    const event = new window.Event(type, { bubbles: true, cancelable: true })
    Object.defineProperties(event, {
      clientX: { value: 12 },
      clientY: { value: 8 },
      button: { value: 0 },
      pointerId: { value: 1 },
      pointerType: { value: 'mouse' },
    })
    el.dispatchEvent(event)
  }
  const tap = (el: Element) => {
    press(el, 'pointerdown')
    press(el, 'pointerup')
    press(el, 'click')
  }

  tap(detail)
  tap(track)
  assert.equal(navigated.length, 0)
  assert.equal(detailClicks, 1)

  tap(name)
  assert.equal(navigated.length, 1)
  assert.match(navigated[0] || '', /\/products\/giay-sneaker/)
})
