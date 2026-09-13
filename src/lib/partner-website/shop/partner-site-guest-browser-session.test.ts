import assert from 'node:assert/strict'
import test from 'node:test'
import { PW_ENSURE_GUEST_BROWSER_SESSION_JS } from '@/lib/partner-website/shop/partner-site-guest-browser-session'

test('HTML bootstraps mint a guest browser session before personalization POSTs', () => {
  assert.match(PW_ENSURE_GUEST_BROWSER_SESSION_JS, /function pwEnsureGuestSessionId/)
  assert.match(PW_ENSURE_GUEST_BROWSER_SESSION_JS, /crypto\.randomUUID/)
  assert.match(PW_ENSURE_GUEST_BROWSER_SESSION_JS, /localStorage\.setItem\(SESSION_KEY/)
})
