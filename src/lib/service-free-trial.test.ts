import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getServiceFreeTrialDaysRemaining,
  isServiceFreeTrialActive,
} from '@/lib/service-free-trial'

test('curriculum trial lasts 18 days from first real use', () => {
  const started = '2026-10-01T00:00:00.000Z'
  const during = new Date('2026-10-18T00:00:00.000Z')
  const after = new Date('2026-10-19T00:00:00.000Z')
  assert.equal(isServiceFreeTrialActive(started, during), true)
  assert.equal(isServiceFreeTrialActive(started, after), false)
  assert.equal(getServiceFreeTrialDaysRemaining(started, during), 1)
  assert.equal(isServiceFreeTrialActive(null, during), false)
  assert.equal(getServiceFreeTrialDaysRemaining(null, during), 0)
})
