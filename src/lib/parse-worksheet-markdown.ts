/**
 * Parse worksheet content_markdown để trích quiz + essay.
 * Format: ### 1. Mức 1 – Nhận biết (Trắc nghiệm) + Đáp án trắc nghiệm: 1. A, 2. B
 */

export type QuizItem = { index: number; question: string; options: string[]; correctIndex: number }
export type EssayItem = { index: number; prompt: string }

export type ParsedWorksheet = {
  quiz: QuizItem[]
  essay: EssayItem[]
  answerSection: string
}

const OPTION_LABELS = ['A', 'B', 'C', 'D']
const OPTION_RE = /^\s*([A-D])\.\s*(.+)$/i

function letterToIndex(letter: string): number {
  const c = letter.toUpperCase().charAt(0)
  const i = OPTION_LABELS.indexOf(c)
  return i >= 0 ? i : 0
}

/** Parse "Đáp án trắc nghiệm: 1. A, 2. B, ..." hoặc "1. A, 2. B" */
function parseQuizAnswers(text: string): number[] {
  const answers: number[] = []
  const match = text.match(/(?:Đáp án trắc nghiệm|đáp án)[:\s]*([\d. A,]+)/i)
  const raw = match ? match[1] : text
  const parts = raw.split(/[,;]/)
  for (const p of parts) {
    const m = p.trim().match(/^\d+\.\s*([A-D])$/i)
    if (m) answers.push(letterToIndex(m[1]))
  }
  return answers
}

/** Parse trắc nghiệm: "1. Câu hỏi\n   A. opt1\n   B. opt2\n..." */
function parseQuizBlock(block: string, answers: number[]): QuizItem[] {
  const items: QuizItem[] = []
  const numRe = /^(\d+)\.\s+(.+)$/
  const lines = block.split(/\n/)
  let current: { num: number; question: string; options: string[] } | null = null

  for (const line of lines) {
    if (/^\s*\*\*Đáp án/i.test(line)) break
    const optMatch = line.match(OPTION_RE)
    if (optMatch) {
      if (current) {
        const idx = letterToIndex(optMatch[1])
        while (current.options.length <= idx) current.options.push('')
        current.options[idx] = optMatch[2].trim()
      }
      continue
    }
    const numMatch = line.match(numRe)
    if (numMatch) {
      if (current) {
        const opts = current.options.filter(Boolean)
        if (opts.length >= 2) {
          const correctIdx = answers[current.num - 1] ?? 0
          items.push({
            index: current.num,
            question: current.question.trim(),
            options: opts,
            correctIndex: Math.min(correctIdx, opts.length - 1),
          })
        }
      }
      current = {
        num: parseInt(numMatch[1], 10),
        question: numMatch[2].trim(),
        options: [],
      }
    } else if (current && line.trim() && !line.match(/^\s*[-*]/)) {
      current.question += '\n' + line.trim()
    }
  }
  if (current) {
    const opts = current.options.filter(Boolean)
    if (opts.length >= 2) {
      const correctIdx = answers[current.num - 1] ?? 0
      items.push({
        index: current.num,
        question: current.question.trim(),
        options: opts,
        correctIndex: Math.min(correctIdx, opts.length - 1),
      })
    }
  }
  return items
}

/** Parse essay: "1. Bài tập..." or "### 2. Mức 2" với numbered items */
function parseEssayBlock(block: string): EssayItem[] {
  const items: EssayItem[] = []
  const numRe = /^(\d+)\.\s+(.+)$/
  const lines = block.split(/\n/)
  for (const line of lines) {
    const m = line.match(numRe)
    if (m) {
      const prompt = m[2].trim()
      if (prompt.length > 10) items.push({ index: parseInt(m[1], 10), prompt })
    }
  }
  return items
}

export function parseWorksheetMarkdown(markdown: string): ParsedWorksheet {
  const answers = parseQuizAnswers(markdown)
  const sections = markdown.split(/(?=^### )/m)
  let quizBlock = ''
  let essayBlock = ''
  let answerSection = ''

  for (const sec of sections) {
    const lower = sec.toLowerCase()
    if (lower.includes('trắc nghiệm') || lower.includes('nhận biết')) {
      quizBlock = sec
    } else if (
      lower.includes('thông hiểu') ||
      lower.includes('vận dụng thấp') ||
      lower.includes('vận dụng cao') ||
      lower.includes('mức 2') ||
      lower.includes('mức 3') ||
      lower.includes('mức 4')
    ) {
      essayBlock += sec
    } else if (lower.includes('đáp án') || lower.includes('lời giải')) {
      answerSection += sec
    }
  }

  const quiz = parseQuizBlock(quizBlock, answers)
  const essay = parseEssayBlock(essayBlock)

  return { quiz, essay, answerSection }
}
