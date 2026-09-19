import assert from 'node:assert/strict'
import test from 'node:test'
import {
  inferVisualDeviceFromUserAgent,
  partnerLiveVisualDeviceCookieAssignment,
  PW_LIVE_DOM_DEVICE_JS,
  resolveLiveVisualDeviceFromViewport,
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

test('viewport-width Client Hint without DPR in the FHD CSS band is not tablet', () => {
  assert.equal(
    resolveLiveVisualRequestDevice({
      viewportWidth: 1263,
      userAgent: DESKTOP,
    }),
    'desktop'
  )
})

test('narrow desktop window below the FHD CSS floor is still tablet', () => {
  assert.equal(
    resolveLiveVisualRequestDevice({
      viewportWidth: 900,
      userAgent: DESKTOP,
    }),
    'tablet'
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

test('desktop UA ignores leftover tablet cookie on a wide window', () => {
  assert.equal(
    resolveLiveVisualRequestDevice({
      cookieDevice: 'tablet',
      viewportWidth: 1440,
      userAgent: DESKTOP,
    }),
    'desktop'
  )
})

test('desktop UA ignores leftover tablet cookie when viewport is unknown', () => {
  assert.equal(
    resolveLiveVisualRequestDevice({
      cookieDevice: 'tablet',
      userAgent: DESKTOP,
    }),
    'desktop'
  )
})

test('desktop UA still uses laptop/desktop cookie when viewport is unknown', () => {
  assert.equal(
    resolveLiveVisualRequestDevice({
      cookieDevice: 'laptop',
      userAgent: DESKTOP,
    }),
    'laptop'
  )
})

test('F12 narrow viewport beats leftover desktop cookie', () => {
  assert.equal(
    resolveLiveVisualRequestDevice({
      cookieDevice: 'desktop',
      viewportWidth: 440,
      userAgent: DESKTOP,
    }),
    'mobile'
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

test('viewport helper: desktop window uses outerWidth (laptop vs desktop)', () => {
  assert.equal(
    resolveLiveVisualDeviceFromViewport({
      userAgent: DESKTOP,
      innerWidth: 1440,
      outerWidth: 1440,
      devicePixelRatio: 1,
    }),
    'desktop'
  )
  assert.equal(
    resolveLiveVisualDeviceFromViewport({
      userAgent: DESKTOP,
      innerWidth: 1366,
      outerWidth: 1366,
      devicePixelRatio: 1,
    }),
    'laptop'
  )
})

test('viewport helper: F12 device-mode phone UA is mobile even when the chrome window is wide', () => {
  assert.equal(
    resolveLiveVisualDeviceFromViewport({
      userAgent: IPHONE,
      innerWidth: 390,
      outerWidth: 1920,
      devicePixelRatio: 1,
    }),
    'mobile'
  )
})

test('viewport helper: desktop UA keeps desktop when innerWidth is only the scrollbar below 1280', () => {
  assert.equal(
    resolveLiveVisualDeviceFromViewport({
      userAgent: DESKTOP,
      innerWidth: 1263,
      outerWidth: 1280,
      screenWidth: 1280,
      devicePixelRatio: 1.5,
    }),
    'desktop'
  )
})

test('viewport helper: Windows 175% FHD (~1097 CSS) is desktop, not tablet', () => {
  assert.equal(
    resolveLiveVisualDeviceFromViewport({
      userAgent: DESKTOP,
      innerWidth: 1080,
      outerWidth: 1097,
      screenWidth: 1097,
      devicePixelRatio: 1.75,
    }),
    'desktop'
  )
})

test('viewport helper: docked DevTools on a desktop UA keeps the desktop machine', () => {
  assert.equal(
    resolveLiveVisualDeviceFromViewport({
      userAgent: DESKTOP,
      innerWidth: 800,
      outerWidth: 1920,
      screenWidth: 1920,
      devicePixelRatio: 1,
    }),
    'desktop'
  )
})

test('live device cookie assignment never implies a reload; phone UA clears leftover desktop cookie', () => {
  assert.equal(
    partnerLiveVisualDeviceCookieAssignment('laptop', DESKTOP),
    'pw-live-device=laptop; Path=/; Max-Age=604800; SameSite=Lax'
  )
  assert.equal(
    partnerLiveVisualDeviceCookieAssignment('desktop', IPHONE),
    'pw-live-device=; Path=/; Max-Age=0; SameSite=Lax'
  )
})

test('live DOM helper prefers stamp then FHD-aware resolver, not innerWidth>=1280', () => {
  assert.match(PW_LIVE_DOM_DEVICE_JS, /function pwLiveDomDevice/)
  assert.match(PW_LIVE_DOM_DEVICE_JS, /__pwCoordinate/)
  assert.match(PW_LIVE_DOM_DEVICE_JS, /dpr>=1\.25&&dpr<2&&w>=1080/)
  assert.doesNotMatch(PW_LIVE_DOM_DEVICE_JS, /innerWidth\s*>=\s*1280/)
})
