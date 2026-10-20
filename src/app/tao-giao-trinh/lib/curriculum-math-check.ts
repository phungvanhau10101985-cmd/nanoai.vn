/**
 * Tính lại ví dụ trong giáo trình.
 * Số đúng lấy từ dữ liệu bài và nghĩa của kết luận (vuông = tích vô hướng 0), không lấy từ sách.
 * Bài lệch, hoặc bài toán không tính được, được đánh dấu cho giáo viên. Màn học sinh bỏ cả khối đó.
 */

import { diffMathExpr, evalMathExpr, expressionsNear, integrateSimpson, parseMathExpr } from './curriculum-math-expr'

export const CURRICULUM_MATH_FAIL_OPEN = '<!-- curriculum-math-fail -->'
export const CURRICULUM_MATH_FAIL_CLOSE = '<!-- /curriculum-math-fail -->'
export const CURRICULUM_MATH_FAIL_TITLE = 'Bài này AI viết sai, cần tính lại.'
export const CURRICULUM_MATH_UNVERIFIED_TITLE = 'Bài này code chưa kiểm được, giáo viên cần xem.'
export const CURRICULUM_MATH_TEACHER_OK = '<!-- curriculum-math-teacher-ok -->'

const FAIL_BLOCK_RE =
  /<!--\s*curriculum-math-fail\s*-->[\s\S]*?<!--\s*\/curriculum-math-fail\s*-->/g
const CHECK_COMMENT_RE = /<!--\s*check\s+(\{[\s\S]*?\})\s*-->/g
const TEACHER_OK_RE = /<!--\s*curriculum-math-teacher-ok\s*-->/g
const FAIL_QUOTE_RE =
  /^>\s*\*\*(?:Bài này AI viết sai, cần tính lại\.|Bài này code chưa kiểm được, giáo viên cần xem\.)\*\*[^\n]*\n?/gm

type Vec = number[]

type CheckRecord = {
  kind?: string
  a?: unknown
  b?: unknown
  v?: unknown
  p?: unknown
  q?: unknown
  k?: unknown
  vectors?: unknown
  scalars?: unknown
  points?: unknown
  shown?: unknown
  expr?: unknown
  var?: unknown
  vars?: unknown
  values?: unknown
  deg?: unknown
  at?: unknown
  anti?: unknown
}

export type CurriculumMathIssueKind = 'wrong' | 'unverified'

export type CurriculumMathFailure = {
  start: number
  end: number
  message: string
  kind: CurriculumMathIssueKind
}

export type CurriculumMathCheckOptions = {
  subjectId?: string | null
}

type CheckOutcome =
  | { state: 'ok' }
  | { state: 'wrong'; message: string }
  | { state: 'unverified'; message: string }

export function isCurriculumMathSubject(subjectId: string | null | undefined): boolean {
  return String(subjectId || '').trim().toLowerCase() === 'toan'
}

function nearlyEqual(a: number, b: number): boolean {
  const scale = Math.max(1, Math.abs(a), Math.abs(b))
  return Math.abs(a - b) <= 1e-6 * scale
}

function parseNum(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  const text = String(raw ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/−/g, '-')
    .replace(',', '.')
  if (!text) return null
  const frac = text.match(/^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/)
  if (frac) {
    const den = Number(frac[2])
    if (!den) return null
    return Number(frac[1]) / den
  }
  const n = Number(text)
  return Number.isFinite(n) ? n : null
}

function asVec(raw: unknown): Vec | null {
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > 3) return null
  const nums = raw.map((item) => parseNum(item))
  if (nums.some((n) => n == null)) return null
  return nums as Vec
}

function asVecList(raw: unknown): Vec[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const list = raw.map((item) => asVec(item))
  if (list.some((v) => v == null)) return null
  return list as Vec[]
}

function sameDim(list: Vec[]): boolean {
  return list.every((v) => v.length === list[0]?.length)
}

function dot(a: Vec, b: Vec): number | null {
  if (a.length !== b.length) return null
  return a.reduce((sum, n, i) => sum + n * b[i], 0)
}

function addScaled(list: Vec[], scalars?: number[] | null): Vec | null {
  if (!sameDim(list)) return null
  const dim = list[0].length
  const out = Array(dim).fill(0)
  for (let i = 0; i < list.length; i++) {
    const k = scalars?.[i] ?? 1
    for (let d = 0; d < dim; d++) out[d] += k * list[i][d]
  }
  return out
}

function average(list: Vec[]): Vec | null {
  const sum = addScaled(list)
  if (!sum) return null
  return sum.map((n) => n / list.length)
}

function sub(a: Vec, b: Vec): Vec | null {
  if (a.length !== b.length) return null
  return a.map((n, i) => n - b[i])
}

function length(v: Vec): number {
  return Math.sqrt(v.reduce((sum, n) => sum + n * n, 0))
}

function lengthSquared(v: Vec): number {
  return v.reduce((sum, n) => sum + n * n, 0)
}

function vecNear(a: Vec, b: Vec): boolean {
  return a.length === b.length && a.every((n, i) => nearlyEqual(n, b[i]))
}

function shownNearNumber(shown: unknown, value: number): boolean {
  if (typeof shown === 'string') {
    const text = shown.trim().replace(/\s+/g, '').replace(/−/g, '-')
    const sqrt = text.match(/^sqrt\((-?\d+(?:\.\d+)?)\)$/i) || text.match(/^√\(?(-?\d+(?:\.\d+)?)\)?$/)
    if (sqrt) return nearlyEqual(value * value, Number(sqrt[1]))
  }
  const n = parseNum(shown)
  if (n == null) return false
  return nearlyEqual(n, value)
}

function shownNearVec(shown: unknown, value: Vec): boolean {
  const vec = asVec(shown)
  return vec != null && vecNear(vec, value)
}

function collinear(a: Vec, b: Vec): boolean | null {
  if (a.length !== b.length) return null
  const a0 = a.every((n) => nearlyEqual(n, 0))
  const b0 = b.every((n) => nearlyEqual(n, 0))
  if (a0 || b0) return true
  let k: number | null = null
  for (let i = 0; i < a.length; i++) {
    if (nearlyEqual(b[i], 0)) {
      if (!nearlyEqual(a[i], 0)) return false
      continue
    }
    const ratio = a[i] / b[i]
    if (k == null) k = ratio
    else if (!nearlyEqual(k, ratio)) return false
  }
  return k != null
}

function angleWord(a: Vec, b: Vec): 'acute' | 'right' | 'obtuse' | null {
  const d = dot(a, b)
  if (d == null) return null
  const scale = Math.max(1, length(a) * length(b))
  if (Math.abs(d) <= 1e-6 * scale) return 'right'
  return d > 0 ? 'acute' : 'obtuse'
}

function formatVec(v: Vec): string {
  return `(${v.map((n) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000))).join('; ')})`
}

function readVars(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, number> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const n = parseNum(value)
    if (n == null) continue
    out[key] = n
  }
  return out
}

function evalShownExpr(shown: unknown, vars: Record<string, number>, deg: boolean): number | null {
  if (typeof shown === 'number' && Number.isFinite(shown)) return shown
  const text = String(shown ?? '').trim()
  if (!text) return null
  const plain = parseNum(text)
  if (plain != null && !/[a-z√π]/i.test(text)) return plain
  const expr = parseMathExpr(text)
  if (!expr) return null
  return evalMathExpr(expr, vars, deg)
}

function numbersNear(actual: number, expected: number, tol = 1e-4): boolean {
  const scale = Math.max(1, Math.abs(actual), Math.abs(expected))
  return Math.abs(actual - expected) <= tol * scale
}

function checkExprRecord(record: CheckRecord): CheckOutcome {
  const expr = parseMathExpr(String(record.expr ?? ''))
  if (!expr) return { state: 'unverified', message: 'Code không đọc được biểu thức.' }
  const vars = readVars(record.vars)
  const deg = record.deg === true
  const actual = evalMathExpr(expr, vars, deg)
  const expected = evalShownExpr(record.shown, vars, deg)
  if (actual == null || expected == null) return { state: 'unverified', message: 'Code không tính được biểu thức.' }
  if (!numbersNear(actual, expected)) {
    return { state: 'wrong', message: `Biểu thức tính được là ${Math.round(actual * 1000) / 1000}, lời giải ghi ${String(record.shown)}.` }
  }
  return { state: 'ok' }
}

function checkEquationRecord(record: CheckRecord): CheckOutcome {
  const expr = parseMathExpr(String(record.expr ?? ''))
  if (!expr) return { state: 'unverified', message: 'Code không đọc được phương trình.' }
  const variable = String(record.var || 'x').trim() || 'x'
  const listed = Array.isArray(record.values) ? record.values : record.at != null ? [record.at] : []
  const values = listed.map((item) => parseNum(item)).filter((n): n is number => n != null)
  if (values.length === 0) return { state: 'unverified', message: 'Thiếu nghiệm để thay vào phương trình.' }
  const base = readVars(record.vars)
  const deg = record.deg === true
  for (const value of values) {
    const got = evalMathExpr(expr, { ...base, [variable]: value }, deg)
    if (got == null) return { state: 'unverified', message: 'Code không thay được nghiệm vào phương trình.' }
    if (!numbersNear(got, 0, 1e-5)) {
      return { state: 'wrong', message: `Thay ${variable} = ${value} thì vế trái bằng ${Math.round(got * 1000) / 1000}, nghiệm phải cho 0.` }
    }
  }
  return { state: 'ok' }
}

function checkDerivRecord(record: CheckRecord): CheckOutcome {
  const expr = parseMathExpr(String(record.expr ?? ''))
  if (!expr) return { state: 'unverified', message: 'Code không đọc được hàm để tính đạo hàm.' }
  const variable = String(record.var || 'x').trim() || 'x'
  const deriv = diffMathExpr(expr, variable)
  if (!deriv) return { state: 'unverified', message: 'Code không tính được đạo hàm của hàm này.' }
  const vars = readVars(record.vars)
  const deg = record.deg === true
  const at = parseNum(record.at)
  if (at != null) {
    const actual = evalMathExpr(deriv, { ...vars, [variable]: at }, deg)
    const expected = evalShownExpr(record.shown, { ...vars, [variable]: at }, deg)
    if (actual == null || expected == null) return { state: 'unverified', message: 'Code không tính được đạo hàm tại điểm đã cho.' }
    if (!numbersNear(actual, expected)) {
      return { state: 'wrong', message: `Đạo hàm tại ${variable} = ${at} là ${Math.round(actual * 1000) / 1000}, lời giải ghi ${String(record.shown)}.` }
    }
    return { state: 'ok' }
  }
  const shown = parseMathExpr(String(record.shown ?? ''))
  if (!shown) return { state: 'unverified', message: 'Code không đọc được đạo hàm trong lời giải.' }
  if (!expressionsNear(deriv, shown, variable, vars, deg)) {
    return { state: 'wrong', message: `Đạo hàm tính được khác với biểu thức lời giải ghi (${String(record.shown)}).` }
  }
  return { state: 'ok' }
}

function checkIntegralRecord(record: CheckRecord): CheckOutcome {
  const expr = parseMathExpr(String(record.expr ?? ''))
  if (!expr) return { state: 'unverified', message: 'Code không đọc được hàm để tính tích phân.' }
  const variable = String(record.var || 'x').trim() || 'x'
  const a = parseNum(record.a)
  const b = parseNum(record.b)
  if (a == null || b == null) return { state: 'unverified', message: 'Thiếu cận tích phân.' }
  const vars = readVars(record.vars)
  const deg = record.deg === true
  const actual = integrateSimpson(expr, variable, a, b, vars, deg)
  const expected = evalShownExpr(record.shown, vars, deg)
  if (actual == null || expected == null) return { state: 'unverified', message: 'Code không tính được tích phân xác định.' }
  if (!numbersNear(actual, expected, 1e-3)) {
    return { state: 'wrong', message: `Tích phân từ ${a} đến ${b} tính được là ${Math.round(actual * 1000) / 1000}, lời giải ghi ${String(record.shown)}.` }
  }
  if (record.anti != null && String(record.anti).trim()) {
    const anti = parseMathExpr(String(record.anti))
    const deriv = anti ? diffMathExpr(anti, variable) : null
    if (!anti || !deriv || !expressionsNear(deriv, expr, variable, vars, deg)) {
      return { state: 'wrong', message: 'Đạo hàm của nguyên hàm không khớp hàm dưới dấu tích phân.' }
    }
  }
  return { state: 'ok' }
}

function checkRecord(record: CheckRecord): CheckOutcome {
  const kind = String(record.kind || '').trim().toLowerCase()
  if (kind === 'expr' || kind === 'value' || kind === 'trig') return checkExprRecord(record)
  if (kind === 'equation' || kind === 'root' || kind === 'roots') return checkEquationRecord(record)
  if (kind === 'deriv' || kind === 'derivative') return checkDerivRecord(record)
  if (kind === 'integral') return checkIntegralRecord(record)
  if (kind === 'dot') {
    const a = asVec(record.a)
    const b = asVec(record.b)
    if (!a || !b) return { state: 'unverified', message: 'Thiếu hai vectơ để tính tích vô hướng.' }
    const value = dot(a, b)
    if (value == null) return { state: 'unverified', message: 'Hai vectơ không cùng số chiều.' }
    if (!shownNearNumber(record.shown, value)) {
      return { state: 'wrong', message: `Tích vô hướng tính được là ${value}, lời giải ghi ${String(record.shown)}.` }
    }
    return { state: 'ok' }
  }
  if (kind === 'add' || kind === 'sum') {
    const list = asVecList(record.vectors)
    if (!list) return { state: 'unverified', message: 'Thiếu các vectơ để cộng.' }
    const scalars = Array.isArray(record.scalars) ? record.scalars.map((n) => parseNum(n)) : null
    if (scalars && scalars.some((n) => n == null)) return { state: 'unverified', message: 'Hệ số nhân không đọc được.' }
    const value = addScaled(list, (scalars as number[] | null) ?? null)
    if (!value || !shownNearVec(record.shown, value)) {
      return { state: 'wrong', message: `Vectơ tổng tính được là ${value ? formatVec(value) : '?'}, lời giải ghi khác.` }
    }
    return { state: 'ok' }
  }
  if (kind === 'scale') {
    const v = asVec(record.v)
    const k = parseNum(record.k)
    if (!v || k == null) return { state: 'unverified', message: 'Thiếu vectơ hoặc hệ số để nhân.' }
    const value = v.map((n) => n * k)
    if (!shownNearVec(record.shown, value)) {
      return { state: 'wrong', message: `Vectơ sau khi nhân tính được là ${formatVec(value)}, lời giải ghi khác.` }
    }
    return { state: 'ok' }
  }
  if (kind === 'midpoint') {
    const p = asVec(record.p)
    const q = asVec(record.q)
    if (!p || !q) return { state: 'unverified', message: 'Thiếu hai điểm để tính trung điểm.' }
    const value = average([p, q])
    if (!value || !shownNearVec(record.shown, value)) {
      return { state: 'wrong', message: `Trung điểm tính được là ${value ? formatVec(value) : '?'}, lời giải ghi khác.` }
    }
    return { state: 'ok' }
  }
  if (kind === 'centroid') {
    const points = asVecList(record.points)
    if (!points || points.length < 3) return { state: 'unverified', message: 'Thiếu ba đỉnh để tính trọng tâm.' }
    const value = average(points.slice(0, 3))
    if (!value || !shownNearVec(record.shown, value)) {
      return { state: 'wrong', message: `Trọng tâm tính được là ${value ? formatVec(value) : '?'}, lời giải ghi khác.` }
    }
    return { state: 'ok' }
  }
  if (kind === 'length' || kind === 'distance') {
    let v: Vec | null = null
    if (kind === 'length') v = asVec(record.v)
    else {
      const p = asVec(record.p)
      const q = asVec(record.q)
      if (p && q) v = sub(q, p)
    }
    if (!v) return { state: 'unverified', message: 'Thiếu dữ liệu để tính độ dài.' }
    const value = length(v)
    if (typeof record.shown === 'string' && /sqrt|√/i.test(record.shown)) {
      if (!shownNearNumber(record.shown, value)) {
        return { state: 'wrong', message: `Bình phương độ dài tính được là ${lengthSquared(v)}, lời giải ghi ${String(record.shown)}.` }
      }
      return { state: 'ok' }
    }
    if (!shownNearNumber(record.shown, value)) {
      return { state: 'wrong', message: `Độ dài tính được là ${Math.round(value * 1000) / 1000}, lời giải ghi ${String(record.shown)}.` }
    }
    return { state: 'ok' }
  }
  if (kind === 'collinear') {
    const a = asVec(record.a)
    const b = asVec(record.b)
    if (!a || !b) return { state: 'unverified', message: 'Thiếu hai vectơ để xét cùng phương.' }
    const value = collinear(a, b)
    if (value == null) return { state: 'unverified', message: 'Hai vectơ không cùng số chiều.' }
    if (typeof record.shown !== 'boolean') return { state: 'unverified', message: 'Thiếu kết luận cùng phương dạng true hoặc false.' }
    if (record.shown !== value) {
      return {
        state: 'wrong',
        message: value
          ? 'Hai vectơ cùng phương, lời giải ghi không cùng phương.'
          : 'Hai vectơ không cùng phương, lời giải ghi cùng phương.',
      }
    }
    return { state: 'ok' }
  }
  if (kind === 'angle') {
    const a = asVec(record.a)
    const b = asVec(record.b)
    if (!a || !b) return { state: 'unverified', message: 'Thiếu hai vectơ để xét góc.' }
    const value = angleWord(a, b)
    const shown = String(record.shown || '').trim().toLowerCase()
    if (!value || !shown) return { state: 'unverified', message: 'Không đọc được kết luận góc.' }
    if (shown !== value) {
      const d = dot(a, b)
      const label = value === 'right' ? 'vuông' : value === 'obtuse' ? 'tù' : 'nhọn'
      return { state: 'wrong', message: `Tích vô hướng tính được là ${d}, góc là ${label}, lời giải ghi ${shown}.` }
    }
    return { state: 'ok' }
  }
  return { state: 'unverified', message: 'Dòng kiểm tra không thuộc dạng code tính được.' }
}


function extractNamedPoints(text: string): Array<{ name: string; v: Vec }> {
  const out: Array<{ name: string; v: Vec }> = []
  const seen = new Set<string>()
  const re = /(?:^|[^A-Za-z])([A-Z])\s*\(\s*([^)\n]{1,40})\s*\)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(text))) {
    const name = match[1].toUpperCase()
    if (seen.has(name)) continue
    const parts = match[2].split(/[;,]/).map((part) => part.trim())
    const v = asVec(parts)
    if (!v) continue
    seen.add(name)
    out.push({ name, v })
  }
  return out
}

function vectorsFromPoints(points: Array<{ name: string; v: Vec }>): Array<{ name: string; v: Vec }> {
  const out: Array<{ name: string; v: Vec }> = []
  for (let i = 0; i < points.length; i++) {
    for (let j = 0; j < points.length; j++) {
      if (i === j) continue
      const v = sub(points[j].v, points[i].v)
      if (!v) continue
      out.push({ name: `${points[i].name}${points[j].name}`, v })
    }
  }
  return out
}

function extractNamedVectors(text: string): Array<{ name: string; v: Vec }> {
  const out: Array<{ name: string; v: Vec }> = []
  const re = /([A-Za-z]{1,3})\s*=\s*\(([^)\n]{1,80})\)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(text))) {
    const parts = match[2].split(/[;,]/).map((part) => part.trim())
    const v = asVec(parts)
    if (!v) continue
    out.push({ name: match[1].toUpperCase(), v })
  }
  return out
}

function anglePairs(named: Array<{ name: string; v: Vec }>, vertex: string | null): Array<[Vec, Vec]> {
  const pairs: Array<[Vec, Vec]> = []
  for (let i = 0; i < named.length; i++) {
    for (let j = i + 1; j < named.length; j++) {
      const a = named[i].name
      const b = named[j].name
      if (a.length !== 2 || b.length !== 2 || a[0] !== b[0]) continue
      if (vertex && a[0] !== vertex) continue
      pairs.push([named[i].v, named[j].v])
    }
  }
  return pairs
}

function claimsRight(text: string): { vertex: string | null } | null {
  if (!/vuông/i.test(text)) return null
  if (/không\s+(?:phải\s+)?(?:một\s+)?(?:tam\s+giác\s+)?vuông/i.test(text) && !/chứng\s*(?:minh|tỏ)[\s\S]{0,80}vuông/i.test(text)) {
    return null
  }
  if (!/vuông\s+tại|tam\s+giác\s+vuông|vuông\s+cân|góc\s+vuông|vuông\s+góc/i.test(text)) return null
  const at = text.match(/vuông\s+tại\s+([A-Z])/i)
  return { vertex: at ? at[1].toUpperCase() : null }
}

function claimsObtuse(text: string): boolean {
  if (!/góc\s+tù/i.test(text)) return false
  if (/không\s+(?:có\s+)?(?:một\s+)?góc\s+tù|không\s+phải\s+góc\s+tù/i.test(text) && !/chứng\s*(?:minh|tỏ)[\s\S]{0,80}góc\s+tù/i.test(text)) {
    return false
  }
  return true
}

function proseFailure(text: string): { state: 'wrong'; message: string } | { state: 'pass' } | { state: 'none' } {
  const splitAt = text.search(/lời giải/i)
  const prompt = splitAt >= 0 ? text.slice(0, splitAt) : text
  const solution = splitAt >= 0 ? text.slice(splitAt) : text
  const fromPoints = vectorsFromPoints(extractNamedPoints(prompt))
  const named = fromPoints.length >= 2 ? fromPoints : extractNamedVectors(solution)
  const asserted = /chứng\s*(?:minh|tỏ)/i.test(prompt)
  const right = claimsRight(solution) || (asserted ? claimsRight(prompt) : null)
  const obtuse = claimsObtuse(solution) || (asserted ? claimsObtuse(prompt) : null)
  if (!right && !obtuse) return { state: 'none' }
  const pairs = anglePairs(named, right?.vertex ?? null)
  const usable = pairs.length > 0 ? pairs : anglePairs(named, null)
  if (usable.length === 0 && named.length >= 2) {
    usable.push([named[named.length - 2].v, named[named.length - 1].v])
  }
  if (usable.length === 0) return { state: 'none' }
  if (right) {
    const hasRight = usable.some(([a, b]) => angleWord(a, b) === 'right')
    if (!hasRight) {
      const [a, b] = usable[0]
      return { state: 'wrong', message: `Tích vô hướng tính được là ${dot(a, b)}, kết luận vuông đòi bằng 0.` }
    }
  }
  if (obtuse) {
    const hasObtuse = usable.some(([a, b]) => angleWord(a, b) === 'obtuse')
    if (!hasObtuse) {
      const [a, b] = usable[0]
      return { state: 'wrong', message: `Tích vô hướng tính được là ${dot(a, b)}, góc tù đòi tích vô hướng âm.` }
    }
  }
  return { state: 'pass' }
}

function solutionSpans(markdown: string): Array<{ start: number; end: number; text: string }> {
  const spans: Array<{ start: number; end: number; text: string }> = []
  const re = /lời giải[\s\S]*?(?=\n(?:#{2,4}\s|\*\*Bài|\*\*Ví dụ|Bài\s+\d+|Ví dụ\s+\d+|-\s+Ví dụ)|\n\n(?:\*\*Bài|\*\*Ví dụ|Bài\s+\d+|Bài tập|Ví dụ|####)|\s*$)/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(markdown))) {
    const start = match.index
    const end = start + match[0].length
    spans.push({ start, end, text: match[0] })
  }
  return spans
}

function expandToExercise(markdown: string, start: number, end: number): { start: number; end: number } {
  let blockStart = markdown.lastIndexOf('\n\n', start)
  blockStart = blockStart < 0 ? 0 : blockStart + 2
  if (blockStart > 0) {
    const prevBreak = markdown.lastIndexOf('\n\n', Math.max(0, blockStart - 3))
    const prevStart = prevBreak < 0 ? 0 : prevBreak + 2
    const prev = markdown.slice(prevStart, blockStart)
    if (/Bài|Ví dụ|Cho\s|Chứng/i.test(prev) && prev.length < 900) blockStart = prevStart
  }
  let blockEnd = end
  const rest = markdown.slice(end)
  const nextBreak = rest.search(/\n\n/)
  if (nextBreak >= 0 && nextBreak < 40) blockEnd = end + nextBreak
  return { start: blockStart, end: blockEnd }
}

export function stripCurriculumMathMarks(markdown: string): string {
  FAIL_BLOCK_RE.lastIndex = 0
  FAIL_QUOTE_RE.lastIndex = 0
  return String(markdown || '')
    .replace(FAIL_BLOCK_RE, (block) =>
      block
        .replace(/<!--\s*\/?curriculum-math-fail\s*-->/g, '')
        .replace(FAIL_QUOTE_RE, '')
    )
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function stripCurriculumMathCheckComments(markdown: string): string {
  CHECK_COMMENT_RE.lastIndex = 0
  return String(markdown || '')
    .replace(CHECK_COMMENT_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function overlaps(covered: Array<{ start: number; end: number }>, start: number, end: number): boolean {
  return covered.some((item) => start < item.end && end > item.start)
}

function hasTeacherOk(text: string): boolean {
  TEACHER_OK_RE.lastIndex = 0
  return TEACHER_OK_RE.test(text)
}

/** Bỏ bài chưa được code chấp nhận khỏi nội dung chiếu cho học sinh. */
export function curriculumMarkdownForStudents(markdown: string): string {
  FAIL_BLOCK_RE.lastIndex = 0
  TEACHER_OK_RE.lastIndex = 0
  const withoutFails = String(markdown || '').replace(FAIL_BLOCK_RE, '\n').replace(TEACHER_OK_RE, '')
  return stripCurriculumMathCheckComments(withoutFails)
}

export function findCurriculumMathFailures(
  markdown: string,
  options?: CurriculumMathCheckOptions
): CurriculumMathFailure[] {
  const clean = stripCurriculumMathMarks(markdown)
  const mathSubject = isCurriculumMathSubject(options?.subjectId)
  const failures: CurriculumMathFailure[] = []
  const verified: Array<{ start: number; end: number }> = []

  CHECK_COMMENT_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = CHECK_COMMENT_RE.exec(clean))) {
    let record: CheckRecord | null = null
    try {
      record = JSON.parse(match[1]) as CheckRecord
    } catch {
      record = null
    }
    const outcome: CheckOutcome = record
      ? checkRecord(record)
      : { state: 'unverified', message: 'Dòng kiểm tra không đọc được.' }
    const block = expandToExercise(clean, match.index, match.index + match[0].length)
    if (outcome.state === 'ok') {
      verified.push(block)
      continue
    }
    const slice = clean.slice(block.start, block.end)
    if (outcome.state === 'unverified' && hasTeacherOk(slice)) {
      verified.push(block)
      continue
    }
    failures.push({ ...block, message: outcome.message, kind: outcome.state })
  }

  for (const span of solutionSpans(clean)) {
    const block = expandToExercise(clean, span.start, span.end)
    if (overlaps(verified, block.start, block.end)) continue
    if (failures.some((item) => block.start < item.end && block.end > item.start)) continue
    const slice = clean.slice(block.start, block.end)
    const prose = proseFailure(slice)
    if (prose.state === 'pass') {
      verified.push(block)
      continue
    }
    if (prose.state === 'wrong') {
      failures.push({ ...block, message: prose.message, kind: 'wrong' })
      continue
    }
    if (mathSubject && !hasTeacherOk(slice)) {
      failures.push({
        ...block,
        kind: 'unverified',
        message: 'Sửa thành bài có kết quả số, hoặc thêm <!-- curriculum-math-teacher-ok --> nếu bài không có kết quả số.',
      })
    }
  }

  failures.sort((a, b) => a.start - b.start)
  const merged: CurriculumMathFailure[] = []
  for (const item of failures) {
    const prev = merged[merged.length - 1]
    if (prev && item.start <= prev.end) {
      prev.end = Math.max(prev.end, item.end)
      if (item.kind === 'wrong') prev.kind = 'wrong'
      if (!prev.message.includes(item.message)) prev.message = `${prev.message} ${item.message}`
      continue
    }
    merged.push({ ...item })
  }
  return merged
}

export function applyCurriculumMathMarks(markdown: string, options?: CurriculumMathCheckOptions): string {
  const clean = stripCurriculumMathMarks(markdown)
  const failures = findCurriculumMathFailures(clean, options)
  if (failures.length === 0) return clean
  let out = clean
  for (let i = failures.length - 1; i >= 0; i--) {
    const item = failures[i]
    const title = item.kind === 'wrong' ? CURRICULUM_MATH_FAIL_TITLE : CURRICULUM_MATH_UNVERIFIED_TITLE
    const body = out.slice(item.start, item.end).trim()
    const marked = `${CURRICULUM_MATH_FAIL_OPEN}\n> **${title}** ${item.message}\n\n${body}\n${CURRICULUM_MATH_FAIL_CLOSE}`
    out = `${out.slice(0, item.start)}${marked}${out.slice(item.end)}`
  }
  return out
}

export function listUnmarkedMathFailures(markdown: string, options?: CurriculumMathCheckOptions): CurriculumMathFailure[] {
  return findCurriculumMathFailures(stripCurriculumMathMarks(markdown), options)
}

export type CurriculumExerciseReview = {
  text: string
  status: 'pass' | 'wrong' | 'unverified'
  message: string
}

/** Mỗi ví dụ hoặc bài có lời giải, kèm kết quả code vừa tính. */
export function listCurriculumExerciseReviews(
  markdown: string,
  options?: CurriculumMathCheckOptions
): CurriculumExerciseReview[] {
  const clean = stripCurriculumMathMarks(markdown)
  const failures = findCurriculumMathFailures(clean, options)
  const ranges: Array<{ start: number; end: number }> = []
  for (const span of solutionSpans(clean)) {
    const block = expandToExercise(clean, span.start, span.end)
    const prev = ranges[ranges.length - 1]
    if (prev && block.start <= prev.end) {
      prev.end = Math.max(prev.end, block.end)
      continue
    }
    ranges.push({ start: block.start, end: block.end })
  }
  for (const failure of failures) {
    if (ranges.some((range) => failure.start < range.end && failure.end > range.start)) continue
    ranges.push({ start: failure.start, end: failure.end })
  }
  ranges.sort((a, b) => a.start - b.start)
  return ranges
    .map((range) => {
      const text = clean.slice(range.start, range.end).trim()
      const overlapping = failures.filter((item) => range.start < item.end && range.end > item.start)
      const hit = overlapping.find((item) => item.kind === 'wrong') ?? overlapping[0]
      if (!hit) return { text, status: 'pass' as const, message: '' }
      return { text, status: hit.kind, message: hit.message }
    })
    .filter((item) => item.text.length > 0)
}

/** Thay một ví dụ đã soát. Nếu ví dụ đang nằm trong dấu sai, gỡ cả dấu đó. */
export function replaceCurriculumExercise(markdown: string, before: string, after: string): string {
  const needle = before.trim()
  const next = after.trim()
  if (!needle) return markdown
  FAIL_BLOCK_RE.lastIndex = 0
  let replaced = false
  const unwrapped = String(markdown || '').replace(FAIL_BLOCK_RE, (block) => {
    if (replaced || !block.includes(needle)) return block
    replaced = true
    return next
  })
  if (replaced) return unwrapped
  const at = unwrapped.indexOf(needle)
  if (at < 0) return unwrapped
  return `${unwrapped.slice(0, at)}${next}${unwrapped.slice(at + needle.length)}`
}

export function judgeCurriculumExercise(text: string, options?: CurriculumMathCheckOptions): CurriculumExerciseReview {
  const clean = stripCurriculumMathMarks(text).trim()
  const hits = findCurriculumMathFailures(clean, options)
  const wrong = hits.find((item) => item.kind === 'wrong')
  const hit = wrong ?? hits[0]
  if (!hit) return { text: clean, status: 'pass', message: '' }
  return { text: clean, status: wrong ? 'wrong' : hit.kind, message: hit.message }
}

const KNOWLEDGE_LABEL_RE =
  /kiến\s*thức|định\s*nghĩa|định\s*l[íi]|công\s*thức|tính\s*chất|khái\s*niệm|hệ\s*quả|ghi\s*nhớ|nhận\s*xét/i
const EXAMPLE_LABEL_RE = /ví\s*dụ|lời\s*giải|bài\s*tập|luyện\s*tập|vận\s*dụng/i
const KNOWLEDGE_UNVERIFIED_MESSAGE =
  'Slide kiến thức chưa được code kiểm. Sửa công thức nếu sai, hoặc xác nhận nội dung này đúng.'

export type CurriculumReviewSlide = {
  title?: string
  content?: string
  blocks?: Array<{ header?: string; content?: string }>
}

function compactReviewText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function hasPassingCheck(text: string): boolean {
  CHECK_COMMENT_RE.lastIndex = 0
  const seen = CHECK_COMMENT_RE.test(text)
  CHECK_COMMENT_RE.lastIndex = 0
  if (!seen) return false
  return !findCurriculumMathFailures(text).some((item) => item.kind === 'wrong')
}

/** Slide hoặc đoạn kiến thức: code tính được thì chấm, không tính được thì chưa được coi là đúng. */
export function judgeKnowledgeBlock(text: string, options?: CurriculumMathCheckOptions): CurriculumExerciseReview {
  const judged = judgeCurriculumExercise(text, options)
  if (judged.status === 'wrong') return judged
  if (hasTeacherOk(judged.text)) return { ...judged, status: 'pass', message: '' }
  if (judged.status === 'unverified') return judged
  if (hasPassingCheck(judged.text)) return judged
  return { text: judged.text, status: 'unverified', message: KNOWLEDGE_UNVERIFIED_MESSAGE }
}

function knowledgeSpans(markdown: string): Array<{ start: number; end: number }> {
  const spans: Array<{ start: number; end: number }> = []
  const re = /(?:hình\s*thành\s*kiến\s*thức|định\s*nghĩa|định\s*l[íi]|công\s*thức|tính\s*chất|khái\s*niệm)[^\n]*/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(markdown))) {
    const start = match.index
    const rest = markdown.slice(start + match[0].length)
    const stop = rest.search(/\n(?:#{2,4}\s|\*\*(?:ví\s*dụ|bài\s*tập|luyện\s*tập|vận\s*dụng)|\*\*?\s*lời\s*giải|lời\s*giải)/i)
    const end = stop >= 0 ? start + match[0].length + stop : Math.min(markdown.length, start + 1200)
    const text = markdown.slice(start, end).trim()
    if (text.length < 40) continue
    if (EXAMPLE_LABEL_RE.test(text) && !KNOWLEDGE_LABEL_RE.test(text)) continue
    spans.push({ start, end })
  }
  return spans
}

function slideReviewText(slide: CurriculumReviewSlide): string {
  const parts = [String(slide.title || '').trim()]
  for (const block of slide.blocks ?? []) {
    const header = String(block.header || '').trim()
    const content = String(block.content || '').trim()
    if (header) parts.push(header)
    if (content) parts.push(content)
  }
  const content = String(slide.content || '').trim()
  if (content) parts.push(content)
  return parts.filter((part, index) => part && parts.indexOf(part) === index).join('\n\n').trim()
}

function isKnowledgeSlide(slide: CurriculumReviewSlide, text: string): boolean {
  const label = [slide.title, ...(slide.blocks ?? []).map((block) => block.header || '')].join('\n')
  if (KNOWLEDGE_LABEL_RE.test(label) || KNOWLEDGE_LABEL_RE.test(text.slice(0, 500))) return true
  if (EXAMPLE_LABEL_RE.test(label)) return false
  return /[=√]|sin\s*\(|cos\s*\(|tan\s*\(|vectơ|tọa\s*độ/i.test(text)
}

function alreadyCovered(text: string, covered: string[]): boolean {
  const flat = compactReviewText(text)
  if (flat.length < 24) return true
  const head = flat.slice(0, 48)
  return covered.some((item) => {
    const other = compactReviewText(item)
    if (other.length < 24) return false
    return other.includes(head) || flat.includes(other.slice(0, 48))
  })
}

/** Ví dụ có lời giải, cộng đoạn kiến thức và slide kiến thức sẽ chiếu. */
export function listLessonReviewItems(
  markdown: string,
  slides: CurriculumReviewSlide[] | null | undefined,
  options?: CurriculumMathCheckOptions
): CurriculumExerciseReview[] {
  if (!isCurriculumMathSubject(options?.subjectId)) return []
  const exercises = listCurriculumExerciseReviews(markdown, options)
  const covered = exercises.map((item) => item.text)
  const extra: CurriculumExerciseReview[] = []
  const clean = stripCurriculumMathMarks(markdown)
  for (const span of knowledgeSpans(clean)) {
    const text = clean.slice(span.start, span.end).trim()
    if (alreadyCovered(text, covered)) continue
    const verdict = judgeKnowledgeBlock(text, options)
    extra.push(verdict)
    covered.push(verdict.text)
  }
  for (const slide of slides ?? []) {
    const text = slideReviewText(slide)
    if (text.length < 40 || !isKnowledgeSlide(slide, text) || alreadyCovered(text, covered)) continue
    const verdict = judgeKnowledgeBlock(text, options)
    extra.push(verdict)
    covered.push(verdict.text)
  }
  return [...exercises, ...extra]
}

/** Mỗi slide sẽ chiếu: giáo viên phải xem một lượt. Toán sai thì chưa được qua. */
export function listPresentationSlideReviews(
  slides: CurriculumReviewSlide[] | null | undefined,
  options?: CurriculumMathCheckOptions
): CurriculumExerciseReview[] {
  const math = isCurriculumMathSubject(options?.subjectId)
  const items: CurriculumExerciseReview[] = []
  for (const [index, slide] of (slides ?? []).entries()) {
    const raw = slideReviewText(slide)
    const title = String(slide.title || '').trim() || `Slide ${index + 1}`
    const body = raw || title
    if (!math) {
      items.push({ text: body, status: 'pass', message: '' })
      continue
    }
    const verdict = EXAMPLE_LABEL_RE.test([slide.title, body.slice(0, 240)].join('\n'))
      ? judgeCurriculumExercise(body, options)
      : judgeKnowledgeBlock(body, options)
    items.push({ ...verdict, text: verdict.text || body })
  }
  return items
}

export const CURRICULUM_MATH_CHECK_RULES = `Sau mỗi lời giải ngắn của môn Toán, thêm đúng một dòng kiểm tra để code tính lại. Dòng đó không phải lời giảng. Mỗi ví dụ có tính phải có chữ "Lời giải".
Dạng: <!-- check {"kind":"expr","expr":"(2+3)*4","shown":20} -->
kind được dùng: expr, equation, deriv, integral, dot, add, scale, midpoint, centroid, length, distance, collinear, angle.
- expr: tính biểu thức. Lượng giác dùng {"kind":"expr","expr":"sin(30)","deg":true,"shown":0.5} hoặc sin(30°).
- equation: {"kind":"equation","expr":"x^2-5*x+6","var":"x","values":[2,3]}. Mỗi nghiệm thay vào phải cho 0.
- deriv: {"kind":"deriv","expr":"x^3","var":"x","shown":"3*x^2"}.
- integral: {"kind":"integral","expr":"2*x","var":"x","a":0,"b":2,"shown":4}.
- dot, length, distance: shown là số hoặc "sqrt(n)".
- add: {"kind":"add","vectors":[[1,0,0],[0,1,0]],"scalars":[2,3],"shown":[2,3,0]}.
- scale: {"kind":"scale","k":2,"v":[1,-2,3],"shown":[2,-4,6]}.
- midpoint: {"kind":"midpoint","p":[3,-2,4],"q":[-1,1,0],"shown":[1,-0.5,2]}.
- centroid: {"kind":"centroid","points":[[1,0,2],[3,-2,4],[-1,1,0]],"shown":[1,-0.333,2]}.
- collinear: shown là true hoặc false.
- angle: shown là "acute", "right" hoặc "obtuse". Kết luận vuông thì shown là "right". Kết luận góc tù thì shown là "obtuse".
Số trong dòng kiểm tra phải là đúng số đã viết trong bài. Không viết câu tự sửa đề. Không tự thêm <!-- curriculum-math-teacher-ok -->.`
