import { asJsonObject, parseLooseJson } from '@/lib/ai/loose-model-json'
import { cleanThinkingGuide, thinkingGuideIsUsable } from '@/app/tao-giao-trinh/lib/worksheet-content-json'
import { cleanQuizSolution, quizSolutionIsDetailed } from '@/app/tao-giao-trinh/lib/worksheet-quiz-solution'

export type QuizDraft = {
  question: string
  options: string[]
  correctIndex: number
  thinkingGuide: string
  solution: string
}

function draftExcerpt(raw: string): string {
  const excerpt = raw.replace(/\s+/g, ' ').trim().slice(0, 500)
  return excerpt ? ` Mẫu: ${excerpt}` : ''
}

function readQuizCandidate(value: unknown): QuizDraft | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as { question?: unknown; options?: unknown; correctIndex?: unknown; thinkingGuide?: unknown; solution?: unknown }
  if (typeof row.question !== 'string' || !row.question.trim()) return null
  if (!Array.isArray(row.options) || row.options.length < 4) return null
  const solution = cleanQuizSolution(row.solution)
  const thinkingGuide = cleanThinkingGuide(row.thinkingGuide)
  if (!quizSolutionIsDetailed(solution) || !thinkingGuideIsUsable(thinkingGuide)) return null
  const options = row.options.slice(0, 4).map((item) => String(item ?? ''))
  const correctIndex = Math.max(0, Math.min(Number(row.correctIndex ?? 0) || 0, 3))
  return { question: row.question.trim(), options, correctIndex, thinkingGuide, solution }
}

function quizList(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed
  const body = asJsonObject(parsed)
  if (!body) return []
  if (Array.isArray(body.quizzes)) return body.quizzes
  return [body, ...Object.values(body)]
}

export function readQuizDraft(raw: string): QuizDraft | null {
  const parsed = parseLooseJson(raw)
  for (const item of quizList(parsed)) {
    const hit = readQuizCandidate(item)
    if (hit) return hit
  }
  return null
}

function explainOneQuiz(value: unknown, raw: string): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return `Gemini không trả object JSON.${draftExcerpt(raw)}`
  }
  const row = value as { question?: unknown; options?: unknown; thinkingGuide?: unknown; solution?: unknown }
  const optionCount = Array.isArray(row.options) ? row.options.length : 0
  if (typeof row.question !== 'string' || !row.question.trim()) return `Gemini thiếu đề câu.${draftExcerpt(raw)}`
  if (optionCount < 4) return `Gemini trả ${optionCount} đáp án, cần đủ 4.${draftExcerpt(raw)}`
  if (!thinkingGuideIsUsable(row.thinkingGuide)) return `Gemini thiếu hướng tư duy cho học sinh.${draftExcerpt(raw)}`
  if (!quizSolutionIsDetailed(row.solution)) return `Gemini thiếu lời giải chi tiết trước đáp án.${draftExcerpt(raw)}`
  return `Gemini trả câu không đọc được.${draftExcerpt(raw)}`
}

export function explainQuizDraft(raw: string): string {
  if (!raw.trim()) return 'Gemini không trả nội dung.'
  let parsed: unknown
  try {
    parsed = parseLooseJson(raw)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'JSON hỏng'
    return `Gemini trả JSON không đọc được (${message}).${draftExcerpt(raw)}`
  }
  const body = Array.isArray(parsed) ? null : asJsonObject(parsed)
  if (body && Array.isArray(body.quizzes)) {
    if (body.quizzes.length === 0) return `Gemini trả quizzes rỗng.${draftExcerpt(raw)}`
    return explainOneQuiz(body.quizzes[0], raw)
  }
  const list = quizList(parsed)
  if (list.length === 0) return `Gemini không trả object JSON.${draftExcerpt(raw)}`
  return explainOneQuiz(list[0], raw)
}

export function readEssayDraft(raw: string): { problem: string; thinkingGuide: unknown; solution: unknown } | null {
  const parsed = parseLooseJson(raw)
  const candidates = Array.isArray(parsed) ? parsed : [asJsonObject(parsed)]
  for (const item of candidates) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const row = item as { problem?: unknown; thinkingGuide?: unknown; solution?: unknown; essays?: unknown }
    if (typeof row.problem === 'string' && row.problem.trim() && row.solution) {
      return { problem: row.problem.trim(), thinkingGuide: row.thinkingGuide, solution: row.solution }
    }
    if (Array.isArray(row.essays)) {
      for (const essay of row.essays) {
        if (!essay || typeof essay !== 'object') continue
        const nested = essay as { problem?: unknown; thinkingGuide?: unknown; solution?: unknown }
        if (typeof nested.problem === 'string' && nested.problem.trim() && nested.solution) {
          return { problem: nested.problem.trim(), thinkingGuide: nested.thinkingGuide, solution: nested.solution }
        }
      }
    }
  }
  return null
}
