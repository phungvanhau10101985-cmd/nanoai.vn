import assert from 'node:assert/strict'
import test from 'node:test'
import { parseHomeworkGuide, parseHomeworkReview } from '@/lib/homework-help/homework-help-guide'

test('parseHomeworkGuide keeps knowledge and hides nothing the model already split out', () => {
  const guide = parseHomeworkGuide({
    note: '',
    problems: [
      {
        statement: 'Giải 2x + 3 = 7',
        knowledge: ['Phương trình bậc nhất', 'Chuyển vế đổi dấu'],
        thinking: ['Chuyển 3 sang vế kia', 'Chia hai vế cho hệ số của x'],
        hints: ['Vế kia còn 7 trừ 3'],
        answer: 'x = 2',
      },
    ],
  })
  assert.ok(guide)
  assert.equal(guide.problems.length, 1)
  assert.equal(guide.problems[0]?.knowledge.length, 2)
  assert.equal(guide.problems[0]?.answer, 'x = 2')
  assert.equal(guide.problems[0]?.thinking.some((step) => step.includes('x = 2')), false)
  assert.equal(guide.problems[0]?.cached, undefined)
})

test('parseHomeworkGuide keeps the cache mark from a stored problem', () => {
  const guide = parseHomeworkGuide({
    note: '',
    problems: [{ statement: '2 + 2', knowledge: [], thinking: [], hints: [], answer: '4', cached: true }],
  })
  assert.equal(guide?.problems[0]?.cached, true)
  const fresh = parseHomeworkGuide({
    note: '',
    problems: [{ statement: '2 + 3', knowledge: [], thinking: [], hints: [], answer: '5', cached: false }],
  })
  assert.equal(fresh?.problems[0]?.cached, undefined)
})

test('parseHomeworkGuide drops a problem with no statement', () => {
  const guide = parseHomeworkGuide({
    note: 'Không thấy đề',
    problems: [{ statement: '   ', knowledge: ['a'] }],
  })
  assert.deepEqual(guide, { note: 'Không thấy đề', problems: [] })
})

test('parseHomeworkReview requires at least one check', () => {
  assert.equal(parseHomeworkReview({ checks: [], gap: 'x' }), null)
  const review = parseHomeworkReview({
    checks: [{ label: 'Chuyển vế', ok: false, note: 'Dấu chưa đổi' }],
    gap: 'Nhắc lại quy tắc chuyển vế',
  })
  assert.equal(review?.checks[0]?.ok, false)
  assert.match(review?.gap ?? '', /chuyển vế/)
})
