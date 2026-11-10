import assert from 'node:assert/strict'
import test from 'node:test'
import {
  nextTutoringAccessEnd,
  tutoringAccessDaysLeft,
  tutoringDissolveAt,
  tutoringGraceDaysLeft,
  tutoringPackagePhase,
  tutoringPackageQuote,
} from './tutoring-package'

test('an unpaid renewal opens a 30-day list-only window, then the class dissolves', () => {
  const ends = new Date('2026-12-01T08:00:00.000Z')
  const dissolve = tutoringDissolveAt(ends)
  assert.equal(dissolve.toISOString(), '2026-12-30T17:00:00.000Z')

  const lastActive = new Date('2026-12-01T07:59:00.000Z')
  assert.equal(tutoringPackagePhase(ends, lastActive), 'active')

  const firstGrace = new Date('2026-12-01T08:00:00.000Z')
  assert.equal(tutoringPackagePhase(ends, firstGrace), 'grace')
  assert.equal(tutoringGraceDaysLeft(ends, firstGrace), 30)

  const lastGrace = new Date('2026-12-30T10:00:00.000Z')
  assert.equal(tutoringPackagePhase(ends, lastGrace), 'grace')
  assert.equal(tutoringGraceDaysLeft(ends, lastGrace), 1)

  const dissolved = new Date('2026-12-30T17:00:00.000Z')
  assert.equal(tutoringPackagePhase(ends, dissolved), 'lapsed')
  assert.equal(tutoringGraceDaysLeft(ends, dissolved), 0)
  assert.equal(tutoringPackagePhase(null, dissolved), 'none')
  assert.equal(tutoringAccessDaysLeft(ends, new Date('2026-11-24T08:00:00.000Z')), 7)
  assert.equal(tutoringAccessDaysLeft(ends, new Date('2026-11-23T08:00:00.000Z')), 8)
  assert.equal(tutoringAccessDaysLeft(ends, lastActive), 0)
})

test('the quote is the per-class price times the number of classes', () => {
  assert.deepEqual(tutoringPackageQuote('month', 3), { priceVnd: 180_000, credits: 30, days: 30 })
  assert.deepEqual(tutoringPackageQuote('year', 2), { priceVnd: 1_152_000, credits: 192, days: 365 })
  assert.equal(tutoringPackageQuote('month', 0), null)
  const now = new Date('2026-12-01T00:00:00.000Z')
  const extended = nextTutoringAccessEnd(new Date('2026-12-20T00:00:00.000Z'), 30, now)
  assert.equal(extended.toISOString(), '2027-01-19T00:00:00.000Z')
  const restarted = nextTutoringAccessEnd(new Date('2026-11-01T00:00:00.000Z'), 30, now)
  assert.equal(restarted.toISOString(), '2026-12-31T00:00:00.000Z')
})
