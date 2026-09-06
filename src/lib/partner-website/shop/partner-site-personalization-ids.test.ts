import assert from 'node:assert/strict'
import test from 'node:test'
import { isPersonalizationIdsOnlyRequest } from '@/lib/partner-website/shop/partner-site-personalization'

test('isPersonalizationIdsOnlyRequest accepts idsOnly, countOnly, or limit=0', () => {
  assert.equal(isPersonalizationIdsOnlyRequest(new URLSearchParams('idsOnly=1')), true)
  assert.equal(isPersonalizationIdsOnlyRequest(new URLSearchParams('countOnly=1')), true)
  assert.equal(isPersonalizationIdsOnlyRequest(new URLSearchParams('limit=0')), true)
  assert.equal(isPersonalizationIdsOnlyRequest(new URLSearchParams('limit=48')), false)
  assert.equal(isPersonalizationIdsOnlyRequest(new URLSearchParams('offset=0&limit=8')), false)
})
