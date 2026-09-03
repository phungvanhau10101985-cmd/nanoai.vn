import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveLiveVisualRequestDevice } from '@/lib/partner-website/shop/infer-live-visual-request-device'

test('query/header lock wins over UA and viewport', () => {
  assert.equal(
    resolveLiveVisualRequestDevice({
      queryOrHeader: 'desktop',
      viewportWidth: 390,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    }),
    'desktop'
  )
})

test('iPhone UA wins over a wide Client Hint (Chrome DevTools)', () => {
  assert.equal(
    resolveLiveVisualRequestDevice({
      viewportWidth: 1600,
      devicePixelRatio: 1,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    }),
    'mobile'
  )
})

test('narrow desktop window uses viewport, not desktop UA', () => {
  assert.equal(
    resolveLiveVisualRequestDevice({
      viewportWidth: 390,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
    }),
    'mobile'
  )
})

test('wide desktop window stays desktop', () => {
  assert.equal(
    resolveLiveVisualRequestDevice({
      viewportWidth: 1440,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
    }),
    'desktop'
  )
})
