import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { slideDocumentTranslateSeedReviews } from './reviews'

function vnDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
}

describe('slideDocumentTranslateSeedReviews', () => {
  it('keeps the newest review 3 days ago and the oldest 3 months ago', () => {
    const now = new Date('2027-01-15T02:00:00.000Z')
    const rows = slideDocumentTranslateSeedReviews(now)
    const newest = rows.find((row) => row.id === 'seed-01')
    const oldest = rows.find((row) => row.id === 'seed-70')
    assert.equal(vnDate(newest!.createdAt), '2027-01-12')
    assert.equal(vnDate(oldest!.createdAt), '2026-10-15')
    assert.ok(rows.every((row, index) => index === 0 || row.createdAt <= rows[index - 1].createdAt))
  })
})
