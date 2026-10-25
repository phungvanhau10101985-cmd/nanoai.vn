/**
 * Chuyển nội dung block markdown (từ parseWorksheetIntoBlocks) sang content_json
 * để cập nhật worksheet_questions khi giáo viên sửa phiếu.
 */
import type { WorksheetQuestionBlock } from './worksheet-parse-questions'
import { ESSAY_SOLUTION_MARKER, cleanThinkingGuide, coalesceEssayParts, splitThinkingGuide } from './worksheet-content-json'
import { cleanQuizSolution } from './worksheet-quiz-solution'

function guideHeading(line: string): { rest: string } | null {
  const plain = line.trim().replace(/\*\*/g, '').trim()
  const match = plain.match(/^Hướng tư duy\s*:\s*(.*)$/i)
  if (!match) return null
  return { rest: (match[1] ?? '').trim() }
}

/** Parse block quiz markdown → { question, options, correctIndex, thinkingGuide, solution } */
function parseQuizBlockContent(content: string): { question: string; options: string[]; correctIndex: number; thinkingGuide: string; solution: string } | null {
  const lines = content.split('\n')
  if (lines.length < 2) return null

  const firstLine = lines[0] ?? ''
  const quizMatch =
    firstLine.match(/^(\d+(?:\.\d+)+\s+\d+)\.\s+(.*)$/s) || firstLine.match(/^(\d+)\.\s+(.*)$/s)
  if (!quizMatch) return null

  const questionParts: string[] = [quizMatch[2]?.trim() ?? '']
  const options: string[] = []
  const guideParts: string[] = []
  const solutionParts: string[] = []
  let correctIndex = 0
  let phase: 'question' | 'options' | 'guide' | 'solution' = 'question'

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i] ?? ''
    const optMatch = line.match(/^\s*([A-D])\.\s+(.*)$/i)
    const ansMatch = line.match(/\*\*Đáp án:\*\*\s*([A-D])|\*\*Đáp án\*\*:\s*([A-D])/i)
    const solutionMarker = /^Lời giải\s*:?\s*$/i.test(line.trim().replace(/\*\*/g, ''))
    const guide = guideHeading(line)

    if (optMatch && options.length < 4 && phase !== 'solution' && phase !== 'guide') {
      phase = 'options'
      options.push((optMatch[2] ?? '').trim())
    } else if (guide) {
      phase = 'guide'
      if (guide.rest) guideParts.push(guide.rest)
    } else if (ansMatch) {
      phase = 'solution'
      const letter = (ansMatch[1] || ansMatch[2] || 'A').toUpperCase()
      correctIndex = Math.max(0, Math.min(letter.charCodeAt(0) - 65, 3))
    } else if (solutionMarker) {
      phase = 'solution'
    } else if (phase === 'question' && questionParts.length > 0) {
      questionParts.push(line.trim())
    } else if (phase === 'guide') {
      guideParts.push(line)
    } else if (phase === 'solution' || phase === 'options') {
      solutionParts.push(line)
    }
  }

  const question = questionParts.join('\n').trim() || '(Chưa có câu hỏi)'
  if (options.length < 4) return null
  const thinkingGuide = cleanThinkingGuide(guideParts.join('\n'))
  return {
    question,
    options: options.slice(0, 4),
    correctIndex,
    ...(thinkingGuide ? { thinkingGuide } : { thinkingGuide: '' }),
    solution: cleanQuizSolution(solutionParts.join('\n')),
  }
}

/** Parse block essay markdown → { problem, thinkingGuide, solution } */
function parseEssayBlockContent(content: string): { problem: string; thinkingGuide: string; solution: string } | null {
  const loiGiaiMatch = new RegExp(ESSAY_SOLUTION_MARKER.source, 'i').exec(content)
  let problem = ''
  let solution = ''

  if (loiGiaiMatch && loiGiaiMatch.index != null) {
    solution = content.slice(loiGiaiMatch.index + loiGiaiMatch[0].length).trim()
    const before = content.slice(0, loiGiaiMatch.index)
    problem = before
      .replace(/^#+\s*Bài\s+(?:\d+(?:\.\d+)*(?:\s+\d+)?)\.\s*[^\n]*\n?/i, '')
      .replace(/^\*\*Bài\s+(?:\d+(?:\.\d+)*(?:\s+\d+)?)\.?\s*\*?\s*[^\n]*\n?/i, '')
      .trim()
  } else {
    problem = content
      .replace(/^#+\s*Bài\s+(?:\d+(?:\.\d+)*(?:\s+\d+)?)\.\s*[^\n]*\n?/i, '')
      .replace(/^\*\*Bài\s+(?:\d+(?:\.\d+)*(?:\s+\d+)?)\.?\s*\*?\s*[^\n]*\n?/i, '')
      .trim()
  }

  if (!problem && !solution) return null
  const guided = splitThinkingGuide(problem)
  const parts = coalesceEssayParts(guided.body, solution)
  const thinkingGuide = guided.thinkingGuide || splitThinkingGuide(problem).thinkingGuide
  return {
    problem: parts.problem || '(Chưa có đề bài)',
    ...(thinkingGuide ? { thinkingGuide } : { thinkingGuide: '' }),
    solution: parts.solution || '(Chưa có lời giải)',
  }
}

/** Chuyển 1 block sang content_json (dùng cho update hoặc insert) */
export function blockToContentJson(block: WorksheetQuestionBlock): unknown {
  if (block.type === 'quiz') return parseQuizBlockContent(block.content)
  if (block.type === 'essay') return parseEssayBlockContent(block.content)
  return null
}

/**
 * Chuyển danh sách blocks sang mảng { id?, type, content_json }.
 * - Với block có row tương ứng (theo index): dùng row.id để update.
 * - Với block thừa (không có row): id = null, dùng để insert mới.
 */
export function blocksToContentJson(
  blocks: WorksheetQuestionBlock[],
  questionRows: Array<{ id: string; type: string }>
): Array<{ id: string | null; type: string; content_json: unknown }> {
  const result: Array<{ id: string | null; type: string; content_json: unknown }> = []
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    if (!block) continue

    const contentJson = blockToContentJson(block)
    if (!contentJson) continue

    const row = questionRows[i] ?? null
    result.push({
      id: row?.id ?? null,
      type: block.type,
      content_json: contentJson,
    })
  }
  return result
}
