import assert from 'node:assert/strict'
import test from 'node:test'

import { shouldAutoForwardMissingHubFeature } from '@/lib/hub-chat/hub-feature-request-admin'

test('an ask that matches no catalog feature is forwarded even if the model guessed a nearby tool', () => {
  assert.equal(
    shouldAutoForwardMissingHubFeature({
      activeDesign: false,
      matchedFeature: false,
    }),
    true
  )
})

test('a matched feature, an in-progress design, or a short yes is not forwarded', () => {
  assert.equal(shouldAutoForwardMissingHubFeature({ activeDesign: true, matchedFeature: false }), false)
  assert.equal(shouldAutoForwardMissingHubFeature({ activeDesign: false, matchedFeature: true }), false)
  assert.equal(
    shouldAutoForwardMissingHubFeature({ activeDesign: false, matchedFeature: false, shortAffirmative: true }),
    false
  )
})
