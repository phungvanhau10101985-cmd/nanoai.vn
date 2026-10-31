import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  acceptPolishedGuestName,
  parseWeddingGuestBulkLine,
  parseWeddingGuestBulkText,
  weddingGuestBulkNameKey,
} from './wedding-guest-bulk-names'

describe('wedding guest bulk names', () => {
  it('keeps a full honorific and title-cases the given name', () => {
    const parsed = parseWeddingGuestBulkLine('cậu viễn')
    assert.ok(parsed && 'honorific' in parsed)
    if (!parsed || !('honorific' in parsed)) return
    assert.equal(parsed.honorific, 'Cậu')
    assert.equal(parsed.name, 'Viễn')
  })

  it('rejects a bare given name', () => {
    const parsed = parseWeddingGuestBulkLine('viễn')
    assert.deepEqual(parsed, { raw: 'viễn', reason: 'bare' })
  })

  it('rejects an honorific with no name', () => {
    const parsed = parseWeddingGuestBulkLine('bạn')
    assert.deepEqual(parsed, { raw: 'bạn', reason: 'bare' })
  })

  it('splits a list, drops duplicates, and keeps the bare lines aside', () => {
    const result = parseWeddingGuestBulkText('cậu viễn\nbạn hưng\nCậu Viễn\nviễn\nông nội Phong')
    assert.equal(result.guests.length, 3)
    assert.equal(result.guests[0]?.honorific, 'Cậu')
    assert.equal(result.guests[1]?.name, 'Hưng')
    assert.equal(result.guests[2]?.honorific, 'Ông nội')
    assert.equal(result.guests[2]?.name, 'Phong')
    assert.equal(result.rejected.length, 1)
    assert.equal(
      weddingGuestBulkNameKey('Cậu', 'Viễn'),
      weddingGuestBulkNameKey('cậu', 'viễn'),
    )
  })

  it('accepts Vietnamese diacritics only when the letters stay the same', () => {
    assert.equal(acceptPolishedGuestName('Vien', 'Viễn'), 'Viễn')
    assert.equal(acceptPolishedGuestName('Hưng', 'Nam'), 'Hưng')
  })
})
