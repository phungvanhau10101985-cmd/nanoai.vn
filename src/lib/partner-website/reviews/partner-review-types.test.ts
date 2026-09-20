import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizePartnerReviewVoterKey,
  partnerReviewVoterKeys,
  partnerReviewVoterKeysFromVisitor,
} from '@/lib/partner-website/reviews/partner-review-types'

test('normalizePartnerReviewVoterKey strips guest/user prefixes', () => {
  assert.equal(normalizePartnerReviewVoterKey('guest:abc-1'), 'abc-1')
  assert.equal(normalizePartnerReviewVoterKey('user:abc-1'), 'abc-1')
  assert.equal(normalizePartnerReviewVoterKey('  ABC  '), 'ABC')
})

test('partnerReviewVoterKeys keeps login then guest then fallback, unique', () => {
  assert.deepEqual(
    partnerReviewVoterKeys('linked-1', 'guest-1', 'linked-1', 'guest:guest-1'),
    ['linked-1', 'guest-1']
  )
  assert.deepEqual(partnerReviewVoterKeys(null, '', 'only'), ['only'])
})

test('partnerReviewVoterKeysFromVisitor matches any identity after login', () => {
  assert.deepEqual(
    partnerReviewVoterKeysFromVisitor({
      linkedUserId: 'user-uuid',
      guestAccountId: 'guest-uuid',
      accountKey: 'guest-uuid',
    }),
    ['user-uuid', 'guest-uuid']
  )
})
