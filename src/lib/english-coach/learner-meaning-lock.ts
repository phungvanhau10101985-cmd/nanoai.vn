const FUNCTION_FOLDS = new Set([
  'ten', 'toi', 'tao', 'la', 'cua', 'em', 'anh', 'chi', 'muon', 'noi', 'mot', 'cai', 'nay', 'va', 'voi',
  'cho', 'duoc', 'khong', 'co', 'nguoi', 'ban', 'minh', 'thi', 'da', 'se', 'rat', 'cung', 've', 'o',
  'den', 'di', 'lam', 'gi', 'nao', 'do', 'day', 'kia', 'cac', 'nhung', 'trong', 'tren', 'duoi', 'ra',
  'vao', 'lai', 'nua', 'nhe', 'oi', 'ho', 'hoc', 'sinh', 'chao', 'xin', 'goi', 'thich', 'biet',
  'my', 'name', 'is', 'am', 'are', 'was', 'were', 'i', 'im', 'you', 'your', 'me', 'a', 'an', 'the',
  'to', 'of', 'and', 'or', 'in', 'on', 'at', 'for', 'with', 'this', 'that', 'it', 'we', 'they',
  'he', 'she', 'his', 'her', 'our', 'their', 'hello', 'hi',
])

type NameRun = { start: number; end: number; tokens: string[] }

function foldToken(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

function hasDiacritic(token: string): boolean {
  return /\p{M}/u.test(token.normalize('NFD'))
}

function isCapitalized(token: string): boolean {
  return /\p{Lu}/u.test(token)
}

function isFunctionToken(token: string): boolean {
  const folded = foldToken(token)
  return folded.length < 2 || FUNCTION_FOLDS.has(folded)
}

function nameRuns(text: string): NameRun[] {
  const source = String(text || '')
  const matches = Array.from(source.matchAll(/\p{L}+(?:['’]\p{L}+)?/gu))
  const runs: NameRun[] = []
  let current: NameRun | null = null
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i]
    const token = match[0]
    const start = match.index ?? 0
    const end = start + token.length
    const nameLike = !isFunctionToken(token) && (isCapitalized(token) || hasDiacritic(token))
    const prev = i > 0 ? matches[i - 1] : null
    const gap = prev ? source.slice((prev.index ?? 0) + prev[0].length, start) : ''
    const sameCase = Boolean(current) && isCapitalized(current.tokens[0]) === isCapitalized(token)
    const continues = Boolean(current) && sameCase && /^\s+$/u.test(gap)
    if (nameLike && continues && current) {
      current.tokens.push(token)
      current.end = end
      continue
    }
    if (current && keepNameRun(current)) runs.push(current)
    current = nameLike ? { start, end, tokens: [token] } : null
  }
  if (current && keepNameRun(current)) runs.push(current)
  return runs
}

function keepNameRun(run: NameRun): boolean {
  if (run.tokens.length >= 2) return true
  return isCapitalized(run.tokens[0]) && hasDiacritic(run.tokens[0])
}

function canonicalMeaningRun(meaning: string): string[] {
  const runs = nameRuns(meaning)
  if (runs.length === 0) return []
  return runs.reduce((best, run) => (run.tokens.length > best.tokens.length ? run : best)).tokens
}

export function applyLearnerMeaningNames(text: string, meaning: string): string {
  const source = String(text || '')
  const meaningRun = canonicalMeaningRun(meaning)
  if (!source.trim() || meaningRun.length === 0) return source
  const runs = nameRuns(source).filter((run) => run.tokens.length === meaningRun.length)
  if (runs.length === 0) return source
  let next = source
  for (let i = runs.length - 1; i >= 0; i -= 1) {
    const run = runs[i]
    const differs = run.tokens.some((token, index) => foldToken(token) !== foldToken(meaningRun[index] || ''))
    if (!differs) continue
    next = `${next.slice(0, run.start)}${meaningRun.join(' ')}${next.slice(run.end)}`
  }
  return next
}
