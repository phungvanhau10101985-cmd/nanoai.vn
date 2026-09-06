import assert from 'node:assert/strict'
import test from 'node:test'
import {
  inferVisualDeviceFromUserAgent,
  resolveLiveVisualRequestDevice,
} from '@/lib/partner-website/shop/infer-live-visual-request-device'

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
const ANDROID_PHONE =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
const ANDROID_TABLET =
  'Mozilla/5.0 (Linux; Android 13; SM-X810) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const DESKTOP =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'
const IPADOS_DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'

test('query/header lock wins over UA and viewport', () => {
  assert.equal(
    resolveLiveVisualRequestDevice({
      queryOrHeader: 'desktop',
      viewportWidth: 390,
      userAgent: IPHONE,
    }),
    'desktop'
  )
})

test('iPhone UA wins over a wide Client Hint (Chrome DevTools)', () => {
  assert.equal(
    resolveLiveVisualRequestDevice({
      viewportWidth: 1600,
      devicePixelRatio: 1,
      userAgent: IPHONE,
    }),
    'mobile'
  )
})

test('iPhone UA stays mobile when viewport is tablet-sized (landscape / first paint)', () => {
  assert.equal(
    resolveLiveVisualRequestDevice({
      viewportWidth: 932,
      cookieDevice: 'tablet',
      userAgent: IPHONE,
    }),
    'mobile'
  )
})

test('Android phone UA stays mobile when viewport is tablet-sized', () => {
  assert.equal(
    resolveLiveVisualRequestDevice({
      viewportWidth: 800,
      cookieDevice: 'tablet',
      userAgent: ANDROID_PHONE,
    }),
    'mobile'
  )
})

test('Android tablet UA (no Mobile token) is tablet, not mobile', () => {
  assert.equal(inferVisualDeviceFromUserAgent(ANDROID_TABLET), 'tablet')
  assert.equal(
    resolveLiveVisualRequestDevice({
      viewportWidth: 390,
      cookieDevice: 'mobile',
      userAgent: ANDROID_TABLET,
    }),
    'tablet'
  )
})

test('narrow desktop window uses viewport, not desktop UA', () => {
  assert.equal(
    resolveLiveVisualRequestDevice({
      viewportWidth: 390,
      userAgent: DESKTOP,
    }),
    'mobile'
  )
})

test('wide desktop window stays desktop', () => {
  assert.equal(
    resolveLiveVisualRequestDevice({
      viewportWidth: 1440,
      userAgent: DESKTOP,
    }),
    'desktop'
  )
})

test('desktop UA uses cookie when present', () => {
  assert.equal(
    resolveLiveVisualRequestDevice({
      cookieDevice: 'tablet',
      viewportWidth: 1440,
      userAgent: DESKTOP,
    }),
    'tablet'
  )
})

test('iPadOS desktop UA with touch is tablet on the client', () => {
  assert.equal(inferVisualDeviceFromUserAgent(IPADOS_DESKTOP_UA, 5), 'tablet')
  assert.equal(inferVisualDeviceFromUserAgent(IPADOS_DESKTOP_UA, 0), null)
  assert.equal(
    resolveLiveVisualRequestDevice({
      userAgent: IPADOS_DESKTOP_UA,
      maxTouchPoints: 5,
      viewportWidth: 1440,
    }),
    'tablet'
  )
})
