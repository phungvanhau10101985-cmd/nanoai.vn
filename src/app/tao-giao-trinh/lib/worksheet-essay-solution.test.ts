import assert from 'node:assert/strict'
import test from 'node:test'
import { questionsToMarkdown } from './questions-to-markdown'
import { blockToContentJson } from './markdown-to-questions'
import { coalesceEssayParts } from './worksheet-content-json'
import { previewQuestionBody } from '@/lib/db/worksheet-question-review-pg'

const real = 'a) →AB = (2; -2; -1). Vậy D(2; 5; 2).'

test('lời giải nằm trong đề và field solution là placeholder thì chỉ giữ một lời giải', () => {
  const problem = `Trong không gian Oxyz, cho ba điểm A, B, C.\n\n**Lời giải:**\n\n${real}\n\n**Lời giải:**\n\n(Chưa có lời giải)`
  const parts = coalesceEssayParts(problem, '(Chưa có lời giải)')
  assert.equal(parts.problem, 'Trong không gian Oxyz, cho ba điểm A, B, C.')
  assert.equal(parts.solution, real)
  assert.equal(parts.solution.includes('Chưa có lời giải'), false)
})

test('markdown và banner không gắn thêm (Chưa có lời giải) khi bài đã có lời giải', () => {
  const body = {
    problem: `Trong không gian Oxyz, cho ba điểm A, B, C. **Lời giải:** ${real}`,
    solution: '(Chưa có lời giải)',
  }
  const markdown = questionsToMarkdown([
    { type: 'essay', content_json: body, difficulty: 'van-dung-thap', verified_at: '2026-10-23' },
  ])
  assert.equal(markdown.split('**Lời giải:**').length - 1, 1)
  assert.equal(markdown.includes('(Chưa có lời giải)'), false)
  assert.equal(markdown.includes(real), true)
  const preview = previewQuestionBody(body)
  assert.equal(preview.includes('(Chưa có lời giải)'), false)
  assert.equal(preview.includes(real), true)
})

test('phiếu chỉ có tự luận thì đánh số phần 1, có trắc nghiệm thì tự luận là phần 2', () => {
  const essayOnly = questionsToMarkdown([
    { type: 'essay', content_json: { problem: 'Tính OA.', solution: 'OA = 1.' }, difficulty: 'thong-hieu' },
  ])
  assert.equal(essayOnly.includes('## 1. Phần tự luận'), true)
  assert.equal(essayOnly.includes('Phần trắc nghiệm'), false)
  assert.equal(essayOnly.includes('## 2. Phần tự luận'), false)
  const both = questionsToMarkdown([
    { type: 'quiz', content_json: { question: '1+1?', options: ['1', '2', '3', '4'], correctIndex: 1 }, difficulty: 'easy' },
    { type: 'essay', content_json: { problem: 'Tính OA.', solution: 'OA = 1.' }, difficulty: 'thong-hieu' },
  ])
  assert.equal(both.includes('## 1. Phần trắc nghiệm'), true)
  assert.equal(both.includes('## 2. Phần tự luận'), true)
})

test('bài chưa có lời giải vẫn hiện đúng một dòng trống', () => {
  const markdown = questionsToMarkdown([
    { type: 'essay', content_json: { problem: 'Tính khoảng cách OA.', solution: '' }, difficulty: 'thong-hieu' },
  ])
  assert.equal(markdown.split('**Lời giải:**').length - 1, 1)
  assert.equal(markdown.includes('(Chưa có lời giải)'), true)
})

test('lưu lại editor đã bị gắn dòng trống thì tách đề và lời giải', () => {
  const content = [
    '### Bài 1. **[Đã verify]** **[Vận dụng thấp]**',
    '',
    'Trong không gian Oxyz, cho ba điểm A, B, C.',
    '',
    '**Lời giải:**',
    '',
    real,
    '',
    '**Lời giải:**',
    '',
    '(Chưa có lời giải)',
  ].join('\n')
  const parsed = blockToContentJson({
    index: 0,
    type: 'essay',
    content,
    startOffset: 0,
    endOffset: content.length,
  }) as { problem: string; solution: string }
  assert.equal(parsed.problem, 'Trong không gian Oxyz, cho ba điểm A, B, C.')
  assert.equal(parsed.solution, real)
})
