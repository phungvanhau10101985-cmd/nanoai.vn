import { parseTutorLabels, tutorTopicKey } from '@/lib/ai-tutor/ai-tutor-parse'
import type { TutorLabel } from '@/lib/ai-tutor/ai-tutor-types'

/** D = DeepSeek, G = Gemini, P = GPT. */
export type HomeworkModelMark = 'D' | 'G' | 'P'

export type HomeworkProblem = {
  statement: string
  knowledge: string[]
  thinking: string[]
  hints: string[]
  answer: string
  /** Nhãn kiến thức dùng chung với gia sư. Bấm nhãn mở đúng chủ đề trong kho đó. */
  tags: TutorLabel[]
  /** Đề đọc từ ảnh bằng Gemini. */
  statementMark?: 'G'
  /** Model viết câu đáp án đang hiện. */
  answerMark?: HomeworkModelMark
  /** Bản này đọc từ cache DB, không phải lần soạn mới. */
  cached?: boolean
}

export type HomeworkGuide = {
  note: string
  problems: HomeworkProblem[]
}

const MAX_PROBLEMS = 8

function cleanLine(value: unknown, max: number): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

/** Dòng kiến thức đã có trở thành nhãn khi model không gửi tag riêng. */
export function knowledgeLinesAsTags(lines: string[]): TutorLabel[] {
  const out: TutorLabel[] = []
  for (const line of lines) {
    const title = line.replace(/\s+/g, ' ').trim().slice(0, 80)
    const key = tutorTopicKey(title)
    if (!key || !title) continue
    out.push({ key, title })
    if (out.length === 3) break
  }
  return out
}

function asLines(value: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const item of value) {
    const text = cleanLine(item, maxLen)
    if (!text) continue
    out.push(text)
    if (out.length >= maxItems) break
  }
  return out
}

export function parseHomeworkGuide(raw: unknown): HomeworkGuide | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  const note = cleanLine(record.note, 300)
  const problemsRaw = record.problems
  if (!Array.isArray(problemsRaw)) return null
  const problems: HomeworkProblem[] = []
  for (const row of problemsRaw) {
    if (!row || typeof row !== 'object') continue
    const item = row as Record<string, unknown>
    const statement = cleanLine(item.statement, 4000)
    if (!statement) continue
    const knowledge = asLines(item.knowledge, 5, 280)
    const statementMark = item.statementMark === 'G' ? 'G' : undefined
    const answerMark = item.answerMark === 'D' || item.answerMark === 'G' || item.answerMark === 'P' ? item.answerMark : undefined
    problems.push({
      statement,
      knowledge,
      thinking: asLines(item.thinking, 6, 320),
      hints: asLines(item.hints, 4, 320),
      answer: cleanLine(item.answer, 2000),
      tags: parseTutorLabels(item.tags),
      ...(statementMark ? { statementMark } : {}),
      ...(answerMark ? { answerMark } : {}),
      ...(item.cached === true ? { cached: true } : {}),
    })
    if (problems.length >= MAX_PROBLEMS) break
  }
  return { note, problems }
}

/** Lời giải chi tiết. Giữ xuống dòng. Không đi cùng hướng tư duy hay đáp án gửi sẵn cho học sinh. */
export function parseHomeworkSolution(raw: unknown): string {
  if (!raw || typeof raw !== 'object') return ''
  return String((raw as { solution?: unknown }).solution ?? '')
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, 8000)
}
