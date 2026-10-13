import assert from 'node:assert/strict'
import test from 'node:test'
import {
  HOMEWORK_DRAFT_CALL_MS,
  HOMEWORK_FLASH_CALL_MS,
  HOMEWORK_GEMINI_CALL_MS,
  HOMEWORK_GPT_CALL_MS,
  HOMEWORK_HELP_BUDGET_MS,
  homeworkCallTimeoutMs,
} from '@/lib/homework-help/homework-help-budget'

const started = 1_000_000

test('a fresh homework solve gets the full model timeout', () => {
  assert.equal(homeworkCallTimeoutMs(started, started, HOMEWORK_DRAFT_CALL_MS), 240_000)
  assert.equal(homeworkCallTimeoutMs(started, started, HOMEWORK_GEMINI_CALL_MS), 120_000)
  assert.equal(homeworkCallTimeoutMs(started, started, HOMEWORK_GPT_CALL_MS), 150_000)
  assert.equal(homeworkCallTimeoutMs(started, started, HOMEWORK_FLASH_CALL_MS), HOMEWORK_FLASH_CALL_MS)
})

test('a late call is shortened so the action still answers before nginx cuts it', () => {
  const now = started + 400_000
  assert.equal(homeworkCallTimeoutMs(started, now, HOMEWORK_DRAFT_CALL_MS), 75_000)
  assert.equal(homeworkCallTimeoutMs(started, now, HOMEWORK_GPT_CALL_MS), 75_000)
})

test('no call starts when the remaining budget cannot finish a response', () => {
  assert.equal(homeworkCallTimeoutMs(started, started + HOMEWORK_HELP_BUDGET_MS - 20_000, HOMEWORK_DRAFT_CALL_MS), null)
  assert.equal(homeworkCallTimeoutMs(started, started - 5_000, 5_000), null)
})
