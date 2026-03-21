/**
 * Parse worksheet markdown thành từng câu (block) để sửa từng câu một.
 */
export type WorksheetQuestionBlock = {
  index: number
  type: 'quiz' | 'essay'
  content: string
  startOffset: number
  endOffset: number
}

/** Đầu câu TN: "1. ", "12. " hoặc số SGK tách ý "1.3 1. " */
function matchQuizStart(line: string): RegExpMatchArray | null {
  const compound = line.match(/^(\d+(?:\.\d+)+\s+\d+)\.\s+/)
  if (compound) return compound
  return line.match(/^(\d+)\.\s+/)
}

function isQuizStart(line: string): boolean {
  return matchQuizStart(line) != null
}

/** Nhãn số sau "Bài": 2 | 1.3 | 1.3 1 ... */
const ESSAY_NUM_BODY = String.raw`(?:\d+(?:\.\d+)*(?:\s+\d+)?)`

/** Kiểm tra dòng có phải đầu bài tự luận – gồm ### Bài 1.3 1. */
function isEssayStart(line: string): boolean {
  return (
    new RegExp(`^###\\s+Bài\\s+${ESSAY_NUM_BODY}\\.\\s`).test(line) ||
    new RegExp(`^\\*\\*Bài\\s+${ESSAY_NUM_BODY}\\.?\\s*\\*{0,2}\\s*`).test(line) ||
    new RegExp(`^Bài\\s+${ESSAY_NUM_BODY}\\.\\s`).test(line)
  )
}

/**
 * Tách worksheet markdown thành các block (mỗi block = 1 câu trắc nghiệm hoặc 1 bài tự luận).
 */
export function parseWorksheetIntoBlocks(markdown: string): WorksheetQuestionBlock[] {
  const text = (markdown ?? '').trim()
  if (!text) return []

  const blocks: WorksheetQuestionBlock[] = []
  const lines = text.split('\n')
  let i = 0
  let charOffset = 0

  while (i < lines.length) {
    const line = lines[i] ?? ''
    const lineLen = line.length + (i < lines.length - 1 ? 1 : 0)
    const quizMatch = matchQuizStart(line)
    const essayMatch = isEssayStart(line)

    if (quizMatch) {
      const startIdx = charOffset
      const blockLines: string[] = [line]
      i++
      charOffset += lineLen
      while (i < lines.length) {
        const next = lines[i] ?? ''
        const nextLen = next.length + (i < lines.length - 1 ? 1 : 0)
        if (isQuizStart(next) || isEssayStart(next)) break
        blockLines.push(next)
        i++
        charOffset += nextLen
      }
      const content = blockLines.join('\n')
      const endIdx = startIdx + content.length
      blocks.push({
        index: blocks.length + 1,
        type: 'quiz',
        content,
        startOffset: startIdx,
        endOffset: endIdx,
      })
      continue
    }

    if (essayMatch) {
      const startIdx = charOffset
      const blockLines: string[] = [line]
      i++
      charOffset += lineLen
      while (i < lines.length) {
        const next = lines[i] ?? ''
        const nextLen = next.length + (i < lines.length - 1 ? 1 : 0)
        // Trong bài tự luận, phần lời giải thường là danh sách 1., 2., 3.
        // Nếu break theo isQuizStart sẽ làm mất toàn bộ nội dung lời giải.
        if (isEssayStart(next)) break
        blockLines.push(next)
        i++
        charOffset += nextLen
      }
      const content = blockLines.join('\n')
      const endIdx = startIdx + content.length
      blocks.push({
        index: blocks.length + 1,
        type: 'essay',
        content,
        startOffset: startIdx,
        endOffset: endIdx,
      })
      continue
    }

    i++
    charOffset += lineLen
  }

  return blocks
}

/**
 * Thay thế 1 block trong markdown bằng nội dung mới.
 */
export function replaceBlockInMarkdown(
  markdown: string,
  block: WorksheetQuestionBlock,
  newContent: string
): string {
  const before = markdown.slice(0, block.startOffset)
  const after = markdown.slice(block.endOffset)
  return before + newContent + after
}
