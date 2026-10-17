/**
 * Vẽ đồ thị từ công thức đã có trong đề. Chỉ khi đề cần hình trên hệ trục.
 * Không gọi API vẽ ảnh. Chuỗi đề lưu trong hội thoại không đổi.
 */

export type HomeworkPlotPoint = { x: number; y: number }

export type HomeworkPlotSeries = {
  label: string
  segments: HomeworkPlotPoint[][]
  circle: { h: number; k: number; r: number } | null
}

export type HomeworkPlot = {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
  xAxis: string
  yAxis: string
  /** Có đường tròn thì hai trục cùng tỉ lệ, để đường tròn không bị méo. */
  equalScale: boolean
  series: HomeworkPlotSeries[]
}

type Expr =
  | { kind: 'num'; value: number }
  | { kind: 'var' }
  | { kind: 'neg'; value: Expr }
  | { kind: 'bin'; op: '+' | '-' | '*' | '/' | '^'; left: Expr; right: Expr }
  | { kind: 'call'; name: 'sqrt' | 'abs' | 'sin' | 'cos' | 'tan' | 'ln' | 'log' | 'exp'; arg: Expr }

type Tok =
  | { kind: 'num'; value: number }
  | { kind: 'id'; name: string }
  | { kind: 'op'; op: string }
  | { kind: '(' }
  | { kind: ')' }

const FUNCS = new Set(['sqrt', 'abs', 'sin', 'cos', 'tan', 'ln', 'log', 'exp'])
const SUP: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
  '⁻': '-', '⁺': '+',
}

function wantsFigure(text: string): boolean {
  return /đồ\s*thị|parabol|parabola|hệ\s*trục|tiếp\s*tuyến|đường\s*tròn|giao\s*điểm|\bgraphs?\b|\bsketch\b|\btangents?\b|\bcircles?\b|\bintersection\b/i.test(
    text,
  )
}

function normalizeScan(input: string): string {
  const text = input.replace(/≥/g, '>=').replace(/≤/g, '<=')
  let out = ''
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i] ?? ''
    const sup = SUP[ch]
    if (sup) {
      let body = ''
      while (i < text.length && SUP[text[i] ?? '']) {
        body += SUP[text[i] ?? '']
        i += 1
      }
      i -= 1
      out += body.startsWith('-') || body.startsWith('+') ? `^(${body})` : `^${body}`
      continue
    }
    if (ch === '−' || ch === '–' || ch === '—') {
      out += '-'
      continue
    }
    if (ch === '×') {
      out += '*'
      continue
    }
    if (ch === '÷') {
      out += '/'
      continue
    }
    if (ch === 'π') {
      out += 'pi'
      continue
    }
    if (ch === '√') {
      let j = i + 1
      while (text[j] === ' ') j += 1
      if (text[j] === '(') {
        out += 'sqrt'
        continue
      }
      const simple = text.slice(j).match(/^[0-9.xXtT]+/)
      if (simple) {
        out += `sqrt(${simple[0]})`
        i = j + simple[0].length - 1
        continue
      }
      out += 'sqrt'
      continue
    }
    out += ch
  }
  return out.replace(/\[([^[\]]+)\]|(\d),(\d)/g, (full, inside: string | undefined, a?: string, b?: string) =>
    inside != null ? full : `${a}.${b}`,
  )
}

function formatNum(value: number): string {
  if (!Number.isFinite(value)) return ''
  if (Math.abs(value - Math.round(value)) < 1e-8) return String(Math.round(value))
  return String(Math.round(value * 1000) / 1000).replace('.', ',')
}

function printExpr(node: Expr, variable: string, parent = 0): string {
  if (node.kind === 'num') return formatNum(node.value)
  if (node.kind === 'var') return variable
  if (node.kind === 'neg') {
    const body = printExpr(node.value, variable, 3)
    const text = `-${body}`
    return parent > 3 ? `(${text})` : text
  }
  if (node.kind === 'call') {
    if (node.name === 'abs') return `|${printExpr(node.arg, variable, 0)}|`
    if (node.name === 'sqrt') return `√(${printExpr(node.arg, variable, 0)})`
    return `${node.name}(${printExpr(node.arg, variable, 0)})`
  }
  const prec = node.op === '+' || node.op === '-' ? 1 : node.op === '^' ? 4 : 2
  if (node.op === '^') {
    const exp =
      node.right.kind === 'num' || node.right.kind === 'var'
        ? printExpr(node.right, variable, 0)
        : `(${printExpr(node.right, variable, 0)})`
    const text = `${printExpr(node.left, variable, 4)}^${exp}`
    return prec < parent ? `(${text})` : text
  }
  if (node.op === '*') {
    const left = printExpr(node.left, variable, 2)
    const right = printExpr(node.right, variable, 2)
    const juxtapose =
      node.right.kind === 'var' ||
      node.right.kind === 'call' ||
      right.startsWith('(') ||
      right.startsWith('√')
    const text = juxtapose ? `${left}${right}` : `${left}·${right}`
    return prec < parent ? `(${text})` : text
  }
  const rightPrec = prec + (node.op === '-' || node.op === '/' ? 1 : 0)
  const text = `${printExpr(node.left, variable, prec)} ${node.op} ${printExpr(node.right, variable, rightPrec)}`
  return prec < parent ? `(${text})` : text
}

function evaluate(node: Expr, x: number): number {
  if (node.kind === 'num') return node.value
  if (node.kind === 'var') return x
  if (node.kind === 'neg') return -evaluate(node.value, x)
  if (node.kind === 'call') {
    const value = evaluate(node.arg, x)
    if (node.name === 'sqrt') return value < 0 ? Number.NaN : Math.sqrt(value)
    if (node.name === 'abs') return Math.abs(value)
    if (node.name === 'sin') return Math.sin(value)
    if (node.name === 'cos') return Math.cos(value)
    if (node.name === 'tan') {
      const hit = Math.cos(value)
      return Math.abs(hit) < 1e-6 ? Number.NaN : Math.tan(value)
    }
    if (node.name === 'ln') return value <= 0 ? Number.NaN : Math.log(value)
    if (node.name === 'log') return value <= 0 ? Number.NaN : Math.log(value) / Math.LN10
    return Math.exp(value)
  }
  const left = evaluate(node.left, x)
  const right = evaluate(node.right, x)
  if (node.op === '+') return left + right
  if (node.op === '-') return left - right
  if (node.op === '*') return left * right
  if (node.op === '/') return right === 0 ? Number.NaN : left / right
  if (left < 0 && !Number.isInteger(right)) return Number.NaN
  return left ** right
}

function sliceExpr(source: string, start: number, variable: string): { raw: string; end: number } | null {
  let i = start
  let depth = 0
  let bars = 0
  let last = start
  while (i < source.length) {
    const ch = source[i] ?? ''
    if (ch === ' ' || ch === '\t' || ch === '\n') {
      i += 1
      continue
    }
    if (ch === '(') {
      depth += 1
      i += 1
      last = i
      continue
    }
    if (ch === ')') {
      if (depth === 0) break
      depth -= 1
      i += 1
      last = i
      continue
    }
    if (ch === '|') {
      bars += 1
      i += 1
      last = i
      continue
    }
    if (ch === '.') {
      const prev = source[i - 1] ?? ''
      const next = source[i + 1] ?? ''
      if (prev >= '0' && prev <= '9' && next >= '0' && next <= '9') {
        i += 1
        last = i
        continue
      }
      break
    }
    if ('+-*/^'.includes(ch) || (ch >= '0' && ch <= '9')) {
      i += 1
      last = i
      continue
    }
    if (/[a-zA-Z]/.test(ch)) {
      const ident = (source.slice(i).match(/^[a-zA-Z]+/)?.[0] ?? '').toLowerCase()
      if (!FUNCS.has(ident) && ident !== 'pi' && ident !== 'e' && ident !== variable) break
      i += ident.length
      last = i
      continue
    }
    break
  }
  if (depth !== 0 || bars % 2 === 1) return null
  const raw = source.slice(start, last).trim()
  if (!raw || raw.length > 80) return null
  return { raw, end: last }
}

function replaceBars(input: string): string | null {
  let out = ''
  let open = false
  for (const ch of input) {
    if (ch !== '|') {
      out += ch
      continue
    }
    out += open ? ')' : 'abs('
    open = !open
  }
  return open ? null : out
}

function tokenize(source: string, variable: string): Tok[] | null {
  const toks: Tok[] = []
  let i = 0
  while (i < source.length) {
    const ch = source[i] ?? ''
    if (ch === ' ' || ch === '\t') {
      i += 1
      continue
    }
    if ((ch >= '0' && ch <= '9') || (ch === '.' && (source[i + 1] ?? '') >= '0' && (source[i + 1] ?? '') <= '9')) {
      const num = source.slice(i).match(/^\d+(?:\.\d+)?/)
      if (!num) return null
      toks.push({ kind: 'num', value: Number(num[0]) })
      i += num[0].length
      continue
    }
    if (/[a-zA-Z]/.test(ch)) {
      const ident = (source.slice(i).match(/^[a-zA-Z]+/)?.[0] ?? '').toLowerCase()
      if (!FUNCS.has(ident) && ident !== 'pi' && ident !== 'e' && ident !== variable) return null
      toks.push({ kind: 'id', name: ident === variable ? 'x' : ident })
      i += ident.length
      continue
    }
    if ('+-*/^'.includes(ch)) {
      toks.push({ kind: 'op', op: ch })
      i += 1
      continue
    }
    if (ch === '(') {
      toks.push({ kind: '(' })
      i += 1
      continue
    }
    if (ch === ')') {
      toks.push({ kind: ')' })
      i += 1
      continue
    }
    return null
  }
  return toks
}

function parseExpression(source: string, variable: string): Expr | null {
  const prepared = replaceBars(source)
  if (!prepared) return null
  const toks = tokenize(prepared, variable)
  if (!toks || toks.length === 0) return null
  let index = 0
  const peek = () => toks[index]

  function parseAdd(): Expr | null {
    let left = parseMul()
    if (!left) return null
    while (index < toks.length) {
      const tok = peek()
      if (tok?.kind !== 'op' || (tok.op !== '+' && tok.op !== '-')) break
      index += 1
      const right = parseMul()
      if (!right) return null
      left = { kind: 'bin', op: tok.op, left, right }
    }
    return left
  }

  function startsPrimary(tok: Tok | undefined): boolean {
    return Boolean(tok && (tok.kind === 'num' || tok.kind === 'id' || tok.kind === '('))
  }

  function parseMul(): Expr | null {
    let left = parseUnary()
    if (!left) return null
    while (index < toks.length) {
      const tok = peek()
      if (tok?.kind === 'op' && (tok.op === '*' || tok.op === '/')) {
        index += 1
        const right = parseUnary()
        if (!right) return null
        left = { kind: 'bin', op: tok.op, left, right }
        continue
      }
      if (startsPrimary(tok)) {
        const right = parseUnary()
        if (!right) return null
        left = { kind: 'bin', op: '*', left, right }
        continue
      }
      break
    }
    return left
  }

  function parseUnary(): Expr | null {
    if (peek()?.kind === 'op' && (peek() as { op: string }).op === '-') {
      index += 1
      const value = parsePow()
      return value ? { kind: 'neg', value } : null
    }
    if (peek()?.kind === 'op' && (peek() as { op: string }).op === '+') {
      index += 1
      return parsePow()
    }
    return parsePow()
  }

  function parsePow(): Expr | null {
    const left = parsePrimary()
    if (!left) return null
    if (peek()?.kind === 'op' && (peek() as { op: string }).op === '^') {
      index += 1
      const right = parseUnary()
      if (!right) return null
      return { kind: 'bin', op: '^', left, right }
    }
    return left
  }

  function parsePrimary(): Expr | null {
    const tok = peek()
    if (!tok) return null
    if (tok.kind === 'num') {
      index += 1
      return { kind: 'num', value: tok.value }
    }
    if (tok.kind === 'id') {
      index += 1
      if (tok.name === 'x') return { kind: 'var' }
      if (tok.name === 'pi') return { kind: 'num', value: Math.PI }
      if (tok.name === 'e') return { kind: 'num', value: Math.E }
      if (!FUNCS.has(tok.name) || peek()?.kind !== '(') return null
      index += 1
      const arg = parseAdd()
      if (!arg || peek()?.kind !== ')') return null
      index += 1
      return { kind: 'call', name: tok.name as 'sqrt' | 'abs' | 'sin' | 'cos' | 'tan' | 'ln' | 'log' | 'exp', arg }
    }
    if (tok.kind === '(') {
      index += 1
      const inner = parseAdd()
      if (!inner || peek()?.kind !== ')') return null
      index += 1
      return inner
    }
    return null
  }

  const expr = parseAdd()
  if (!expr || index !== toks.length) return null
  return expr
}

function readDomain(text: string): { min: number | null; max: number | null } {
  const boxed = text.match(/\[\s*(-?\d+(?:\.\d+)?)\s*[;,]\s*(-?\d+(?:\.\d+)?)\s*\]/)
  if (boxed) {
    const left = Number(boxed[1])
    const right = Number(boxed[2])
    if (Number.isFinite(left) && Number.isFinite(right) && left !== right) {
      return { min: Math.min(left, right), max: Math.max(left, right) }
    }
  }
  let min: number | null = null
  let max: number | null = null
  const re = /(?:^|[^a-z])[xt]\s*(>=|<=|>|<)\s*(-?\d+(?:\.\d+)?)/gi
  for (const match of text.matchAll(re)) {
    const value = Number(match[2])
    if (!Number.isFinite(value)) continue
    const op = match[1] ?? ''
    if (op === '>' || op === '>=') min = min == null ? value : Math.max(min, value)
    if (op === '<' || op === '<=') max = max == null ? value : Math.min(max, value)
  }
  const leftInf = text.match(/\(\s*-\s*(?:∞|inf)\s*[;,]\s*(-?\d+(?:\.\d+)?)\s*\)/i)
  if (leftInf) {
    const value = Number(leftInf[1])
    if (Number.isFinite(value)) max = max == null ? value : Math.min(max, value)
  }
  const rightInf = text.match(/\(\s*(-?\d+(?:\.\d+)?)\s*[;,]\s*\+?\s*(?:∞|inf)\s*\)/i)
  if (rightInf) {
    const value = Number(rightInf[1])
    if (Number.isFinite(value)) min = min == null ? value : Math.max(min, value)
  }
  if (min != null && max != null && min >= max) return { min: null, max: null }
  return { min, max }
}

function quadratic(node: Expr): { a: number; b: number; c: number } | null {
  const at = (x: number) => evaluate(node, x)
  const c = at(0)
  const f1 = at(1)
  const fm = at(-1)
  const f2 = at(2)
  if (![c, f1, fm, f2].every(Number.isFinite)) return null
  const a = (f1 + fm - 2 * c) / 2
  const b = f1 - c - a
  const predicted = 4 * a + 2 * b + c
  if (Math.abs(predicted - f2) > 1e-6 * (1 + Math.abs(f2))) return null
  return { a, b, c }
}

function preferredX(node: Expr, domain: { min: number | null; max: number | null }): { x0: number; x1: number } {
  if (domain.min != null && domain.max != null) return { x0: domain.min, x1: domain.max }
  const poly = quadratic(node)
  let x0 = -5
  let x1 = 5
  if (poly && Math.abs(poly.a) > 1e-8) {
    const vertex = -poly.b / (2 * poly.a)
    const marks = [vertex]
    const disc = poly.b * poly.b - 4 * poly.a * poly.c
    if (disc >= 0) {
      const root = Math.sqrt(disc)
      marks.push((-poly.b - root) / (2 * poly.a), (-poly.b + root) / (2 * poly.a))
    }
    x0 = Math.min(...marks) - 1.2
    x1 = Math.max(...marks) + 1.2
    if (x1 - x0 < 6) {
      const mid = (x0 + x1) / 2
      x0 = mid - 3
      x1 = mid + 3
    }
  }
  if (domain.min != null) x0 = domain.min
  if (domain.max != null) x1 = domain.max
  if (!(x1 > x0)) return { x0: -5, x1: 5 }
  return { x0, x1 }
}

function yExtent(values: number[]): { y0: number; y1: number } {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (sorted.length === 0) return { y0: -4, y1: 4 }
  const lo = sorted[Math.floor((sorted.length - 1) * 0.04)] ?? sorted[0] ?? 0
  const hi = sorted[Math.ceil((sorted.length - 1) * 0.96)] ?? sorted[sorted.length - 1] ?? 0
  let y0 = Math.min(lo, hi)
  let y1 = Math.max(lo, hi)
  if (y1 - y0 < 1) {
    const mid = (y0 + y1) / 2
    return { y0: mid - 2, y1: mid + 2 }
  }
  const pad = (y1 - y0) * 0.12
  return { y0: y0 - pad, y1: y1 + pad }
}

function sampleCurve(
  node: Expr,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  domain: { min: number | null; max: number | null },
): HomeworkPlotPoint[][] {
  const segments: HomeworkPlotPoint[][] = []
  let current: HomeworkPlotPoint[] = []
  const steps = 220
  const jump = (y1 - y0) * 0.55
  const flush = () => {
    if (current.length >= 2) segments.push(current)
    current = []
  }
  for (let step = 0; step <= steps; step += 1) {
    const x = x0 + ((x1 - x0) * step) / steps
    if ((domain.min != null && x < domain.min - 1e-9) || (domain.max != null && x > domain.max + 1e-9)) {
      flush()
      continue
    }
    const y = evaluate(node, x)
    const previous = current[current.length - 1]
    if (!Number.isFinite(y) || y < y0 - (y1 - y0) * 0.08 || y > y1 + (y1 - y0) * 0.08) {
      flush()
      continue
    }
    if (previous && Math.abs(y - previous.y) > jump) flush()
    current.push({ x, y })
  }
  flush()
  return segments
}

function circleLabel(h: number, k: number, r2: number): string {
  const part = (axis: string, center: number) => {
    if (Math.abs(center) < 1e-8) return `${axis}^2`
    const sign = center > 0 ? '-' : '+'
    return `(${axis}${sign}${formatNum(Math.abs(center))})^2`
  }
  return `${part('x', h)} + ${part('y', k)} = ${formatNum(r2)}`
}

function pushCircle(series: HomeworkPlotSeries[], h: number, k: number, r2: number) {
  if (!(r2 > 0) || r2 > 6400) return
  const r = Math.sqrt(r2)
  const label = circleLabel(h, k, r2)
  if (series.some((item) => item.label === label)) return
  series.push({ label, segments: [], circle: { h, k, r } })
}

function readCircles(text: string, series: HomeworkPlotSeries[]) {
  const shifted =
    /\(\s*x\s*(?:([+-])\s*(\d+(?:\.\d+)?))?\s*\)\s*\^\s*2\s*\+\s*\(\s*y\s*(?:([+-])\s*(\d+(?:\.\d+)?))?\s*\)\s*\^\s*2\s*=\s*(\d+(?:\.\d+)?)(\s*\^\s*2)?/gi
  for (const match of text.matchAll(shifted)) {
    const h = match[2] ? (match[1] === '+' ? -Number(match[2]) : Number(match[2])) : 0
    const k = match[4] ? (match[3] === '+' ? -Number(match[4]) : Number(match[4])) : 0
    const raw = Number(match[5])
    pushCircle(series, h, k, match[6] ? raw * raw : raw)
  }
  const simple = /(?:^|[^a-zA-Z(])x\s*\^\s*2\s*\+\s*y\s*\^\s*2\s*=\s*(\d+(?:\.\d+)?)(\s*\^\s*2)?/gi
  for (const match of text.matchAll(simple)) {
    const raw = Number(match[1])
    pushCircle(series, 0, 0, match[2] ? raw * raw : raw)
  }
}

function readFunctions(
  text: string,
  domain: { min: number | null; max: number | null },
  series: HomeworkPlotSeries[],
  variables: string[],
) {
  const heads = /(?:^|[^a-zA-Z])(?:([a-zA-Z])\s*\(\s*([a-zA-Z])\s*\)|(y))\s*=/gi
  for (const match of text.matchAll(heads)) {
    if (series.length >= 3) return
    const name = match[1]?.toLowerCase() ?? ''
    const variable = (match[2] || 'x').toLowerCase()
    if (name && variable !== 'x' && variable !== 't') continue
    const sliced = sliceExpr(text, (match.index ?? 0) + match[0].length, variable)
    if (!sliced) continue
    const expr = parseExpression(sliced.raw, variable)
    if (!expr) continue
    const printed = printExpr(expr, variable)
    const label = name ? `${name}(${variable}) = ${printed}` : `y = ${printed}`
    if (series.some((item) => item.label === label)) continue
    const probe = [0, 1, -1, 2, 0.5].some((x) => Number.isFinite(evaluate(expr, x)))
    if (!probe) continue
    series.push({ label, segments: [], circle: null })
    variables.push(variable)
    const window = preferredX(expr, domain)
    ;(series[series.length - 1] as HomeworkPlotSeries & { node?: Expr; window?: { x0: number; x1: number } }).node = expr
    ;(series[series.length - 1] as HomeworkPlotSeries & { window?: { x0: number; x1: number } }).window = window
  }
}

export function homeworkPlotFromStatement(statement: string): HomeworkPlot | null {
  const source = statement.replace(/\s+/g, ' ').trim()
  if (!source || !wantsFigure(source)) return null
  const text = normalizeScan(source)
  const domain = readDomain(text)
  const draft: Array<HomeworkPlotSeries & { node?: Expr; window?: { x0: number; x1: number } }> = []
  const variables: string[] = []
  readFunctions(text, domain, draft, variables)
  if (draft.length < 3) readCircles(text, draft)
  const curves = draft.slice(0, 3)
  if (curves.length === 0) return null

  let x0 = Number.POSITIVE_INFINITY
  let x1 = Number.NEGATIVE_INFINITY
  for (const curve of curves) {
    if (curve.circle) {
      x0 = Math.min(x0, curve.circle.h - curve.circle.r)
      x1 = Math.max(x1, curve.circle.h + curve.circle.r)
      continue
    }
    if (curve.window) {
      x0 = Math.min(x0, curve.window.x0)
      x1 = Math.max(x1, curve.window.x1)
    }
  }
  if (!(x1 > x0)) return null
  const functionWindows = curves.flatMap((curve) => (curve.window && !curve.circle ? [curve.window] : []))
  if (!curves.some((curve) => curve.circle) && functionWindows.length > 1) {
    const overlapMin = Math.max(...functionWindows.map((item) => item.x0))
    const overlapMax = Math.min(...functionWindows.map((item) => item.x1))
    if (overlapMax - overlapMin >= 4) {
      x0 = overlapMin
      x1 = overlapMax
    }
  }
  if (domain.min != null && domain.max != null) {
    x0 = domain.min
    x1 = domain.max
  }
  if (x1 - x0 > 40) {
    const mid = (x0 + x1) / 2
    x0 = mid - 10
    x1 = mid + 10
  }

  const ySamples: number[] = []
  for (const curve of curves) {
    if (curve.circle) {
      ySamples.push(curve.circle.k - curve.circle.r, curve.circle.k + curve.circle.r)
      continue
    }
    if (!curve.node) continue
    for (let step = 0; step <= 80; step += 1) {
      const x = x0 + ((x1 - x0) * step) / 80
      if ((domain.min != null && x < domain.min) || (domain.max != null && x > domain.max)) continue
      const y = evaluate(curve.node, x)
      if (Number.isFinite(y)) ySamples.push(y)
    }
  }
  const extent = yExtent(ySamples)
  let y0 = extent.y0
  let y1 = extent.y1
  const xPad = (x1 - x0) * 0.06
  const yPad = (y1 - y0) * 0.08
  x0 -= xPad
  x1 += xPad
  y0 -= yPad
  y1 += yPad
  const equalScale = curves.some((curve) => curve.circle)
  if (equalScale) {
    const span = Math.max(x1 - x0, y1 - y0)
    const xMid = (x0 + x1) / 2
    const yMid = (y0 + y1) / 2
    x0 = xMid - span / 2
    x1 = xMid + span / 2
    y0 = yMid - span / 2
    y1 = yMid + span / 2
  }
  const view = { x0, x1, y0, y1 }

  const series: HomeworkPlotSeries[] = []
  for (const curve of curves) {
    if (curve.circle) {
      series.push({ label: curve.label, segments: [], circle: curve.circle })
      continue
    }
    if (!curve.node) continue
    const segments = sampleCurve(curve.node, view.x0, view.x1, view.y0, view.y1, domain)
    if (segments.length === 0) continue
    series.push({ label: curve.label, segments, circle: null })
  }
  if (series.length === 0) return null
  const axis = variables.length > 0 && variables.every((item) => item === 't') ? 't' : 'x'
  return {
    xMin: view.x0,
    xMax: view.x1,
    yMin: view.y0,
    yMax: view.y1,
    xAxis: axis,
    yAxis: 'y',
    equalScale,
    series,
  }
}
