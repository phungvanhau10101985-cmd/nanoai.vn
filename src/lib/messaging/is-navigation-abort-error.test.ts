import assert from 'node:assert/strict'
import test from 'node:test'
import { isNavigationAbortError } from './is-navigation-abort-error'

test('detects AbortError name', () => {
  const err = new Error('The user aborted a request.')
  err.name = 'AbortError'
  assert.equal(isNavigationAbortError(err), true)
})

test('detects failed to fetch from aborted Server Action', () => {
  assert.equal(isNavigationAbortError(new TypeError('Failed to fetch')), true)
})

test('ignores unrelated errors', () => {
  assert.equal(isNavigationAbortError(new Error('DATABASE_URL is not set.')), false)
  assert.equal(isNavigationAbortError(null), false)
})
