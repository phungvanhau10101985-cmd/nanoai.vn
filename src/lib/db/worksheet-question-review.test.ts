import assert from 'node:assert/strict'
import test from 'node:test'
import { personalBodiesForUser, proposalsFromRows, reviewCountForQuestion, sameQuestionContent, worksheetTeacherReviewRoundKey } from '@/lib/db/worksheet-question-review-pg'

type Row = {
  question_id: string
  content_hash: string
  user_id: string
  action: 'edit' | 'agree' | 'reject'
  body: unknown
  created_at: string
}

function row(partial: Row): Row {
  return partial
}

const edited = { solution: 'G = (2; 3; 2)' }
const editedAgain = { solution: 'G = (1; 1; 1)' }

test('người sửa thấy ngay bản của mình, người khác chỉ thấy đề xuất', () => {
  const rows = [
    row({
      question_id: 'q1',
      content_hash: 'h1',
      user_id: 'author',
      action: 'edit',
      body: edited,
      created_at: '2026-10-23T10:00:00.000Z',
    }),
  ]
  assert.deepEqual(personalBodiesForUser(rows, 'author').get('q1'), edited)
  assert.equal(personalBodiesForUser(rows, 'reader').size, 0)
  const proposal = proposalsFromRows(rows, 'reader')[0]
  assert.equal(proposal?.authorIsMe, false)
  assert.equal(proposal?.agreeCount, 0)
  assert.match(proposal?.preview ?? '', /G = \(2; 3; 2\)/)
})

test('đếm từng người đã duyệt, một người duyệt hai lần vẫn là một', () => {
  const rows = [
    row({
      question_id: 'q1',
      content_hash: 'h1',
      user_id: 'author',
      action: 'edit',
      body: edited,
      created_at: '2026-10-23T10:00:00.000Z',
    }),
    row({
      question_id: 'q1',
      content_hash: 'h1',
      user_id: 'reader',
      action: 'agree',
      body: edited,
      created_at: '2026-10-23T10:05:00.000Z',
    }),
    row({
      question_id: 'q1',
      content_hash: 'h1',
      user_id: 'reader',
      action: 'agree',
      body: edited,
      created_at: '2026-10-23T10:06:00.000Z',
    }),
    row({
      question_id: 'q1',
      content_hash: 'h1',
      user_id: 'other',
      action: 'agree',
      body: edited,
      created_at: '2026-10-23T10:07:00.000Z',
    }),
  ]
  assert.deepEqual(reviewCountForQuestion(rows), { agreeCount: 2, rejectCount: 0, editCount: 1 })
})

test('xác nhận thì người đó dùng đáp án sửa, không duyệt thì giữ lời giải chung', () => {
  const rows = [
    row({
      question_id: 'q1',
      content_hash: 'h1',
      user_id: 'author',
      action: 'edit',
      body: edited,
      created_at: '2026-10-23T10:00:00.000Z',
    }),
    row({
      question_id: 'q1',
      content_hash: 'h1',
      user_id: 'reader',
      action: 'agree',
      body: edited,
      created_at: '2026-10-23T10:05:00.000Z',
    }),
    row({
      question_id: 'q1',
      content_hash: 'h1',
      user_id: 'other',
      action: 'reject',
      body: edited,
      created_at: '2026-10-23T10:06:00.000Z',
    }),
  ]
  assert.deepEqual(personalBodiesForUser(rows, 'reader').get('q1'), edited)
  assert.equal(personalBodiesForUser(rows, 'other').size, 0)
  assert.equal(proposalsFromRows(rows, 'reader')[0]?.myVote, 'agree')
  assert.equal(proposalsFromRows(rows, 'reader')[0]?.agreeCount, 0)
  assert.equal(proposalsFromRows(rows, 'other')[0]?.myVote, 'reject')
  assert.equal(proposalsFromRows(rows, 'other')[0]?.rejectCount, 1)
  assert.equal(proposalsFromRows(rows, 'other')[0]?.agreeCount, 0)
})

test('đủ 7 người xác nhận thì ẩn đề xuất, một lần sửa mới thì đếm lại', () => {
  const base = [
    row({
      question_id: 'q1',
      content_hash: 'h1',
      user_id: 'author',
      action: 'edit',
      body: edited,
      created_at: '2026-10-23T10:00:00.000Z',
    }),
  ]
  const agrees = Array.from({ length: 7 }, (_, index) =>
    row({
      question_id: 'q1',
      content_hash: 'h1',
      user_id: `u${index}`,
      action: 'agree' as const,
      body: edited,
      created_at: `2026-10-23T10:0${index + 1}:00.000Z`,
    })
  )
  const settled = [...base, ...agrees]
  assert.equal(proposalsFromRows(settled, 'u0').length, 0)
  assert.equal(personalBodiesForUser(settled, 'author').size, 0)
  assert.equal(personalBodiesForUser(settled, 'u0').size, 0)

  const reset = [
    ...settled,
    row({
      question_id: 'q1',
      content_hash: 'h2',
      user_id: 'next',
      action: 'edit',
      body: editedAgain,
      created_at: '2026-10-23T11:00:00.000Z',
    }),
  ]
  assert.deepEqual(personalBodiesForUser(reset, 'next').get('q1'), editedAgain)
  assert.equal(personalBodiesForUser(reset, 'author').size, 0)
  assert.equal(personalBodiesForUser(reset, 'u0').size, 0)
  const again = proposalsFromRows(reset, 'u0')[0]
  assert.equal(again?.agreeCount, 0)
  assert.equal(again?.rejectCount, 0)
  assert.equal(again?.editCount, 2)
  assert.equal(again?.authorIsMe, false)
})

test('câu không đổi chữ thì không hiện bản gốc và bản sửa', () => {
  const stem = 'Trong không gian Oxyz, cho tam giác PQR. a) Tìm tọa độ trọng tâm G.'
  const solution = 'x_G = (1 + 3 + 2) / 3 = 2. Vậy G(2; 3; 2).'
  const shared = { problem: `${stem}\n\n**Lời giải:**\n\n${solution}`, solution: '(Chưa có lời giải)' }
  const resaved = { problem: stem, solution }
  assert.equal(sameQuestionContent(shared, resaved), true)
  const rows = [
    row({
      question_id: 'q-same',
      content_hash: 'h-same',
      user_id: 'author',
      action: 'edit',
      body: resaved,
      created_at: '2026-10-23T10:00:00.000Z',
    }),
    row({
      question_id: 'q-changed',
      content_hash: 'h-changed',
      user_id: 'author',
      action: 'edit',
      body: { problem: 'Cho A, B, C.', solution: '→AB = (2; -2; -1).' },
      created_at: '2026-10-23T10:00:00.000Z',
    }),
  ]
  const sharedById = new Map<string, unknown>([
    ['q-same', shared],
    ['q-changed', { problem: 'Cho A, B, C.', solution: 'Vectơ AB = (2; -2; -1).' }],
  ])
  const shown = proposalsFromRows(rows, 'author', sharedById)
  assert.deepEqual(shown.map((item) => item.questionId), ['q-changed'])
})

test('đủ 7 người không duyệt thì bỏ bản sửa, người duyệt trước cũng về bản gốc', () => {
  const rows = [
    row({
      question_id: 'q1',
      content_hash: 'h1',
      user_id: 'author',
      action: 'edit',
      body: edited,
      created_at: '2026-10-23T10:00:00.000Z',
    }),
    row({
      question_id: 'q1',
      content_hash: 'h1',
      user_id: 'reader',
      action: 'agree',
      body: edited,
      created_at: '2026-10-23T10:01:00.000Z',
    }),
    ...Array.from({ length: 7 }, (_, index) =>
      row({
        question_id: 'q1',
        content_hash: 'h1',
        user_id: `n${index}`,
        action: 'reject' as const,
        body: edited,
        created_at: `2026-10-23T10:1${index}:00.000Z`,
      })
    ),
  ]
  assert.equal(proposalsFromRows(rows, 'author').length, 0)
  assert.equal(personalBodiesForUser(rows, 'author').size, 0)
  assert.equal(personalBodiesForUser(rows, 'reader').size, 0)
  assert.equal(reviewCountForQuestion(rows).rejectCount, 7)
  assert.equal(reviewCountForQuestion(rows).agreeCount, 0)
})

test('một phiếu sai xen giữa thì chuỗi đúng đếm lại, chưa thay gốc', () => {
  const rows = [
    row({
      question_id: 'q1',
      content_hash: 'h1',
      user_id: 'author',
      action: 'edit',
      body: edited,
      created_at: '2026-10-23T10:00:00.000Z',
    }),
    ...Array.from({ length: 6 }, (_, index) =>
      row({
        question_id: 'q1',
        content_hash: 'h1',
        user_id: `u${index}`,
        action: 'agree' as const,
        body: edited,
        created_at: `2026-10-23T10:0${index + 1}:00.000Z`,
      })
    ),
    row({
      question_id: 'q1',
      content_hash: 'h1',
      user_id: 'n0',
      action: 'reject',
      body: edited,
      created_at: '2026-10-23T10:20:00.000Z',
    }),
  ]
  assert.equal(proposalsFromRows(rows, 'u0').length, 1)
  assert.equal(reviewCountForQuestion(rows).agreeCount, 0)
  assert.equal(reviewCountForQuestion(rows).rejectCount, 1)
  assert.deepEqual(personalBodiesForUser(rows, 'u0').get('q1'), edited)
})

test('khóa cửa duyệt đổi khi có bản sửa mới, không đổi khi chỉ thêm phiếu', () => {
  const base = [{ questionId: 'q1', editCount: 1, pending: true, authorIsMe: false }]
  const same = worksheetTeacherReviewRoundKey(base)
  assert.equal(worksheetTeacherReviewRoundKey(base), same)
  assert.notEqual(worksheetTeacherReviewRoundKey([{ ...base[0], editCount: 2 }]), same)
  assert.notEqual(worksheetTeacherReviewRoundKey([{ ...base[0], authorIsMe: true }]), same)
})
