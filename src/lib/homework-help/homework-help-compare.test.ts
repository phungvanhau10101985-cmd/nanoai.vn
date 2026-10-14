import assert from 'node:assert/strict'
import test from 'node:test'
import { fillHomeworkCompareDays, homeworkAnswerCompareOutcome } from '@/lib/homework-help/homework-help-compare'

test('an agreeing pair is logged as agree and does not look like a GPT pick', () => {
  assert.equal(homeworkAnswerCompareOutcome({ agreed: true, side: '' }), 'agree')
  assert.equal(homeworkAnswerCompareOutcome({ agreed: true, side: 'draft' }), 'agree')
})

test('GPT keeps the side it matches and hides the rest', () => {
  assert.equal(homeworkAnswerCompareOutcome({ agreed: false, side: 'draft' }), 'gpt_deepseek')
  assert.equal(homeworkAnswerCompareOutcome({ agreed: false, side: 'check' }), 'gpt_gemini')
  assert.equal(homeworkAnswerCompareOutcome({ agreed: false, side: '' }), 'unmatched')
})

test('empty days stay on the chart so a quiet day still shows zero', () => {
  const days = fillHomeworkCompareDays('2026-10-12', '2026-10-14', [
    { day: '2026-10-13', checkpoint: 'answer', outcome: 'agree', n: 2 },
    { day: '2026-10-13', checkpoint: 'knowledge', outcome: 'ok', n: 4 },
    { day: '2026-10-13', checkpoint: 'knowledge', outcome: 'not_ok', n: 1 },
  ])
  assert.deepEqual(
    days.map((day) => day.day),
    ['2026-10-12', '2026-10-13', '2026-10-14']
  )
  assert.equal(days[0]?.agree, 0)
  assert.equal(days[1]?.agree, 2)
  assert.equal(days[1]?.knowledgeOk, 4)
  assert.equal(days[1]?.knowledgeNot, 1)
  assert.equal(days[2]?.unmatched, 0)
})
