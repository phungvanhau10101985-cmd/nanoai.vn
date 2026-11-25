import assert from 'node:assert/strict'
import test from 'node:test'
import { gradeExamFromStoredAnswers } from '@/lib/exam-session/grade-exam-from-sources'
import {
  correctDisplayIndex,
  displayedChoiceMatchesOriginal,
} from '@/lib/exam-session/student-exam-layout'
import {
  displayedLetterMatchesCanonical,
  scanQuestionInDisplayedOrder,
} from '@/lib/lop/answer-card'

const options = ['Hà Nội', 'Huế', 'Đà Nẵng', 'Sài Gòn']
const question = { id: 'q1', options, correct_index: 0, points: 1 }

test('same answer content is correct at A for one student and at C for another', () => {
  const permA = [0, 1, 2, 3]
  const permC = [1, 2, 0, 3]
  assert.equal(correctDisplayIndex(permA, 0), 0)
  assert.equal(correctDisplayIndex(permC, 0), 2)
  assert.equal(
    displayedChoiceMatchesOriginal({ options, perm: permA, displayIndex: 0, correctIndex: 0 }),
    true,
  )
  assert.equal(
    displayedChoiceMatchesOriginal({ options, perm: permC, displayIndex: 2, correctIndex: 0 }),
    true,
  )
  assert.equal(
    displayedChoiceMatchesOriginal({ options, perm: permC, displayIndex: 0, correctIndex: 0 }),
    false,
  )

  const layout = (perm: number[]) => ({
    v: 1 as const,
    questionOrder: ['q1'],
    optionPerms: { q1: perm },
  })
  const pickedA = gradeExamFromStoredAnswers([question], layout(permA), { q1: 0 }, {})
  const pickedC = gradeExamFromStoredAnswers([question], layout(permC), { q1: 2 }, {})
  const pickedWrongOnCPaper = gradeExamFromStoredAnswers([question], layout(permC), { q1: 0 }, {})
  assert.equal('error' in pickedA ? -1 : pickedA.correctCount, 1)
  assert.equal('error' in pickedC ? -1 : pickedC.correctCount, 1)
  assert.equal('error' in pickedWrongOnCPaper ? -1 : pickedWrongOnCPaper.correctCount, 0)
})

test('a raised card is correct only when that letter shows the original answer', () => {
  const canonical = { prompt: 'Thủ đô?', choices: options, correct: 'A' as const }
  const shown = scanQuestionInDisplayedOrder(canonical, ['Huế', 'Đà Nẵng', 'Hà Nội', 'Sài Gòn'])
  assert.equal(shown?.correct, 'C')
  assert.equal(displayedLetterMatchesCanonical(shown?.choices ?? [], 'C', canonical), true)
  assert.equal(displayedLetterMatchesCanonical(shown?.choices ?? [], 'A', canonical), false)
})
