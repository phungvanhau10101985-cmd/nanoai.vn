import { cleanThinkingGuide } from '@/app/tao-giao-trinh/lib/worksheet-content-json'
import { homeworkProblemFromParts, knowledgeLinesAsTags } from '@/lib/homework-help/homework-help-guide'
import type { HomeworkProblem } from '@/lib/homework-help/homework-help-guide'
import type { TutorLabel } from '@/lib/ai-tutor/ai-tutor-types'

export type ExerciseGuideParts = {
  knowledge: string[]
  thinking: string[]
  hints: string[]
  answer: string
  tags: TutorLabel[]
}

const ANSWER_LINE = /^(?:đáp án|đáp số|kết quả|kết luận|vậy|answer|result)\s*:\s*(.+)$/i

function oneLine(value: string, max: number): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, max)
}

function stripMarker(line: string): string {
  return line.replace(/^\d+[\.\)]\s*/, '').replace(/^[-•]\s*/, '').trim()
}

/** Ý hướng tư duy đã lưu trên câu thành các bước của hỗ trợ làm bài. */
export function thinkingLinesFromGuide(raw: string): string[] {
  const text = cleanThinkingGuide(raw)
  if (text.length < 8) return []
  let parts = text.split(/\n+/).map((line) => line.trim()).filter(Boolean)
  if (parts.length === 1) {
    const numbered = parts[0].split(/\s*(?=\d+[\.\)]\s)/).map((line) => line.trim()).filter(Boolean)
    if (numbered.length > 1) parts = numbered
    else {
      const sentences = parts[0]
        .split(/(?<=[.?!。])\s+/)
        .map((line) => line.trim())
        .filter((line) => line.length >= 8)
      if (sentences.length > 1) parts = sentences
    }
  }
  const out: string[] = []
  for (const part of parts) {
    const line = oneLine(stripMarker(part), 320)
    if (!line) continue
    out.push(line)
    if (out.length === 6) break
  }
  return out
}

export function exerciseStatement(question: string, options: string[]): string {
  const stem = oneLine(question, 3500)
  const choices = options.map((option) => oneLine(option, 500)).filter(Boolean)
  if (!stem) return ''
  if (choices.length < 2) return stem.slice(0, 4000)
  const lines = choices.map((option, index) => `${String.fromCharCode(65 + index)}. ${option}`)
  return `${stem}\n${lines.join('\n')}`.slice(0, 4000)
}

export function quizAnswer(options: string[], correctIndex: number): string {
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) return ''
  const text = oneLine(options[correctIndex] ?? '', 500)
  if (!text) return ''
  return `${String.fromCharCode(65 + correctIndex)}. ${text}`.slice(0, 2000)
}

/** Dòng kết quả đã có trong lời giải. Không lấy cả đoạn làm bài. */
export function answerFromSolution(solution: string): string {
  const lines = solution
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => oneLine(line, 500))
    .filter(Boolean)
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const marked = lines[index]?.match(ANSWER_LINE)
    if (marked?.[1] && marked[1].length <= 180) return marked[1].trim()
  }
  const last = lines[lines.length - 1] ?? ''
  if (!last || last.length > 180) return ''
  if (/^(?:bước|step)\b/i.test(last)) return ''
  return last.replace(/^(?:vậy|nên|do đó)\s+/i, '').trim()
}

export function exerciseGuideGaps(parts: Pick<ExerciseGuideParts, 'knowledge' | 'thinking' | 'hints' | 'answer'>): Array<
  'knowledge' | 'thinking' | 'hints' | 'answer'
> {
  const gaps: Array<'knowledge' | 'thinking' | 'hints' | 'answer'> = []
  if (parts.knowledge.length === 0) gaps.push('knowledge')
  if (parts.thinking.length === 0) gaps.push('thinking')
  if (parts.hints.length === 0) gaps.push('hints')
  if (!parts.answer.trim()) gaps.push('answer')
  return gaps
}

/** Phần đã có trên bài tập giữ nguyên. Phần AI chỉ điền ô còn trống. */
export function mergeExerciseGuide(
  statement: string,
  known: ExerciseGuideParts,
  filled: ExerciseGuideParts | null
): HomeworkProblem {
  const knowledge = known.knowledge.length > 0 ? known.knowledge : filled?.knowledge ?? []
  const thinking = known.thinking.length > 0 ? known.thinking : filled?.thinking ?? []
  const hints = known.hints.length > 0 ? known.hints : filled?.hints ?? []
  const answer = known.answer.trim() || filled?.answer.trim() || ''
  const tags = (filled?.tags.length ? filled.tags : known.tags).slice(0, 3)
  const usedModel = Boolean(filled) && (
    (known.knowledge.length === 0 && knowledge.length > 0) ||
    (known.thinking.length === 0 && thinking.length > 0) ||
    (known.hints.length === 0 && hints.length > 0) ||
    (!known.answer.trim() && Boolean(answer))
  )
  return {
    statement,
    knowledge,
    thinking,
    hints,
    answer,
    tags: tags.length > 0 ? tags : knowledgeLinesAsTags(knowledge.length > 0 ? knowledge : thinking),
    ...(usedModel ? { guideMark: 'D' as const } : {}),
  }
}

export function parseExerciseGuideFill(raw: unknown, statement: string): ExerciseGuideParts | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  const row = Array.isArray(record.problems) ? record.problems[0] : raw
  const problem = homeworkProblemFromParts(row, statement)
  if (!problem) return null
  if (
    problem.knowledge.length === 0 &&
    problem.thinking.length === 0 &&
    problem.hints.length === 0 &&
    !problem.answer.trim()
  ) {
    return null
  }
  return {
    knowledge: problem.knowledge,
    thinking: problem.thinking,
    hints: problem.hints,
    answer: problem.answer,
    tags: problem.tags,
  }
}
