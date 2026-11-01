import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  acceptPolishedGuestName,
  parseWeddingGuestBulkLine,
  parseWeddingGuestBulkText,
  splitWeddingGuestBulkBatch,
  WEDDING_GUEST_BULK_AI_CHUNK_CHARS,
  WEDDING_GUEST_BULK_MAX_CHARS,
  weddingGuestBulkNameKey,
  weddingGuestsFromArrangedRows,
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

  it('splits commas, the word và, and a leading mời', () => {
    const result = parseWeddingGuestBulkText('Mời cậu Viễn, bạn Hưng và anh Minh.')
    assert.deepEqual(
      result.guests.map((guest) => `${guest.honorific} ${guest.name}`),
      ['Cậu Viễn', 'Bạn Hưng', 'Anh Minh'],
    )
    assert.equal(result.rejected.length, 0)
  })

  it('splits guests glued together without commas', () => {
    const result = parseWeddingGuestBulkText('bạn Hoa Bạn Mai Bạn Lương')
    assert.deepEqual(
      result.guests.map((guest) => `${guest.honorific} ${guest.name}`),
      ['Bạn Hoa', 'Bạn Mai', 'Bạn Lương'],
    )
    assert.equal(result.rejected.length, 0)
  })

  it('splits a glued row that AI returned as one name', () => {
    const result = weddingGuestsFromArrangedRows([{ honorific: 'Bạn', name: 'Hoa Bạn Mai Bạn Lương' }])
    assert.deepEqual(
      result.guests.map((guest) => `${guest.honorific} ${guest.name}`),
      ['Bạn Hoa', 'Bạn Mai', 'Bạn Lương'],
    )
  })

  it('reads missing marks, telex, doubled letters, and glued capitals', () => {
    const marked = ['Bạn Hoa', 'Bạn Mai', 'Bạn Lương']
    const unmarked = ['Bạn Hoa', 'Bạn Mai', 'Bạn Luong']
    const cases: Array<[string, string[]]> = [
      ['bạn Hoa Bạn Mai Bạn Lương', marked],
      ['ban hoa ban mai ban luong', unmarked],
      ['banj Hoa banj Mai banj Luongw', marked],
      ['bann Hoa / bann Mai + bann Luong', unmarked],
      ['BạnHoaBạnMaiBạnLương', marked],
      ['mời bạn hoa, bạn mai và bạn lương!!!', marked],
    ]
    for (const [text, expected] of cases) {
      const result = parseWeddingGuestBulkText(text)
      assert.deepEqual(
        result.guests.map((guest) => `${guest.honorific} ${guest.name}`),
        expected,
        text,
      )
    }
  })

  it('keeps ông nội as one guest and still splits the next person', () => {
    const result = parseWeddingGuestBulkText('ông nội Phong Ông ngoại Lan')
    assert.deepEqual(
      result.guests.map((guest) => `${guest.honorific} ${guest.name}`),
      ['Ông nội Phong', 'Ông ngoại Lan'],
    )
  })

  it('keeps only arranged rows that still have a known honorific', () => {
    const result = weddingGuestsFromArrangedRows([
      { honorific: 'Cậu', name: 'Viễn' },
      { honorific: 'Bạn', name: 'Hưng' },
      { honorific: '', name: 'Minh' },
      'Anh Minh',
    ])
    assert.deepEqual(
      result.guests.map((guest) => `${guest.honorific} ${guest.name}`),
      ['Cậu Viễn', 'Bạn Hưng', 'Anh Minh'],
    )
    assert.equal(result.rejected.length, 1)
  })

  it('keeps every short guest inside one 12k batch', () => {
    const lines = Array.from({ length: 500 }, (_, index) => `bạn Khach${index + 1}`)
    const text = lines.join('\n')
    assert.ok(text.length < WEDDING_GUEST_BULK_MAX_CHARS)
    assert.equal(parseWeddingGuestBulkText(text).guests.length, 500)
  })

  it('splits one 12k list into AI pieces that still cover every guest', () => {
    const text = Array.from({ length: 800 }, (_, index) => `bạn Khach${index + 1}`).join('\n')
    const clipped = splitWeddingGuestBulkBatch(text).batch
    const pieces: string[] = []
    let rest = clipped
    while (rest.trim()) {
      const cut = splitWeddingGuestBulkBatch(rest, WEDDING_GUEST_BULK_AI_CHUNK_CHARS)
      pieces.push(cut.batch)
      if (!cut.rest || cut.rest === rest) break
      rest = cut.rest
    }
    assert.ok(pieces.length > 1)
    assert.ok(pieces.every((piece) => piece.length <= WEDDING_GUEST_BULK_AI_CHUNK_CHARS))
    const covered = pieces.reduce((sum, piece) => sum + parseWeddingGuestBulkText(piece).guests.length, 0)
    assert.equal(covered, parseWeddingGuestBulkText(clipped).guests.length)
  })

  it('cuts an overlong list on a separator and keeps the rest for the next batch', () => {
    const piece = 'bạn Hoa, bạn Mai, bạn Lương, '
    const text = piece.repeat(Math.ceil((WEDDING_GUEST_BULK_MAX_CHARS + piece.length) / piece.length))
    assert.ok(text.length > WEDDING_GUEST_BULK_MAX_CHARS)
    const { batch, rest } = splitWeddingGuestBulkBatch(text)
    assert.ok(batch.length <= WEDDING_GUEST_BULK_MAX_CHARS)
    assert.ok(batch.length > 0)
    assert.ok(rest.length > 0)
    assert.equal(parseWeddingGuestBulkText(batch).guests.length > 0, true)
    assert.equal(parseWeddingGuestBulkText(rest).guests.length > 0, true)
    assert.equal(splitWeddingGuestBulkBatch('bạn Hoa').rest, '')
  })

  it('accepts Vietnamese diacritics only when the letters stay the same', () => {
    assert.equal(acceptPolishedGuestName('Vien', 'Viễn'), 'Viễn')
    assert.equal(acceptPolishedGuestName('Hưng', 'Nam'), 'Hưng')
  })
})
