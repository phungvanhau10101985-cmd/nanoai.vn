import assert from 'node:assert/strict'
import test from 'node:test'
import { answersAgree, mergeCheckedProblem, parseHomeworkChecks } from '@/lib/homework-help/homework-help-check'
import {
  homeworkStatementFingerprint,
  normalizeHomeworkStatement,
  splitTypedHomework,
} from '@/lib/homework-help/homework-help-fingerprint'

const draft = {
  statement: 'Giải 2x + 3 = 7',
  knowledge: ['Phương trình bậc nhất một ẩn', 'Nghiệm là 2'],
  thinking: ['Chuyển 3 sang vế kia', 'Ra x = 2'],
  hints: ['Vế kia còn 4'],
  answer: 'x = 2',
}

test('same problem text shares a fingerprint after numbering and spacing changes', () => {
  const left = normalizeHomeworkStatement('Câu 1. Giải 2x + 3 = 7.')
  const right = normalizeHomeworkStatement('1) giải 2x+3=7')
  assert.equal(left, right)
  assert.equal(homeworkStatementFingerprint('Câu 1. Giải 2x + 3 = 7.'), homeworkStatementFingerprint('1) giải 2x+3=7'))
  assert.notEqual(homeworkStatementFingerprint('Giải 2x + 3 = 7'), homeworkStatementFingerprint('Giải 2x + 3 = 8'))
})

test('typed homework splits blank lines and question labels, and matches a photo statement', () => {
  assert.deepEqual(splitTypedHomework('Giải 2x + 3 = 7'), ['Giải 2x + 3 = 7'])
  assert.deepEqual(splitTypedHomework('Giải 2x + 3 = 7\n\nTính 3 × 4'), ['Giải 2x + 3 = 7', 'Tính 3 × 4'])
  assert.deepEqual(splitTypedHomework('Câu 1. Giải 2x + 3 = 7\nCâu 2. Tính 3 × 4'), [
    'Câu 1. Giải 2x + 3 = 7',
    'Câu 2. Tính 3 × 4',
  ])
  assert.equal(
    homeworkStatementFingerprint(splitTypedHomework('Câu 1. Giải 2x + 3 = 7.')[0] ?? ''),
    homeworkStatementFingerprint('1) giải 2x+3=7')
  )
})

test('answers agree on spacing and on the value after equals', () => {
  assert.equal(answersAgree('x = 2', 'X=2'), true)
  assert.equal(answersAgree('x = 2', '2'), true)
  assert.equal(answersAgree('x = 2', 'x = 3'), false)
  assert.equal(answersAgree('', '2'), false)
})

test('cross-check keeps only confirmed knowledge and a matching answer', () => {
  const merged = mergeCheckedProblem(draft, {
    index: 0,
    answer: '2',
    knowledge: [
      { index: 0, ok: true },
      { index: 1, ok: false },
    ],
  })
  assert.equal(merged.cacheable, true)
  assert.deepEqual(merged.problem.knowledge, ['Phương trình bậc nhất một ẩn'])
  assert.equal(merged.problem.answer, 'x = 2')
  assert.equal(merged.problem.thinking.length, 2)
})

test('disagreement hides the answer and drops a step that leaks it', () => {
  const merged = mergeCheckedProblem(draft, {
    index: 0,
    answer: 'x = 5',
    knowledge: [
      { index: 0, ok: true },
      { index: 1, ok: false },
    ],
  })
  assert.equal(merged.problem.answer, '')
  assert.deepEqual(merged.problem.thinking, ['Chuyển 3 sang vế kia'])
  assert.equal(merged.cacheable, true)
})

test('a failed check does not keep knowledge or an answer to cache', () => {
  const merged = mergeCheckedProblem(draft, null)
  assert.equal(merged.cacheable, false)
  assert.deepEqual(merged.problem.knowledge, [])
  assert.equal(merged.problem.answer, '')
  assert.equal(merged.problem.statement, draft.statement)
})

test('check parser ignores a line the model did not mark', () => {
  const checks = parseHomeworkChecks({
    problems: [{ index: 1, answer: 'A', knowledge: [{ index: 0, ok: true }, { index: 9, ok: true }] }],
  })
  assert.equal(checks?.[0]?.index, 1)
  assert.equal(checks?.[0]?.knowledge.length, 1)
})
