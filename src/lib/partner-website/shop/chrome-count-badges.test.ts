import assert from 'node:assert/strict'
import test from 'node:test'
import {
  chromeCountBadgeKindFromAttr,
  chromeCountBadgeKindFromHref,
  chromeCountBadgeKindFromLabel,
  copyMissingChromeCountBadgeWidgets,
  DEMO_CHROME_COUNT_BADGES,
  formatChromeCountBadge,
  PW_CHROME_COUNT_BADGE_RUNTIME_JS,
  restampChromeCountBadgeWidgets,
} from '@/lib/partner-website/shop/chrome-count-badges'

test('chrome count badge infers kind from shop routes', () => {
  assert.equal(chromeCountBadgeKindFromHref('/site/188/cart'), 'cart')
  assert.equal(chromeCountBadgeKindFromHref('/cart'), 'cart')
  assert.equal(chromeCountBadgeKindFromHref('/site/188/recently-viewed'), 'recently-viewed')
  assert.equal(chromeCountBadgeKindFromHref('/account/recently-viewed?x=1'), 'recently-viewed')
  assert.equal(chromeCountBadgeKindFromHref('/site/188/account/notifications'), 'notifications')
  assert.equal(chromeCountBadgeKindFromHref('/wishlist'), 'wishlist')
  assert.equal(chromeCountBadgeKindFromHref('/products'), null)
})

test('chrome count badge maps widget attrs and formats counts', () => {
  assert.equal(chromeCountBadgeKindFromAttr('favorites-link'), 'wishlist')
  assert.equal(chromeCountBadgeKindFromAttr('cart'), 'cart')
  assert.equal(chromeCountBadgeKindFromAttr('', '/site/x/recently-viewed'), 'recently-viewed')
  assert.equal(chromeCountBadgeKindFromLabel('Thông báo'), 'notifications')
  assert.equal(chromeCountBadgeKindFromLabel('Giỏ hàng'), 'cart')
  assert.equal(chromeCountBadgeKindFromLabel('Vừa xem'), 'recently-viewed')
  assert.equal(chromeCountBadgeKindFromLabel('Sản phẩm đã xem'), 'recently-viewed')
  assert.match(PW_CHROME_COUNT_BADGE_RUNTIME_JS, /vừa xem/)
  assert.equal(formatChromeCountBadge(0), '')
  assert.equal(formatChromeCountBadge(3), '3')
  assert.equal(formatChromeCountBadge(120), '99+')
  assert.equal(DEMO_CHROME_COUNT_BADGES.notifications, 3)
  assert.equal(DEMO_CHROME_COUNT_BADGES.cart, 2)
  assert.equal(DEMO_CHROME_COUNT_BADGES['recently-viewed'], 4)
})

test('chrome count badge runtime js can stamp demo numbers', () => {
  assert.match(PW_CHROME_COUNT_BADGE_RUNTIME_JS, /pwApplyDemoChromeCountBadges/)
  assert.match(PW_CHROME_COUNT_BADGE_RUNTIME_JS, /pwSetChromeCountBadgeByKind/)
  assert.match(PW_CHROME_COUNT_BADGE_RUNTIME_JS, /recently-viewed/)
  assert.match(PW_CHROME_COUNT_BADGE_RUNTIME_JS, /pwIsAdminChromePreview/)
  assert.match(PW_CHROME_COUNT_BADGE_RUNTIME_JS, /lucide-bell/)
  assert.match(PW_CHROME_COUNT_BADGE_RUNTIME_JS, /thông báo/)
  assert.doesNotMatch(PW_CHROME_COUNT_BADGE_RUNTIME_JS, /pw-device=/)
})

test('count badge widgets copy onto the other device html', () => {
  const desktop = `<!DOCTYPE html><html><body>
    <header class="pw-header"><div class="pw-header-actions">
      <a class="pw-shop-icon-btn" data-pw-chrome-btn="notifications" data-pw-chrome-added="1" data-pw-device="desktop" href="/site/188/account/notifications" style="transform: translate(346px, 0px);">Bell<span class="pw-cart-badge" data-pw-chrome-badge>3</span></a>
    </div></header>
    <nav class="pw-bottom-nav">
      <a data-pw-chrome-btn="cart" data-pw-chrome-added="1" data-pw-chrome-place="nav" href="/site/188/cart">Cart</a>
    </nav>
  </body></html>`
  const mobile = `<!DOCTYPE html><html><body>
    <header class="pw-header"><div class="pw-header-actions"><a data-pw-chrome-btn="account" href="/account">Acc</a></div></header>
    <nav class="pw-bottom-nav"><a href="/">Home</a></nav>
  </body></html>`
  const next = copyMissingChromeCountBadgeWidgets(desktop, mobile, 'mobile')
  assert.match(next, /data-pw-chrome-btn="notifications"/)
  assert.match(next, /data-pw-chrome-btn="cart"/)
  assert.match(next, /data-pw-device="mobile"/)
  assert.match(next, /data-pw-chrome-count="1"/)
  assert.doesNotMatch(next, /translate\(346px/)
  const again = copyMissingChromeCountBadgeWidgets(desktop, next, 'mobile')
  assert.equal((again.match(/data-pw-chrome-btn="notifications"/g) || []).length, 1)
  assert.equal((again.match(/data-pw-chrome-btn="cart"/g) || []).length, 1)
})

test('restamp on the same device keeps the dragged notification position', () => {
  const html = `<a class="pw-shop-icon-btn" data-pw-chrome-btn="notifications" href="/account/notifications" style="transform: translate(346px, 0px);">Bell</a>`
  const next = restampChromeCountBadgeWidgets(html, 'desktop')
  assert.match(next, /transform:\s*translate\(346px, 0px\)/)
  assert.match(next, /data-pw-device="desktop"/)
  assert.match(next, /data-pw-chrome-count="1"/)
})
