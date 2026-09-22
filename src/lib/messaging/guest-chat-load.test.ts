import assert from 'node:assert/strict'
import test from 'node:test'
import {
  GUEST_CHAT_LOAD_RETRY_DELAYS_MS,
  guestChatHttpStatusShouldRetry,
  guestChatLoadShouldToast,
  isGuestChatLoadAbortError,
  nextGuestChatLoadRetryDelayMs,
} from '@/lib/messaging/guest-chat-load'

test('toast only on first visible load or older-page, never silent poll', () => {
  assert.equal(guestChatLoadShouldToast({ appendOlder: false, silent: false, hasLoadedOnce: false }), true)
  assert.equal(guestChatLoadShouldToast({ appendOlder: true, silent: false, hasLoadedOnce: true }), true)
  assert.equal(guestChatLoadShouldToast({ appendOlder: false, silent: true, hasLoadedOnce: false }), false)
  assert.equal(guestChatLoadShouldToast({ appendOlder: false, silent: false, hasLoadedOnce: true }), false)
  assert.equal(guestChatLoadShouldToast({ appendOlder: false, silent: true, hasLoadedOnce: true }), false)
})

test('retry 5xx/timeout/rate-limit, not 401/404', () => {
  assert.equal(guestChatHttpStatusShouldRetry(503), true)
  assert.equal(guestChatHttpStatusShouldRetry(500), true)
  assert.equal(guestChatHttpStatusShouldRetry(429), true)
  assert.equal(guestChatHttpStatusShouldRetry(408), true)
  assert.equal(guestChatHttpStatusShouldRetry(0), true)
  assert.equal(guestChatHttpStatusShouldRetry(401), false)
  assert.equal(guestChatHttpStatusShouldRetry(403), false)
  assert.equal(guestChatHttpStatusShouldRetry(404), false)
})

test('two backoff delays then stop', () => {
  assert.equal(nextGuestChatLoadRetryDelayMs(0), GUEST_CHAT_LOAD_RETRY_DELAYS_MS[0])
  assert.equal(nextGuestChatLoadRetryDelayMs(1), GUEST_CHAT_LOAD_RETRY_DELAYS_MS[1])
  assert.equal(nextGuestChatLoadRetryDelayMs(2), null)
  assert.equal(GUEST_CHAT_LOAD_RETRY_DELAYS_MS.length, 2)
})

test('AbortError is not a load-failed toast', () => {
  assert.equal(isGuestChatLoadAbortError({ name: 'AbortError', message: 'aborted' }), true)
  assert.equal(isGuestChatLoadAbortError(new Error('Failed to fetch')), false)
  assert.equal(isGuestChatLoadAbortError(null), false)
})
