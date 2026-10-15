import assert from 'node:assert/strict'
import test from 'node:test'
import { buildShopLlmsFullTxt, buildShopLlmsTxt, shopDisplayNameFromHost } from '@/lib/agent/shop-llms-txt'

test('shop llms.txt matches the Lighthouse agent file checks', () => {
  const body = buildShopLlmsTxt('https://gudo.vn', 'gudo.vn')
  assert.match(body, /^\s*#\s+.+/m)
  assert.match(body, /\[.+\]\(.+\)/)
  assert.ok(body.length >= 50)
  assert.match(body, /https:\/\/gudo\.vn\/products/)
  assert.equal(shopDisplayNameFromHost('www.gudo.vn'), 'Gudo')
})

test('shop llms-full.txt stays a short shop file', () => {
  const body = buildShopLlmsFullTxt('https://gudo.vn/', 'gudo.vn')
  assert.match(body, /# Gudo/)
  assert.match(body, /https:\/\/gudo\.vn\/tim-kiem/)
  assert.doesNotMatch(body, /nanoai\.vn\/thu-do-online/)
})
