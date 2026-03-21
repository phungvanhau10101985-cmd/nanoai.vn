import { getEssayProblem, getEssaySolution } from './worksheet-content-json'

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
function getExerciseNumberFromContent(contentJson: unknown): string {
  const c = contentJson as Record<string, unknown> | null
  if (!c || typeof c !== 'object') return ''
  const n = c.exerciseNumber ?? c.exercise_number
  if (typeof n !== 'string') return ''
  return n.replace(/\s+/g, ' ').trim().slice(0, 48)
}

/** Chuyển danh sách câu hỏi (worksheet_questions) sang content_markdown.
 * Thêm tiêu đề ## Phần trắc nghiệm / ## Phần tự luận để splitWorksheetSections phân tách đúng.
 * Hiển thị tag: [Bài tập SGK] khi source=sgk; [Chưa verify]/[Đã verify]; Dễ/TB/Khó (quiz); Nhận biết/... (essay). */
export function questionsToMarkdown(questions: Array<{ type: string; content_json: unknown; difficulty?: string; source?: string; verified_at?: string | null }>): string {
  const lines: string[] = ['## Phiếu bài tập', '']
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
      const c = q.content_json as { question?: string; options?: string[]; correctIndex?: number }
      quizNum++
      const sgkTag = q.source === 'sgk' ? '**[Bài tập SGK]** ' : ''
      const tag = getQuizTag(q.difficulty)
      const quizLabel = getExerciseNumberFromContent(c) || String(quizNum)
      lines.push(`${quizLabel}. ${verifyTag}${sgkTag}**[${tag}]** ${c.question ?? ''}`)
      const opts = (c.options ?? []).slice(0, 4).map((o) => String(o ?? '').replace(/^[A-D]\.\s*/i, '').trim() || String(o ?? ''))
      opts.forEach((o, i) => lines.push(`   ${String.fromCharCode(65 + i)}. ${o}`))
      lines.push(`**Đáp án:** ${String.fromCharCode(65 + (c.correctIndex ?? 0))}`, '')
    } else if (q.type === 'essay') {
      if (lastType !== 'essay') {
        lines.push('## 2. Phần tự luận', '')
        lastType = 'essay'
      }
      const c = q.content_json as { problem?: string; solution?: string }
      const problem = getEssayProblem(c) || c.problem || ''
      const solution = getEssaySolution(c) || c.solution || ''
      essayNum++
      const sgkTag = q.source === 'sgk' ? '**[Bài tập SGK]** ' : ''
      const tag = getEssayTag(q.difficulty)
      const essayLabel = getExerciseNumberFromContent(c) || String(essayNum)
      lines.push(`### Bài ${essayLabel}. ${verifyTag}${sgkTag}**[${tag}]**`, '', problem, '', '**Lời giải:**', '', solution, '')
    }
  }
  return lines.join('\n').trim() || 'Chưa có nội dung.'
}
