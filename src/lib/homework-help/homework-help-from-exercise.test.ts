import assert from 'node:assert/strict'
import test from 'node:test'
import {
  answerFromSolution,
  exerciseGuideGaps,
  exerciseStatement,
  mergeExerciseGuide,
  quizAnswer,
  thinkingLinesFromGuide,
} from '@/lib/homework-help/homework-help-from-exercise'

test('thinking guide lines become the homework thinking steps', () => {
  const lines = thinkingLinesFromGuide('Nhớ tập xác định.\nTính đạo hàm rồi xét dấu.\nKhoảng đồng biến là nơi đạo hàm dương.')
  assert.equal(lines.length, 3)
  assert.equal(lines[0], 'Nhớ tập xác định.')
  assert.equal(exerciseGuideGaps({ knowledge: [], thinking: lines, hints: [], answer: 'x > 2' }).join(','), 'knowledge,hints')
})

test('quiz statement and correct choice are reused without asking for the answer again', () => {
  const options = ['(2; +∞)', '(−∞; 2)', '(−∞; +∞)', '(−2; 2)']
  const statement = exerciseStatement('Hàm số đồng biến trên khoảng nào?', options)
  assert.match(statement, /A\. \(2; \+∞\)/)
  assert.equal(quizAnswer(options, 0), 'A. (2; +∞)')
  const gaps = exerciseGuideGaps({
    knowledge: [],
    thinking: thinkingLinesFromGuide('Nhớ tập xác định. Tính đạo hàm rồi xét dấu.'),
    hints: [],
    answer: quizAnswer(options, 0),
  })
  assert.deepEqual(gaps, ['knowledge', 'hints'])
})

test('merge keeps the exercise thinking and answer, and takes only the missing fields', () => {
  const merged = mergeExerciseGuide(
    'Giải 2x + 3 = 7',
    {
      knowledge: [],
      thinking: ['Chuyển 3 sang vế kia', 'Chia hai vế cho hệ số của x'],
      hints: [],
      answer: 'x = 2',
      tags: [],
    },
    {
      knowledge: ['Phương trình bậc nhất'],
      thinking: ['Làm khác đi'],
      hints: ['Vế kia còn 7 trừ 3'],
      answer: 'x = 9',
      tags: [{ key: 'linear-equation', title: 'Phương trình bậc nhất' }],
    }
  )
  assert.deepEqual(merged.thinking, ['Chuyển 3 sang vế kia', 'Chia hai vế cho hệ số của x'])
  assert.equal(merged.answer, 'x = 2')
  assert.deepEqual(merged.knowledge, ['Phương trình bậc nhất'])
  assert.deepEqual(merged.hints, ['Vế kia còn 7 trừ 3'])
  assert.equal(merged.guideMark, 'D')
})

test('answer line is taken from the stored solution when the essay has no choice key', () => {
  const answer = answerFromSolution('Chuyển vế.\nChia hai vế cho 2.\nĐáp án: x = 2')
  assert.equal(answer, 'x = 2')
})
