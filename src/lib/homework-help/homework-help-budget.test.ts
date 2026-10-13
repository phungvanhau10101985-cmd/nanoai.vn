import assert from 'node:assert/strict'
import test from 'node:test'
import {
  HOMEWORK_FLASH_CALL_MS,
  HOMEWORK_HELP_BUDGET_MS,
  HOMEWORK_PRO_CALL_MS,
  homeworkCallTimeoutMs,
} from '@/lib/homework-help/homework-help-budget'

const started = 1_000_000

test('a fresh homework solve gets the full model timeout', () => {
  assert.equal(homeworkCallTimeoutMs(started, started, HOMEWORK_PRO_CALL_MS), HOMEWORK_PRO_CALL_MS)
  assert.equal(homeworkCallTimeoutMs(started, started, HOMEWORK_FLASH_CALL_MS), HOMEWORK_FLASH_CALL_MS)
})

test('a late call is shortened so the action still answers before nginx cuts it', () => {
  const now = started + 180_000
  assert.equal(homeworkCallTimeoutMs(started, now, HOMEWORK_PRO_CALL_MS), 95_000)
})

test('no call starts when the remaining budget cannot finish a response', () => {
  assert.equal(homeworkCallTimeoutMs(started, started + HOMEWORK_HELP_BUDGET_MS - 20_000, HOMEWORK_PRO_CALL_MS), null)
  assert.equal(homeworkCallTimeoutMs(started, started - 5_000, 5_000), null)
})
