import { parseHomeworkGuide, type HomeworkProblem } from '@/lib/homework-help/homework-help-guide'

export type HomeworkKnowledgeVerdict = {
  index: number
  ok: boolean
}

export type HomeworkProblemCheck = {
  index: number
  answer: string
  knowledge: HomeworkKnowledgeVerdict[]
}

function cleanLine(value: unknown, max: number): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

export function parseHomeworkStatements(raw: unknown): { note: string; statements: string[] } | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  if (!Array.isArray(record.statements)) return null
  const statements: string[] = []
  for (const item of record.statements) {
    const text = cleanLine(item, 1200)
    if (!text) continue
    statements.push(text)
    if (statements.length >= 8) break
  }
  return { note: cleanLine(record.note, 300), statements }
}

export function parseIndexedDrafts(
  raw: unknown
): Array<{ index: number; problem: HomeworkProblem }> | null {
  if (!raw || typeof raw !== 'object') return null
  const problems = (raw as Record<string, unknown>).problems
  if (!Array.isArray(problems)) return null
  const out: Array<{ index: number; problem: HomeworkProblem }> = []
  problems.forEach((row, position) => {
    const guide = parseHomeworkGuide({ note: '', problems: [row] })
    const problem = guide?.problems[0]
    if (!problem) return
    const indexValue =
      row && typeof row === 'object' ? Number((row as Record<string, unknown>).index) : Number.NaN
    const index = Number.isInteger(indexValue) && indexValue >= 0 && indexValue <= 7 ? indexValue : position
    out.push({ index, problem })
  })
  return out
}

export function parseHomeworkChecks(raw: unknown): HomeworkProblemCheck[] | null {
  if (!raw || typeof raw !== 'object') return null
  const problems = (raw as Record<string, unknown>).problems
  if (!Array.isArray(problems)) return null
  const out: HomeworkProblemCheck[] = []
  for (const row of problems) {
    if (!row || typeof row !== 'object') continue
    const item = row as Record<string, unknown>
    const index = Number(item.index)
    if (!Number.isInteger(index) || index < 0 || index > 7) continue
    const knowledge: HomeworkKnowledgeVerdict[] = []
    if (Array.isArray(item.knowledge)) {
      for (const mark of item.knowledge) {
        if (!mark || typeof mark !== 'object') continue
        const verdict = mark as Record<string, unknown>
        const line = Number(verdict.index)
        if (!Number.isInteger(line) || line < 0 || line > 4) continue
        knowledge.push({ index: line, ok: verdict.ok === true })
      }
    }
    out.push({
      index,
      answer: cleanLine(item.answer, 500),
      knowledge,
    })
  }
  return out
}

export function normalizeHomeworkAnswer(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[×*]/g, 'x')
    .replace(/\s+/g, '')
    .replace(/[.,;。；]+$/g, '')
    .replace(/\$/g, '')
}

function answerCore(normalized: string): string {
  const eq = normalized.lastIndexOf('=')
  return (eq >= 0 ? normalized.slice(eq + 1) : normalized).replace(/^[:：]+/, '')
}

export function answersAgree(left: string, right: string): boolean {
  const a = normalizeHomeworkAnswer(left)
  const b = normalizeHomeworkAnswer(right)
  if (!a || !b) return false
  if (a === b) return true
  const leftCore = answerCore(a)
  const rightCore = answerCore(b)
  return Boolean(leftCore) && leftCore === rightCore
}

function lineLeaks(line: string, cores: string[]): boolean {
  const compact = normalizeHomeworkAnswer(line)
  return cores.some((core) => {
    if (core.length >= 4) return compact.includes(core)
    if (/^-?\d+(?:[./]\d+)?$/.test(core)) {
      const escaped = core.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return new RegExp(`(?:^|[^\\d])${escaped}(?:$|[^\\d])`).test(compact)
    }
    return false
  })
}

export function mergeCheckedProblem(
  draft: HomeworkProblem,
  check: HomeworkProblemCheck | null
): { problem: HomeworkProblem; cacheable: boolean } {
  if (!check) {
    return {
      problem: {
        statement: draft.statement,
        knowledge: [],
        thinking: draft.thinking,
        hints: draft.hints,
        answer: '',
      },
      cacheable: false,
    }
  }
  const confirmed = new Set(check.knowledge.filter((item) => item.ok).map((item) => item.index))
  const knowledge = draft.knowledge.filter((_, index) => confirmed.has(index))
  const agreed = answersAgree(draft.answer, check.answer)
  if (agreed) {
    return {
      problem: { ...draft, knowledge, answer: draft.answer.trim() },
      cacheable: true,
    }
  }
  const cores = [draft.answer, check.answer]
    .map((value) => answerCore(normalizeHomeworkAnswer(value)))
    .filter((core) => core.length > 0)
  return {
    problem: {
      statement: draft.statement,
      knowledge,
      thinking: draft.thinking.filter((line) => !lineLeaks(line, cores)),
      hints: draft.hints.filter((line) => !lineLeaks(line, cores)),
      answer: '',
    },
    cacheable: true,
  }
}
