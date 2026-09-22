import assert from 'node:assert/strict'
import test from 'node:test'
import { isValidMetaFbc, isValidMetaFbp } from '@/lib/partner-website/shop/partner-site-meta-attribution'

test('isValidMetaFbp/fbc require fb.1.{created}.{id} within 90 days', () => {
  const now = Date.now()
  assert.equal(isValidMetaFbp(`fb.1.${now}.1234567890123`), true)
  assert.equal(isValidMetaFbc(`fb.1.${now}.AbCdef`), true)
  assert.equal(isValidMetaFbp(`fb.1.${now - 91 * 24 * 60 * 60 * 1000}.1`), false)
  assert.equal(isValidMetaFbc('not-a-click-id'), false)
})
