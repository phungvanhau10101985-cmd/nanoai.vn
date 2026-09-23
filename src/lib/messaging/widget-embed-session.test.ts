import assert from 'node:assert/strict'
import test from 'node:test'
import { chatIframeHrefMatchesConfiguredUrl } from '@/lib/messaging/widget-embed-session'

test('saved localhost chat iframe does not match production chat url', () => {
  assert.equal(
    chatIframeHrefMatchesConfiguredUrl(
      'http://localhost:3000/messaging/p/188-com-vn-rl56?embed=1',
      'https://nanoai.vn/messaging/p/188-com-vn-rl56?embed=1',
    ),
    false,
  )
})

test('saved chat iframe on the same host still matches', () => {
  assert.equal(
    chatIframeHrefMatchesConfiguredUrl(
      'https://nanoai.vn/messaging/p/188-com-vn-rl56?embed=1&ctx_sku=A1',
      'https://nanoai.vn/messaging/p/188-com-vn-rl56?embed=1',
    ),
    true,
  )
})
