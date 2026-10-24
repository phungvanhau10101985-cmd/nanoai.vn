import assert from 'node:assert/strict'
import test from 'node:test'
import { statsFromReviewRows } from '@/lib/db/slide-content-review-pg'

type Row = {
  slide_index: number
  content_hash: string
  user_id: string
  action: 'confirm' | 'edit' | 'reject' | 'agree'
  body: string | null
  created_at: string
}

function row(partial: Row): Row {
  return partial
}

const edited = 'G = (2; 3; 2)'
const original = 'G = (0; 0; 0)'

test('người sửa dùng bản sửa, người sau vẫn thấy cả hai bản', () => {
  const rows = [
    row({
      slide_index: 0,
      content_hash: 'h1',
      user_id: 'author',
      action: 'edit',
      body: edited,
      created_at: '2026-10-23T10:00:00.000Z',
    }),
  ]
  const author = statsFromReviewRows(rows, ['hash-goc'], 'author', [original])[0]
  const reader = statsFromReviewRows(rows, ['hash-goc'], 'reader', [original])[0]
  assert.equal(author?.warn, true)
  assert.equal(author?.adoptedText, edited)
  assert.equal(author?.sharedText, original)
  assert.equal(author?.proposalText, edited)
  assert.equal(reader?.adoptedText, null)
  assert.equal(reader?.sharedText, original)
  assert.equal(reader?.proposalText, edited)
})

test('duyệt thì dùng bản sửa, không duyệt thì giữ bản gốc', () => {
  const rows = [
    row({
      slide_index: 0,
      content_hash: 'h1',
      user_id: 'author',
      action: 'edit',
      body: edited,
      created_at: '2026-10-23T10:00:00.000Z',
    }),
    row({
      slide_index: 0,
      content_hash: 'h1',
      user_id: 'reader',
      action: 'agree',
      body: edited,
      created_at: '2026-10-23T10:05:00.000Z',
    }),
    row({
      slide_index: 0,
      content_hash: 'h1',
      user_id: 'other',
      action: 'reject',
      body: edited,
      created_at: '2026-10-23T10:06:00.000Z',
    }),
  ]
  const agreed = statsFromReviewRows(rows, ['hash-goc'], 'reader', [original])[0]
  const rejected = statsFromReviewRows(rows, ['hash-goc'], 'other', [original])[0]
  assert.equal(agreed?.adoptedText, edited)
  assert.equal(agreed?.confirmCount, 1)
  assert.equal(rejected?.adoptedText, null)
  assert.equal(rejected?.rejectCount, 1)
  assert.equal(rejected?.myVote, 'reject')
})

test('đủ 7 không duyệt thì bỏ bản sửa, đủ 7 duyệt thì lấy bản sửa', () => {
  const base = [
    row({
      slide_index: 0,
      content_hash: 'h1',
      user_id: 'author',
      action: 'edit' as const,
      body: edited,
      created_at: '2026-10-23T10:00:00.000Z',
    }),
  ]
  const rejects = Array.from({ length: 7 }, (_, index) =>
    row({
      slide_index: 0,
      content_hash: 'h1',
      user_id: `n${index}`,
      action: 'reject' as const,
      body: edited,
      created_at: `2026-10-23T10:1${index}:00.000Z`,
    })
  )
  const dropped = statsFromReviewRows([...base, ...rejects], ['hash-goc'], 'author', [original])[0]
  assert.equal(dropped?.warn, false)
  assert.equal(dropped?.proposalText, null)
  assert.equal(dropped?.adoptedText, original)
  assert.equal(dropped?.rejectCount, 7)

  const agrees = Array.from({ length: 7 }, (_, index) =>
    row({
      slide_index: 0,
      content_hash: 'h1',
      user_id: `u${index}`,
      action: 'agree' as const,
      body: edited,
      created_at: `2026-10-23T11:0${index}:00.000Z`,
    })
  )
  const adopted = statsFromReviewRows([...base, ...agrees], ['hash-goc'], 'u0', [original])[0]
  assert.equal(adopted?.warn, false)
  assert.equal(adopted?.proposalText, null)
  assert.equal(adopted?.adoptedText, edited)
  assert.equal(adopted?.confirmCount, 7)
})
