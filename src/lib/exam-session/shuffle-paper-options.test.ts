import assert from 'node:assert/strict'
import test from 'node:test'
import { letterForSameOption, scanQuestionInDisplayedOrder } from '@/lib/lop/answer-card'
import { shufflePaperOptions } from '@/lib/exam-session/shuffle-paper-options'

test('shuffle keeps every option and can move the correct one', () => {
  const original = ['đỏ', 'xanh', 'vàng', 'tím']
  const shuffled = shufflePaperOptions(original, () => 0)
  assert.deepEqual(shuffled, ['xanh', 'vàng', 'tím', 'đỏ'])
  assert.deepEqual([...shuffled].sort(), [...original].sort())
  const aligned = scanQuestionInDisplayedOrder(
    { prompt: 'Màu nào?', choices: original, correct: 'A' },
    shuffled,
  )
  assert.equal(aligned?.correct, 'D')
  assert.equal(letterForSameOption('D', shuffled, original), 'A')
  assert.equal(letterForSameOption('A', original, shuffled), 'D')
})

test('displayed choices that are not a permutation are rejected', () => {
  const aligned = scanQuestionInDisplayedOrder(
    { prompt: 'Câu?', choices: ['một', 'hai', 'ba'], correct: 'B' },
    ['hai', 'một', 'bốn'],
  )
  assert.equal(aligned, null)
})

test('same option text maps across two orders', () => {
  assert.equal(letterForSameOption('B', ['một', 'hai', 'ba'], ['ba', 'hai', 'một']), 'B')
  assert.equal(letterForSameOption('A', ['một', 'hai'], ['hai', 'một']), 'B')
  assert.equal(letterForSameOption('C', ['một', 'hai'], ['hai', 'một']), null)
})
