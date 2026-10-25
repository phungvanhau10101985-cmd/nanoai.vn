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

test('bước 1. 2. 3. trong lời giải trắc nghiệm không thành câu mới, tự luận giữ một block', () => {
  const markdown = questionsToMarkdown([
    {
      type: 'quiz',
      difficulty: 'hard',
      verified_at: '2026-01-01T00:00:00.000Z',
      content_json: {
        question: 'Tìm m để cao độ bằng 3.',
        options: ['m = -2', 'm = 2', 'm = 10', 'm = 1'],
        correctIndex: 0,
        solution: '1. Thành phần hoành độ (x):\n2 - 2x = 0\n2. Thành phần tung độ (y):\ny = -1/2\n3. Thành phần cao độ (z):\nz = 3',
      },
    },
    {
      type: 'quiz',
      difficulty: 'easy',
      verified_at: '2026-01-01T00:00:00.000Z',
      content_json: {
        question: 'Tìm tọa độ của vectơ c.',
        options: ['(5; 1; -2)', '(3; -5; 2)', '(1; -4; 2)', '(0; -7; 4)'],
        correctIndex: 1,
        solution: 'c = (3; -5; 2).',
      },
    },
    {
      type: 'essay',
      difficulty: 'van-dung-thap',
      source: 'sgk',
      verified_at: '2026-01-01T00:00:00.000Z',
      content_json: {
        problem: 'Cho ba điểm A, B, C. Tìm D để ABCD là hình bình hành.',
        solution: 'D(2; 5; 2).',
      },
    },
  ])
  const blocks = parseWorksheetIntoBlocks(markdown)
  assert.deepEqual(blocks.map((block) => block.type), ['quiz', 'quiz', 'essay'])
  assert.match(blocks[0]?.content ?? '', /1\. Thành phần hoành độ/)
  assert.match(blocks[0]?.content ?? '', /3\. Thành phần cao độ/)
  assert.match(blocks[1]?.content ?? '', /Tìm tọa độ của vectơ c/)
  assert.doesNotMatch(blocks[1]?.content ?? '', /Phần tự luận/)
  assert.match(blocks[2]?.content ?? '', /Bài 1/)
})

test('hướng tư duy trắc nghiệm nằm giữa phương án và lời giải, không chui vào đáp án', () => {
  const guide = 'Nhớ phép cộng. Cộng hai số đã cho. Chưa chọn phương án.'
  const markdown = questionsToMarkdown([
    {
      type: 'quiz',
      difficulty: 'easy',
      content_json: {
        question: '1+1 bằng bao nhiêu?',
        options: ['1', '2', '3', '4'],
        correctIndex: 1,
        thinkingGuide: guide,
        solution,
      },
    },
  ])
  const guideAt = markdown.indexOf('**Hướng tư duy:**')
  const solutionAt = markdown.indexOf('**Lời giải:**')
  assert.ok(markdown.indexOf('A. 1') < guideAt && guideAt < solutionAt)
  const parsed = parseWorksheetIntoBlocks(markdown).find((item) => item.type === 'quiz')
  const saved = parsed
    ? (blockToContentJson(parsed) as { thinkingGuide?: string; solution?: string; question?: string })
    : null
  assert.equal(saved?.thinkingGuide, guide)
  assert.equal(saved?.solution, solution)
  assert.equal(saved?.question?.includes('Hướng tư duy'), false)
})
