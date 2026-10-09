import assert from 'node:assert/strict'
import test from 'node:test'

import { shouldAutoForwardMissingHubFeature } from '@/lib/hub-chat/hub-feature-request-admin'

test('only a request with no tool page and no hub flow is forwarded', () => {
  assert.equal(
    shouldAutoForwardMissingHubFeature({
      activeDesign: false,
      matchedFeature: false,
      reportedMissing: true,
    }),
    true
  )
})

test('a catalog page, a hub flow, an in-progress design, or a short yes is not forwarded', () => {
  assert.equal(
    shouldAutoForwardMissingHubFeature({ activeDesign: false, matchedFeature: true, reportedMissing: true }),
    false
  )
  assert.equal(shouldAutoForwardMissingHubFeature({ activeDesign: true, matchedFeature: false, reportedMissing: true }), false)
  assert.equal(
    shouldAutoForwardMissingHubFeature({
      activeDesign: false,
      matchedFeature: false,
      reportedMissing: true,
      shortAffirmative: true,
    }),
    false
  )
  assert.equal(
    shouldAutoForwardMissingHubFeature({ activeDesign: false, matchedFeature: false, reportedMissing: false }),
    false
  )
})
