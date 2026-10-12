export type HomeworkProblem = {
  statement: string
  knowledge: string[]
  thinking: string[]
  hints: string[]
  answer: string
}

export type HomeworkGuide = {
  note: string
  problems: HomeworkProblem[]
}

export type HomeworkReviewCheck = {
  label: string
  ok: boolean
  note: string
}

export type HomeworkReview = {
  checks: HomeworkReviewCheck[]
  gap: string
}

const MAX_PROBLEMS = 8

function cleanLine(value: unknown, max: number): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
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
    const statement = cleanLine(item.statement, 1200)
    if (!statement) continue
    problems.push({
      statement,
      knowledge: asLines(item.knowledge, 5, 280),
      thinking: asLines(item.thinking, 6, 320),
      hints: asLines(item.hints, 4, 320),
      answer: cleanLine(item.answer, 500),
    })
    if (problems.length >= MAX_PROBLEMS) break
  }
  return { note, problems }
}

export function parseHomeworkReview(raw: unknown): HomeworkReview | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  const checksRaw = record.checks
  if (!Array.isArray(checksRaw)) return null
  const checks: HomeworkReviewCheck[] = []
  for (const row of checksRaw) {
    if (!row || typeof row !== 'object') continue
    const item = row as Record<string, unknown>
    const label = cleanLine(item.label, 120)
    const note = cleanLine(item.note, 320)
    if (!label && !note) continue
    checks.push({
      label: label || note,
      ok: item.ok === true,
      note,
    })
    if (checks.length >= 5) break
  }
  if (!checks.length) return null
  return {
    checks,
    gap: cleanLine(record.gap, 400),
  }
}
