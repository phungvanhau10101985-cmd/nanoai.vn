/**
 * Chuyển nội dung block markdown (từ parseWorksheetIntoBlocks) sang content_json
 * để cập nhật worksheet_questions khi giáo viên sửa phiếu.
 */
import type { WorksheetQuestionBlock } from './worksheet-parse-questions'

/** Parse block quiz markdown → { question, options, correctIndex } */
function parseQuizBlockContent(content: string): { question: string; options: string[]; correctIndex: number } | null {
  const lines = content.split('\n')
  if (lines.length < 2) return null

  const firstLine = lines[0] ?? ''
  const quizMatch =
    firstLine.match(/^(\d+(?:\.\d+)+\s+\d+)\.\s+(.*)$/s) || firstLine.match(/^(\d+)\.\s+(.*)$/s)
  if (!quizMatch) return null

  const questionParts: string[] = [quizMatch[2]?.trim() ?? '']
  const options: string[] = []
  let correctIndex = 0
  let inQuestion = true

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i] ?? ''
    const optMatch = line.match(/^\s*([A-D])\.\s+(.*)$/i)
    const ansMatch = line.match(/\*\*Đáp án\*\*:\s*([A-D])/i)

    if (optMatch) {
      inQuestion = false
      options.push((optMatch[2] ?? '').trim())
    } else if (ansMatch) {
      inQuestion = false
      const letter = (ansMatch[1] ?? 'A').toUpperCase()
      correctIndex = Math.max(0, Math.min(letter.charCodeAt(0) - 65, 3))
    } else if (inQuestion && questionParts.length > 0) {
      questionParts.push(line.trim())
    }
  }

  const question = questionParts.join('\n').trim() || '(Chưa có câu hỏi)'
  if (options.length < 4) return null
  return { question, options: options.slice(0, 4), correctIndex }
}

/** Parse block essay markdown → { problem, solution } */
function parseEssayBlockContent(content: string): { problem: string; solution: string } | null {
  // Hỗ trợ: **Lời giải:**\n... hoặc **Lời giải:** ... (cùng dòng)
  const loiGiaiMatch =
    content.match(/\*\*Lời giải\*\*:\s*\n([\s\S]*)$/i) ||
    content.match(/\*\*Đáp án\*\*:\s*\n([\s\S]*)$/i) ||
    content.match(/\*\*Lời giải\*\*:\s*(.+)$/is) ||
    content.match(/\*\*Đáp án\*\*:\s*(.+)$/is)
  let problem = ''
  let solution = ''

  if (loiGiaiMatch) {
    solution = (loiGiaiMatch[1] ?? '').trim()
    const before = content.slice(0, content.indexOf(loiGiaiMatch[0]))
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
  return { problem: problem || '(Chưa có đề bài)', solution: solution || '(Chưa có lời giải)' }
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
