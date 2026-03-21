import { parseWorksheetIntoBlocks } from '@/app/tao-giao-trinh/lib/worksheet-parse-questions'

/** Map slide index → chỉ số block toàn cục trong `parseWorksheetIntoBlocks` khi thứ tự câu khớp `question_types`. */
export function worksheetSlideIndexToBlockGlobalIndex(
  markdown: string,
  slideIndex: number,
  questionTypes: string[]
): number | null {
  if (!markdown.trim() || slideIndex < 0 || !questionTypes.length || slideIndex >= questionTypes.length) return null
  const t = questionTypes[slideIndex]
  if (t !== 'quiz' && t !== 'essay') return null
  const sameBefore = questionTypes.slice(0, slideIndex).filter((x) => x === t).length
  const blocks = parseWorksheetIntoBlocks(markdown)
  let c = 0
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].type !== t) continue
    if (c === sameBefore) return i
    c++
  }
  return null
}

function normCompact(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

/** Fallback: khớp nội dung slide (ghép blocks) với block trong markdown. */
export function findWorksheetBlockIndexBySlideText(markdown: string, slideCombinedText: string): number | null {
  const t = normCompact(slideCombinedText)
  if (t.length < 12) return null
  const blocks = parseWorksheetIntoBlocks(markdown)
  let bestI = -1
  let bestScore = 0
  for (let i = 0; i < blocks.length; i++) {
    const bc = normCompact(blocks[i].content)
    let score = 0
    for (const len of [160, 100, 60, 40]) {
      const chunk = t.slice(0, len)
      if (chunk.length >= 12 && bc.includes(chunk)) {
        score = len
        break
      }
    }
    if (score === 0) {
      const chunk = bc.slice(0, 80)
      if (chunk.length >= 12 && t.includes(chunk)) score = 50
    }
    if (score > bestScore) {
      bestScore = score
      bestI = i
    }
  }
  return bestScore >= 12 ? bestI : null
}

export function resolveWorksheetEditBlockGlobalIndex(
  markdown: string,
  slideIndex: number,
  questionTypes: string[],
  slideCombinedText: string
): number | null {
  const byOrder = worksheetSlideIndexToBlockGlobalIndex(markdown, slideIndex, questionTypes)
  if (byOrder != null) return byOrder
  return findWorksheetBlockIndexBySlideText(markdown, slideCombinedText)
}
