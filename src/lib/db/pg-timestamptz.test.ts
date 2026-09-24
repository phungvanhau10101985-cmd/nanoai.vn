import assert from 'node:assert/strict'
import test from 'node:test'
import { toPgTimestamptz } from '@/lib/db/pg-timestamptz'

test('toPgTimestamptz turns Date.toString GMT offsets into ISO', () => {
  const date = new Date('2026-09-24T08:32:00.000Z')
  const gmt = String(date)
  assert.match(gmt, /GMT/i)
  assert.equal(toPgTimestamptz(gmt), '2026-09-24T08:32:00.000Z')
  assert.equal(toPgTimestamptz(date), '2026-09-24T08:32:00.000Z')
  assert.equal(toPgTimestamptz(null), null)
  assert.equal(toPgTimestamptz('not-a-date'), null)
})
