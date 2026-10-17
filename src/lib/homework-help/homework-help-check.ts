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

export type HomeworkAnswerPick = {
  index: number
  pick: 'draft' | 'check' | 'none'
  answer: string
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

/**
 * Ghép đáp án vào đúng index đã hỏi.
 * Khớp hết thì lấy theo index. Bộ index đúng bằng dãy đã hỏi cộng 1 thì hạ một bậc.
 * Không khớp index nào nhưng đủ số câu thì lấy theo thứ tự model trả.
 */
export function alignSolverAnswers(
  requestedIndexes: number[],
  solved: HomeworkProblemCheck[] | null
): Map<number, string> {
  const aligned = new Map<number, string>()
  if (!solved?.length || requestedIndexes.length === 0) return aligned
  const requested = requestedIndexes.filter((index, position) => requestedIndexes.indexOf(index) === position)
  const byIndex = new Map<number, string>()
  const inOrder: string[] = []
  for (const row of solved) {
    const answer = row.answer.trim()
    if (!answer || byIndex.has(row.index)) continue
    byIndex.set(row.index, answer)
    inOrder.push(answer)
  }
  const exactHits = requested.filter((index) => byIndex.has(index)).length
  if (exactHits === requested.length) {
    for (const index of requested) aligned.set(index, byIndex.get(index) ?? '')
    return aligned
  }
  const minRequested = Math.min(...requested)
  const oneBased =
    !byIndex.has(minRequested) &&
    byIndex.size === requested.length &&
    requested.every((index) => byIndex.has(index + 1))
  if (oneBased) {
    for (const index of requested) aligned.set(index, byIndex.get(index + 1) ?? '')
    return aligned
  }
  if (exactHits === 0 && inOrder.length === requested.length) {
    requested.forEach((index, position) => aligned.set(index, inOrder[position] ?? ''))
    return aligned
  }
  for (const index of requested) {
    const answer = byIndex.get(index)
    if (answer) aligned.set(index, answer)
  }
  return aligned
}

export type HomeworkSameVerdict = {
  index: number
  same: boolean
}

export type HomeworkSideVerdict = {
  index: number
  side: 'draft' | 'check' | 'none'
}

function problemRows(raw: unknown): unknown[] | null {
  if (!raw || typeof raw !== 'object') return null
  const problems = (raw as Record<string, unknown>).problems
  return Array.isArray(problems) ? problems : null
}

/**
 * Gắn cờ same về đúng index đã hỏi.
 * Model hay chép index 0 trong ví dụ dù câu gửi lên là index khác.
 */
export function alignSameVerdicts(requested: number[], judged: HomeworkSameVerdict[] | null): Set<number> {
  const same = new Set<number>()
  if (!judged?.length || requested.length === 0) return same
  const wanted = new Set(requested)
  const used = new Set<number>()
  for (const row of judged) {
    if (!wanted.has(row.index) || used.has(row.index)) continue
    used.add(row.index)
    if (row.same) same.add(row.index)
  }
  const missed = requested.filter((index) => !used.has(index))
  const extras = judged.filter((row) => !wanted.has(row.index))
  if (missed.length > 0 && extras.length === missed.length) {
    missed.forEach((index, position) => {
      if (extras[position]?.same) same.add(index)
    })
  }
  return same
}

/** Lượt hỏi: hai đáp án khác chữ có cùng kết quả hay không. */
export function parseHomeworkSame(raw: unknown): HomeworkSameVerdict[] | null {
  const problems = problemRows(raw)
  if (!problems) return null
  const out: HomeworkSameVerdict[] = []
  for (const row of problems) {
    if (!row || typeof row !== 'object') continue
    const item = row as Record<string, unknown>
    const index = Number(item.index)
    if (!Number.isInteger(index) || index < 0 || index > 7) continue
    out.push({ index, same: item.same === true })
  }
  return out
}

/** Lượt hỏi thứ ba: GPT giống DeepSeek, giống Gemini, hay không giống ai. */
export function parseHomeworkSide(raw: unknown): HomeworkSideVerdict[] | null {
  const problems = problemRows(raw)
  if (!problems) return null
  const out: HomeworkSideVerdict[] = []
  for (const row of problems) {
    if (!row || typeof row !== 'object') continue
    const item = row as Record<string, unknown>
    const index = Number(item.index)
    if (!Number.isInteger(index) || index < 0 || index > 7) continue
    const sideText = cleanLine(item.side, 16).toLowerCase()
    const side = sideText === 'draft' || sideText === 'check' || sideText === 'none' ? sideText : 'none'
    out.push({ index, side })
  }
  return out
}

export function parseHomeworkPicks(raw: unknown): HomeworkAnswerPick[] | null {
  if (!raw || typeof raw !== 'object') return null
  const problems = (raw as Record<string, unknown>).problems
  if (!Array.isArray(problems)) return null
  const out: HomeworkAnswerPick[] = []
  for (const row of problems) {
    if (!row || typeof row !== 'object') continue
    const item = row as Record<string, unknown>
    const index = Number(item.index)
    if (!Number.isInteger(index) || index < 0 || index > 7) continue
    const pickText = cleanLine(item.pick, 16).toLowerCase()
    const pick = pickText === 'draft' || pickText === 'check' || pickText === 'none' ? pickText : 'none'
    out.push({ index, pick, answer: cleanLine(item.answer, 2000) })
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
  check: HomeworkProblemCheck | null,
  options?: { trust?: boolean }
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
  const agreed = options?.trust === true || answersAgree(draft.answer, check.answer, draft.statement)
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
        knowledge: draft.knowledge.filter(hideResult),
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
      knowledge: draft.knowledge.filter((line) => !lineLeaks(line, cores)),
      thinking: draft.thinking.filter((line) => !lineLeaks(line, cores)),
      hints: draft.hints.filter((line) => !lineLeaks(line, cores)),
      answer: '',
      tags: visibleTags,
    },
    cacheable: false,
  }
}

/** Chữ đáp án đang hiện thuộc model nào. Đề có hình lấy bài GPT. Đề chữ lấy DeepSeek, hoặc GPT khi GPT là bên được chọn. */
export function shownAnswerMark(input: {
  pictured: boolean
  visionAgreed: boolean
  agreed: boolean
  side: '' | 'draft' | 'check'
  hasAnswer: boolean
}): 'D' | 'G' | 'P' | '' {
  if (!input.hasAnswer) return ''
  if (input.pictured) return input.visionAgreed ? 'P' : ''
  if (input.agreed || input.side === 'draft') return 'D'
  if (input.side === 'check') return 'P'
  return ''
}

/** Đề có hình. Không dùng DeepSeek. Gemini và GPT khớp thì hiện nguyên bài của GPT. */
export function mergeVisionPair(
  guide: HomeworkProblem,
  geminiAnswer: string,
  gptAnswer: string,
  options?: { trust?: boolean }
): { problem: HomeworkProblem; agreed: boolean; cacheable: boolean } {
  const gemini = geminiAnswer.trim()
  const gpt = gptAnswer.trim()
  const trust = options?.trust === true && Boolean(gemini) && Boolean(gpt)
  const agreed = Boolean(gemini) && Boolean(gpt) && (trust || answersAgree(gemini, gpt, guide.statement))
  const merged = mergeCheckedProblem(
    { ...guide, answer: gpt },
    { index: 0, answer: gemini, knowledge: [] },
    { trust: agreed }
  )
  return { problem: merged.problem, agreed, cacheable: agreed && merged.cacheable }
}

/** Đáp án thứ ba trùng bên nào thì trả về bên đó. Trùng cả hai thì lấy bản DeepSeek. */
export function matchingDeepSeekAnswer(
  draftAnswer: string,
  checkAnswer: string,
  fallbackAnswer: string,
  statement = ''
): 'draft' | 'check' | '' {
  const fallback = fallbackAnswer.trim()
  if (!fallback) return ''
  const draftHit = Boolean(draftAnswer.trim()) && answersAgree(fallback, draftAnswer, statement)
  const checkHit = Boolean(checkAnswer.trim()) && answersAgree(fallback, checkAnswer, statement)
  if (draftHit) return 'draft'
  if (checkHit) return 'check'
  return ''
}

function chosenSideAnswer(
  draftAnswer: string,
  checkAnswer: string,
  statement: string,
  verdict: HomeworkAnswerPick | null,
  trust: boolean
): string {
  if (!verdict || verdict.pick === 'none') return ''
  if (trust) {
    if (verdict.pick === 'draft') return draftAnswer.trim()
    return verdict.answer.trim()
  }
  const chosen = verdict.pick === 'draft' ? draftAnswer : checkAnswer
  if (!chosen.trim()) return ''
  if (!answersAgree(verdict.answer, chosen, statement)) return ''
  return chosen.trim()
}

/** Hai đáp án đã khác nhau. Chỉ hiện bên mà lượt phân xử chọn, và câu trả lời nó chép lại phải khớp bên đó. */
export function mergeAdjudicatedProblem(
  draft: HomeworkProblem,
  check: HomeworkProblemCheck,
  verdict: HomeworkAnswerPick | null,
  options?: { trust?: boolean }
): { problem: HomeworkProblem; cacheable: boolean } {
  const chosen = chosenSideAnswer(draft.answer, check.answer, draft.statement, verdict, options?.trust === true)
  if (!chosen) {
    return mergeCheckedProblem(draft, check)
  }
  const revealed = freshResultTokens(`${draft.answer}\n${check.answer}`, draft.statement)
  const hideResult = (line: string) => !revealed.some((token) => lineHasResult(line, token))
  const cores = [draft.answer, check.answer]
    .map((value) => answerCore(normalizeHomeworkAnswer(value)))
    .filter((core) => core.length > 0)
  const keepLine = (line: string) => hideResult(line) && !lineLeaks(line, cores)
  const tags = draft.tags ?? []
  return {
    problem: {
      ...draft,
      knowledge: draft.knowledge.filter(keepLine),
      thinking: draft.thinking.filter(keepLine),
      hints: draft.hints.filter(keepLine),
      answer: chosen,
      tags: tags.filter((tag) => keepLine(tag.title)),
    },
    cacheable: false,
  }
}
