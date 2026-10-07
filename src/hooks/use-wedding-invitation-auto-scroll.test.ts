import assert from 'node:assert/strict'
import test from 'node:test'
import { advanceWeddingAutoScrollY, paintWeddingAutoScrollTop } from './use-wedding-invitation-auto-scroll'

test('fractional steps accumulate instead of sticking at 0', () => {
  let y = 0
  const painted: number[] = []
  for (let i = 0; i < 8; i += 1) {
    y = advanceWeddingAutoScrollY(y, 16, 5000)
    painted.push(paintWeddingAutoScrollTop(y))
  }
  assert.deepEqual(painted, [1, 2, 3, 4, 5, 6, 7, 8])
  assert.ok(painted[painted.length - 1] > 1)
})

test('a long gap does not jump more than one capped frame', () => {
  const y = advanceWeddingAutoScrollY(0, 5000, 5000)
  assert.equal(paintWeddingAutoScrollTop(y), 2)
})

test('stops at the bottom', () => {
  let y = 0
  for (let i = 0; i < 30; i += 1) y = advanceWeddingAutoScrollY(y, 16, 10)
  assert.equal(y, 10)
  assert.equal(paintWeddingAutoScrollTop(y), 10)
})
