import assert from 'node:assert/strict'
import test from 'node:test'
import { blockToContentJson } from './markdown-to-questions'
import { questionsToMarkdown } from './questions-to-markdown'
import { parseWorksheetIntoBlocks } from './worksheet-parse-questions'
import { formatQuizAnswerBlock } from './worksheet-quiz-solution'

const solution = 'Ta tính 1 + 1 = 2. Vậy giá trị cần tìm là 2.'

test('đáp án trắc nghiệm đặt lời giải trước dòng kết luận', () => {
  const block = formatQuizAnswerBlock(1, solution)
  assert.ok(block.indexOf(solution) < block.indexOf('**Đáp án:** B'))
  const markdown = questionsToMarkdown([
    {
      type: 'quiz',
      content_json: { question: '1+1 bằng bao nhiêu?', options: ['1', '2', '3', '4'], correctIndex: 1, solution },
      difficulty: 'easy',
    },
  ])
  const parsed = parseWorksheetIntoBlocks(markdown).find((item) => item.type === 'quiz')
  const saved = parsed ? blockToContentJson(parsed) as { solution?: string; correctIndex?: number } : null
  assert.equal(saved?.correctIndex, 1)
  assert.equal(saved?.solution, solution)
})
