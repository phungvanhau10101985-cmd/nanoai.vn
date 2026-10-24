import assert from 'node:assert/strict'
import test from 'node:test'
import { consecutiveReviewCounts, consecutiveReviewTail } from './review-consecutive'

test('7 đúng liên tiếp mới chốt, một phiếu sai xen giữa thì đếm lại', () => {
  const agrees = Array.from({ length: 6 }, (_, index) => ({
    userId: `u${index}`,
    action: 'agree' as const,
    at: index + 1,
  }))
  const broken = consecutiveReviewCounts([
    ...agrees,
    { userId: 'n', action: 'reject', at: 7 },
  ])
  assert.equal(broken.agreeCount, 0)
  assert.equal(broken.rejectCount, 1)
  assert.equal(broken.closed, false)

  const again = consecutiveReviewCounts([
    ...agrees,
    { userId: 'n', action: 'reject', at: 7 },
    ...Array.from({ length: 7 }, (_, index) => ({
      userId: `a${index}`,
      action: 'agree' as const,
      at: 10 + index,
    })),
  ])
  assert.equal(again.agreeCount, 7)
  assert.equal(again.rejectCount, 0)
  assert.equal(again.closed, true)
  assert.equal(consecutiveReviewTail(agrees)?.count, 6)
})

test('một người đổi phiếu chỉ tính phiếu mới nhất', () => {
  const tail = consecutiveReviewTail([
    { userId: 'a', action: 'agree', at: 1 },
    { userId: 'a', action: 'reject', at: 2 },
    { userId: 'b', action: 'reject', at: 3 },
  ])
  assert.deepEqual(tail, { action: 'reject', count: 2 })
})
