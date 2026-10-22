import assert from 'node:assert/strict'
import test from 'node:test'
import {
  homeworkPhotoCacheMatches,
  homeworkPhotoCacheRecord,
  homeworkPhotoCacheWithStatements,
  parseStoredHomeworkPhoto,
} from '@/lib/homework-help/homework-help-cache'
import { homeworkStatementFingerprint } from '@/lib/homework-help/homework-help-fingerprint'
import type { HomeworkProblem } from '@/lib/homework-help/homework-help-guide'

const statement = 'Câu 1. Giải 2x + 3 = 7.'

function problem(text: string): HomeworkProblem {
  return {
    statement: text,
    knowledge: ['Phương trình bậc nhất'],
    thinking: ['Chuyển vế'],
    hints: ['7 - 3'],
    answer: 'x = 2',
    tags: [],
  }
}

test('photo cache stores a fingerprint and drops the question text', () => {
  const record = homeworkPhotoCacheRecord({ note: 'ok', problems: [problem(statement)] })
  assert.equal(record.problems[0]?.statement, '')
  assert.equal(record.prints[0], homeworkStatementFingerprint(statement))
  assert.equal(JSON.stringify(record).includes('Giải'), false)
})

test('a later read keeps the wording from this request when the fingerprint matches', () => {
  const record = homeworkPhotoCacheRecord({ note: '', problems: [problem(statement)] })
  const typed = '1) giải 2x+3=7'
  assert.equal(homeworkPhotoCacheMatches(record, [typed]), true)
  const shown = homeworkPhotoCacheWithStatements(record, [typed])
  assert.equal(shown.problems[0]?.statement, typed)
  assert.equal(shown.problems[0]?.answer, 'x = 2')
  assert.equal(shown.problems[0]?.knowledge[0], 'Phương trình bậc nhất')
})

test('legacy photo cache text is dropped and marked for rewrite', () => {
  const parsed = parseStoredHomeworkPhoto({
    note: '',
    problems: [problem('Giải 2x + 3 = 7')],
  })
  assert.ok(parsed)
  assert.equal(parsed.dirty, true)
  assert.equal(parsed.stored.problems[0]?.statement, '')
  assert.equal(JSON.stringify(parsed.stored).includes('Giải'), false)
  assert.equal(homeworkPhotoCacheMatches(parsed.stored, ['Giải 2x + 3 = 7']), true)
})

test('a wiped photo row without fingerprints is not reused', () => {
  const parsed = parseStoredHomeworkPhoto({
    note: '',
    problems: [{ statement: '', knowledge: ['a'], thinking: ['b'], hints: [], answer: '1', tags: [] }],
  })
  assert.equal(parsed, null)
})
