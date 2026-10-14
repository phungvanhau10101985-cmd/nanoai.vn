import assert from 'node:assert/strict'
import test from 'node:test'
import { parseHomeworkGuide, parseHomeworkSolution } from '@/lib/homework-help/homework-help-guide'

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
        tags: [
          { key: 'linear-equation', title: 'Phương trình bậc nhất' },
          { key: 'bad', title: 'Bỏ', ok: false },
        ],
      },
    ],
  })
  assert.ok(guide)
  assert.equal(guide.problems.length, 1)
  assert.equal(guide.problems[0]?.knowledge.length, 2)
  assert.deepEqual(guide.problems[0]?.tags, [{ key: 'linear-equation', title: 'Phương trình bậc nhất' }])
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

test('parseHomeworkSolution keeps line breaks and drops an empty body', () => {
  assert.equal(parseHomeworkSolution({ solution: '  Bước 1\r\nBước 2  ' }), 'Bước 1\nBước 2')
  assert.equal(parseHomeworkSolution({ solution: '   ' }), '')
  assert.equal(parseHomeworkSolution(null), '')
})
