import { foldPlainScience, homeworkDataSignature } from '@/lib/homework-help/homework-help-fingerprint'
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

function tryParse(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return undefined
  }
}

function sliceParse(raw: string, open: string, close: string): unknown {
  const start = raw.indexOf(open)
  const end = raw.lastIndexOf(close)
  if (start < 0 || end <= start) return undefined
  return tryParse(raw.slice(start, end + 1))
}

function asModelRecord(value: unknown): unknown {
  if (!Array.isArray(value)) return value
  if (value.every((item) => typeof item === 'string')) return { note: '', statements: value }
  return { problems: value }
}

/** Nhận object đúng dạng, hoặc mảng trần mà model vẫn hay trả. */
export function parseModelJson(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const whole = tryParse(trimmed)
  if (whole !== undefined) return asModelRecord(whole)
  const arrayAt = trimmed.indexOf('[')
  const objectAt = trimmed.indexOf('{')
  if (arrayAt >= 0 && (objectAt < 0 || arrayAt < objectAt)) {
    const parsed = sliceParse(trimmed, '[', ']')
    if (parsed !== undefined) return asModelRecord(parsed)
  }
  if (objectAt >= 0) {
    const parsed = sliceParse(trimmed, '{', '}')
    if (parsed !== undefined) return asModelRecord(parsed)
  }
  return null
}

export function parseHomeworkStatements(raw: unknown): { note: string; statements: string[] } | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  if (!Array.isArray(record.statements)) return null
  const statements: string[] = []
  for (const item of record.statements) {
    const text = cleanLine(item, 4000)
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
      answer: cleanLine(item.answer, 2000),
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

function sameAnswerToken(left: string, right: string): boolean {
  if (left === right) return true
  if (!/^-?\d/.test(left) || !/^-?\d/.test(right)) return false
  const a = Number(left)
  const b = Number(right)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false
  const diff = Math.abs(a - b)
  const scale = Math.max(Math.abs(a), Math.abs(b), 1)
  return diff <= 0.02 || diff / scale <= 0.005
}

function tokensAgree(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((token, index) => sameAnswerToken(token, right[index] ?? ''))
}

/** Số đo và công thức mới, bỏ hệ số cân bằng và chất đã có trong đề. */
function outcomeTokens(answer: string, statement: string): { formulas: string[]; numbers: number[] } {
  const known = new Set(homeworkDataSignature(statement).split('|').filter(Boolean))
  const formulas: string[] = []
  const numbers: number[] = []
  for (const token of homeworkDataSignature(answer).split('|').filter(Boolean)) {
    if (/^-?\d/.test(token)) {
      const value = Number(token)
      if (!Number.isFinite(value)) continue
      if (Number.isInteger(value) && value <= 40) continue
      numbers.push(value)
      continue
    }
    if (!known.has(token)) formulas.push(token)
  }
  numbers.sort((left, right) => left - right)
  return { formulas: [...new Set(formulas)].sort(), numbers }
}

export function answersAgree(left: string, right: string, statement = ''): boolean {
  const a = homeworkDataSignature(left).split('|').filter(Boolean)
  const b = homeworkDataSignature(right).split('|').filter(Boolean)
  if (!a.length || !b.length) return false
  if (tokensAgree(a, b)) return true
  const aSorted = [...a].sort()
  const bSorted = [...b].sort()
  if (tokensAgree(aSorted, bSorted)) return true
  if (!statement) return false
  const aOut = outcomeTokens(left, statement)
  const bOut = outcomeTokens(right, statement)
  if (aOut.formulas.length + aOut.numbers.length < 2) return false
  if (!tokensAgree(aOut.formulas, bOut.formulas)) return false
  return (
    aOut.numbers.length === bOut.numbers.length &&
    aOut.numbers.every((value, index) => sameAnswerToken(String(value), String(bOut.numbers[index] ?? '')))
  )
}

function compactStudyLine(line: string): string {
  return normalizeHomeworkAnswer(foldPlainScience(line))
    .replace(/[()]/g, '')
    .replace(/(\d),(\d)/g, '$1.$2')
}

function lineHasResult(line: string, token: string): boolean {
  const compact = compactStudyLine(line)
  if (/^-?\d/.test(token)) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(?:^|[^\\d])${escaped}(?:$|[^\\d])`).test(compact)
  }
  return token.length >= 4 && compact.includes(token)
}

function freshResultTokens(answer: string, statement: string): string[] {
  const known = new Set(homeworkDataSignature(statement).split('|').filter(Boolean))
  return homeworkDataSignature(answer)
    .split('|')
    .filter((token) => token.length >= 4 && !known.has(token))
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
  const tags = draft.tags ?? []
  if (!check) {
    return {
      problem: {
        statement: draft.statement,
        knowledge: [],
        thinking: draft.thinking,
        hints: draft.hints,
        answer: '',
        tags: [],
      },
      cacheable: false,
    }
  }
  const confirmed = new Set(check.knowledge.filter((item) => item.ok).map((item) => item.index))
  const knowledge = draft.knowledge.filter((_, index) => confirmed.has(index))
  const agreed = answersAgree(draft.answer, check.answer, draft.statement)
  const revealed = freshResultTokens(`${draft.answer}\n${check.answer}`, draft.statement)
  const hideResult = (line: string) => !revealed.some((token) => lineHasResult(line, token))
  const cores = [draft.answer, check.answer]
    .map((value) => answerCore(normalizeHomeworkAnswer(value)))
    .filter((core) => core.length > 0)
  const visibleTags = tags.filter((tag) => !lineLeaks(tag.title, cores) && hideResult(tag.title))
  if (agreed) {
    return {
      problem: {
        ...draft,
        knowledge: knowledge.filter(hideResult),
        thinking: draft.thinking.filter(hideResult),
        hints: draft.hints.filter(hideResult),
        answer: draft.answer.trim(),
        tags: visibleTags,
      },
      cacheable: true,
    }
  }
  return {
    problem: {
      statement: draft.statement,
      knowledge,
      thinking: draft.thinking.filter((line) => !lineLeaks(line, cores)),
      hints: draft.hints.filter((line) => !lineLeaks(line, cores)),
      answer: '',
      tags: visibleTags,
    },
    cacheable: false,
  }
}
