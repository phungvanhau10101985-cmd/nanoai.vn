import assert from 'node:assert/strict'
import test from 'node:test'
import {
  inferChromeWidgetKindFromHints,
  resolveChromeWidgetKind,
  resolveChromeWidgetKindFromHints,
} from './infer-chrome-widget-kind.ts'

test('wishlist beats generic /account in href', () => {
  assert.equal(
    inferChromeWidgetKindFromHints({
      href: '/site/188-shop/account/wishlist',
      label: 'Yêu thích',
    }),
    'wishlist'
  )
  assert.equal(
    inferChromeWidgetKindFromHints({
      href: '/site/188-shop/account?tab=wishlist',
      label: '',
    }),
    'wishlist'
  )
  assert.equal(
    inferChromeWidgetKindFromHints({
      href: '/site/188-shop/wishlist',
      className: 'pw-icon-btn',
      label: '2Yêu thích',
    }),
    'wishlist'
  )
})

test('topbar stock labels are not account', () => {
  assert.equal(
    resolveChromeWidgetKindFromHints({
      stamped: 'account',
      href: '/site/188-shop/contact',
      label: 'Liên hệ',
    }),
    'contact'
  )
  assert.equal(
    resolveChromeWidgetKindFromHints({
      stamped: 'account',
      href: '/site/188-shop/account',
      label: 'Yêu thích',
    }),
    'wishlist'
  )
  assert.equal(
    resolveChromeWidgetKindFromHints({
      stamped: 'account',
      href: '/site/188-shop/orders',
      label: 'Đơn hàng',
    }),
    'orders'
  )
  assert.equal(
    resolveChromeWidgetKindFromHints({
      stamped: 'account',
      href: '/site/188-shop/login',
      label: 'Đăng nhập',
    }),
    'login'
  )
})

test('text-only contact without path still infers from visible label', () => {
  assert.equal(inferChromeWidgetKindFromHints({ href: '#', label: 'Liên hệ' }), 'contact')
  assert.equal(inferChromeWidgetKindFromHints({ href: '#lead-form', label: 'Contact us' }), 'contact')
})

test('keeps favorites-link stamp when inferred is wishlist', () => {
  assert.equal(resolveChromeWidgetKind('favorites-link', 'wishlist'), 'favorites-link')
  assert.equal(resolveChromeWidgetKind('orders-link', 'orders'), 'orders-link')
})

test('account stamp on a favorites button resolves to wishlist', () => {
  assert.equal(
    resolveChromeWidgetKindFromHints({
      stamped: 'account',
      href: '/site/188-shop/account',
      label: 'Yêu thích',
    }),
    'wishlist'
  )
  assert.equal(resolveChromeWidgetKind('account', 'wishlist'), 'wishlist')
  assert.equal(resolveChromeWidgetKind('wishlist', ''), 'wishlist')
  assert.equal(resolveChromeWidgetKind('account', ''), 'account')
})

test('notifications and cart are not swallowed by /account', () => {
  assert.equal(
    inferChromeWidgetKindFromHints({
      href: '/site/188-shop/account/notifications',
      label: '3',
    }),
    'notifications'
  )
  assert.equal(
    inferChromeWidgetKindFromHints({
      href: '/site/188-shop/cart',
      label: '2Giỏ hàng',
    }),
    'cart'
  )
  assert.equal(
    inferChromeWidgetKindFromHints({
      href: '/site/188-shop/account',
      label: 'Tài khoản',
    }),
    'account'
  )
})

test('info and chat kinds from href or channel', () => {
  assert.equal(inferChromeWidgetKindFromHints({ href: '/site/s/privacy', label: 'Bảo mật' }), 'privacy')
  assert.equal(inferChromeWidgetKindFromHints({ href: '/site/s/terms', label: 'Điều khoản' }), 'terms')
  assert.equal(
    inferChromeWidgetKindFromHints({ href: 'https://zalo.me/123', contactChannel: 'zalo' }),
    'chat-zalo'
  )
  assert.equal(inferChromeWidgetKindFromHints({ openChat: true, label: '' }), 'chat')
  assert.equal(
    inferChromeWidgetKindFromHints({ href: 'https://instagram.com/shop', label: 'Instagram' }),
    'chat-instagram'
  )
  assert.equal(inferChromeWidgetKindFromHints({ href: 'tel:+84901234567', label: 'Gọi điện' }), 'phone')
  assert.equal(inferChromeWidgetKindFromHints({ href: 'https://wa.me/84901234567', label: 'WhatsApp' }), 'chat-whatsapp')
  assert.equal(inferChromeWidgetKindFromHints({ href: '#', label: 'Đăng xuất' }), 'logout')
  assert.equal(inferChromeWidgetKindFromHints({ href: '#', label: 'Đăng ký' }), 'register')
})
