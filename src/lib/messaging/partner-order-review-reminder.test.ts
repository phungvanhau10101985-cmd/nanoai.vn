import assert from 'node:assert/strict'
import test from 'node:test'
import { deliveredInPartnerReviewReminderWindow } from './partner-order-review-reminder'

const NOW = new Date('2026-09-21T00:00:00.000Z')

test('review reminder window starts at day 3 and includes day 7', () => {
  assert.equal(
    deliveredInPartnerReviewReminderWindow('2026-09-18T00:00:00.000Z', NOW),
    true
  )
  assert.equal(
    deliveredInPartnerReviewReminderWindow('2026-09-14T00:00:00.000Z', NOW),
    true
  )
})

test('review reminder window excludes too-new, too-old and invalid delivery dates', () => {
  assert.equal(
    deliveredInPartnerReviewReminderWindow('2026-09-18T00:00:00.001Z', NOW),
    false
  )
  assert.equal(
    deliveredInPartnerReviewReminderWindow('2026-09-13T23:59:59.999Z', NOW),
    false
  )
  assert.equal(deliveredInPartnerReviewReminderWindow('invalid', NOW), false)
  assert.equal(deliveredInPartnerReviewReminderWindow(null, NOW), false)
})
