import { cleanThinkingGuide, coalesceEssayParts, getEssayProblem, getEssaySolution, getThinkingGuide, splitThinkingGuide } from './worksheet-content-json'
import { formatQuizAnswerBlock } from './worksheet-quiz-solution'
import { parseWorksheetIntoBlocks } from './worksheet-parse-questions'

const QUIZ_TAG: Record<string, string> = { easy: 'Dễ', medium: 'Trung bình', hard: 'Khó' }
const ESSAY_TAG: Record<string, string> = {
  'nhan-biet': 'Nhận biết',
  'thong-hieu': 'Thông hiểu',
  'van-dung-thap': 'Vận dụng thấp',
  'van-dung-cao': 'Vận dụng cao',
  'thuc-te': 'Thực tế',
}

function getQuizTag(difficulty?: string): string {
  return QUIZ_TAG[difficulty ?? ''] ?? QUIZ_TAG.medium
}

function getEssayTag(difficulty?: string): string {
  return ESSAY_TAG[difficulty ?? ''] ?? ESSAY_TAG['thong-hieu']
}

/** Số hiệu bài SGK do AI gán khi tách ý (vd: "1.3 1", "1.3 2"). */
function thinkingGuideLines(contentJson: unknown): string[] {
  const guide = cleanThinkingGuide(getThinkingGuide(contentJson))
  if (!guide) return []
  return ['', '**Hướng tư duy:**', '', guide]
}

function getExerciseNumberFromContent(contentJson: unknown): string {
  const c = contentJson as Record<string, unknown> | null
  if (!c || typeof c !== 'object') return ''
  const n = c.exerciseNumber ?? c.exercise_number
  if (typeof n !== 'string') return ''
  return n.replace(/\s+/g, ' ').trim().slice(0, 48)
}

export type WorksheetMarkdownQuestion = {
  type: string
  content_json: unknown
  difficulty?: string
  source?: string
  verified_at?: string | null
}

/** Một câu, đúng khối giáo viên sửa — không kèm tiêu đề phiếu. */
export function questionBlockMarkdown(question: WorksheetMarkdownQuestion): string {
  const blocks = parseWorksheetIntoBlocks(questionsToMarkdown([question]))
  return blocks[0]?.content?.trim() ?? ''
}

/** Chuyển danh sách câu hỏi (worksheet_questions) sang content_markdown.
 * Thêm tiêu đề ## Phần trắc nghiệm / ## Phần tự luận để splitWorksheetSections phân tách đúng.
 * Hiển thị tag: [Tham khảo theo SGK] khi source=sgk; [Chưa verify]/[Đã verify]; Dễ/TB/Khó (quiz); Nhận biết/... (essay).
 * Phiếu không có trắc nghiệm thì tự luận là phần 1, không ghi số 2. */
export function questionsToMarkdown(questions: WorksheetMarkdownQuestion[]): string {
  const lines: string[] = ['## Phiếu bài tập', '']
  const hasQuiz = questions.some((q) => q.type === 'quiz')
  let quizNum = 0
  let essayNum = 0
  let lastType: 'quiz' | 'essay' | null = null
  for (const q of questions) {
    const verifyTag = q.verified_at ? '**[Đã verify]** ' : '**[Chưa verify]** '
    if (q.type === 'quiz') {
      if (lastType !== 'quiz') {
        lines.push('## 1. Phần trắc nghiệm', '')
        lastType = 'quiz'
      }
      const c = q.content_json as { question?: string; options?: string[]; correctIndex?: number; solution?: string }
      quizNum++
      const sgkTag = q.source === 'sgk' ? '**[Tham khảo theo SGK]** ' : ''
      const tag = getQuizTag(q.difficulty)
      const quizLabel = getExerciseNumberFromContent(c) || String(quizNum)
      const stem = splitThinkingGuide(String(c.question ?? ''))
      lines.push(`${quizLabel}. ${verifyTag}${sgkTag}**[${tag}]** ${stem.body || c.question || ''}`)
      const opts = (c.options ?? []).slice(0, 4).map((o) => String(o ?? '').replace(/^[A-D]\.\s*/i, '').trim() || String(o ?? ''))
      opts.forEach((o, i) => lines.push(`   ${String.fromCharCode(65 + i)}. ${o}`))
      lines.push(...thinkingGuideLines(c))
      if (String(c.solution ?? '').trim()) {
        lines.push('', '**Lời giải:**', '', formatQuizAnswerBlock(c.correctIndex ?? 0, c.solution), '')
      } else {
        lines.push(formatQuizAnswerBlock(c.correctIndex ?? 0, ''), '')
      }
    } else if (q.type === 'essay') {
      if (lastType !== 'essay') {
        lines.push(hasQuiz ? '## 2. Phần tự luận' : '## 1. Phần tự luận', '')
        lastType = 'essay'
      }
      const c = q.content_json as { problem?: string; solution?: string }
      const parts = coalesceEssayParts(getEssayProblem(c) || String(c.problem ?? ''), getEssaySolution(c) || String(c.solution ?? ''))
      essayNum++
      const sgkTag = q.source === 'sgk' ? '**[Tham khảo theo SGK]** ' : ''
      const tag = getEssayTag(q.difficulty)
      const essayLabel = getExerciseNumberFromContent(c) || String(essayNum)
      lines.push(
        `### Bài ${essayLabel}. ${verifyTag}${sgkTag}**[${tag}]**`,
        '',
        parts.problem,
        ...thinkingGuideLines(c),
        '',
        '**Lời giải:**',
        '',
        parts.solution || '(Chưa có lời giải)',
        ''
      )
    }
  }
  return lines.join('\n').trim() || 'Chưa có nội dung.'
}
