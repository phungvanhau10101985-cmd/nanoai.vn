/**
 * Máy tính biểu thức cho giáo trình toán.
 * Đọc biểu thức, tính giá trị, đạo hàm và tích phân xác định. Không gọi AI.
 */

export type MathExpr =
  | { op: 'n'; n: number }
  | { op: 'v'; name: string }
  | { op: 'neg'; a: MathExpr }
  | { op: '+'; a: MathExpr; b: MathExpr }
  | { op: '-'; a: MathExpr; b: MathExpr }
  | { op: '*'; a: MathExpr; b: MathExpr }
  | { op: '/'; a: MathExpr; b: MathExpr }
  | { op: '^'; a: MathExpr; b: MathExpr }
  | { op: 'call'; name: string; args: MathExpr[] }

type Tok =
  | { t: 'n'; n: number }
  | { t: 'id'; s: string }
  | { t: 'op'; s: '+' | '-' | '*' | '/' | '^' }
  | { t: '(' }
  | { t: ')' }
  | { t: ',' }

const CALLS = new Set(['sin', 'cos', 'tan', 'cot', 'sqrt', 'abs', 'ln', 'log', 'exp', 'asin', 'acos', 'atan'])

function preprocess(input: string): string {
  return String(input || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/−/g, '-')
    .replace(/π/g, 'pi')
    .replace(/√/g, 'sqrt')
    .replace(/×|·/g, '*')
    .replace(/÷/g, '/')
    .replace(/\[/g, '(')
    .replace(/\]/g, ')')
}

function tokenize(input: string): Tok[] | null {
  const s = preprocess(input)
  if (!s || s.length > 240) return null
  const out: Tok[] = []
  let i = 0
  while (i < s.length) {
    const ch = s[i]
    if (/[0-9.]/.test(ch)) {
      const start = i
      i += 1
      while (i < s.length && /[0-9.]/.test(s[i])) i += 1
      const raw = s.slice(start, i)
      if (!/^\d+(?:\.\d+)?$/.test(raw)) return null
      let n = Number(raw)
      if (s[i] === '°') {
        n = (n * Math.PI) / 180
        i += 1
      }
      out.push({ t: 'n', n })
      continue
    }
    if (/[A-Za-z]/.test(ch)) {
      const start = i
      i += 1
      while (i < s.length && /[A-Za-z]/.test(s[i])) i += 1
      out.push({ t: 'id', s: s.slice(start, i) })
      continue
    }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '^') {
      out.push({ t: 'op', s: ch })
      i += 1
      continue
    }
    if (ch === '(') {
      out.push({ t: '(' })
      i += 1
      continue
    }
    if (ch === ')') {
      out.push({ t: ')' })
      i += 1
      continue
    }
    if (ch === ',') {
      out.push({ t: ',' })
      i += 1
      continue
    }
    return null
  }
  return out
}

class Parser {
  private i = 0
  constructor(private toks: Tok[]) {}

  parse(): MathExpr | null {
    const expr = this.parseAdd()
    if (!expr || this.i !== this.toks.length) return null
    return expr
  }

  private peek(): Tok | undefined {
    return this.toks[this.i]
  }

  private parseAdd(): MathExpr | null {
    let left = this.parseMul()
    if (!left) return null
    while (
      this.peek()?.t === 'op' &&
      ((this.peek() as { s: string }).s === '+' || (this.peek() as { s: string }).s === '-')
    ) {
      const op = (this.toks[this.i] as { s: '+' | '-' }).s
      this.i += 1
      const right = this.parseMul()
      if (!right) return null
      left = { op, a: left, b: right }
    }
    return left
  }

  private parseMul(): MathExpr | null {
    let left = this.parsePow()
    if (!left) return null
    while (this.implicitOrMul()) {
      let op: '*' | '/' = '*'
      if (this.peek()?.t === 'op' && ((this.peek() as { s: string }).s === '*' || (this.peek() as { s: string }).s === '/')) {
        op = (this.toks[this.i] as { s: '*' | '/' }).s
        this.i += 1
      }
      const right = this.parsePow()
      if (!right) return null
      left = { op, a: left, b: right }
    }
    return left
  }

  private implicitOrMul(): boolean {
    const tok = this.peek()
    if (!tok) return false
    if (tok.t === 'op' && (tok.s === '*' || tok.s === '/')) return true
    return tok.t === 'n' || tok.t === 'id' || tok.t === '('
  }

  private parsePow(): MathExpr | null {
    const left = this.parseUnary()
    if (!left) return null
    if (this.peek()?.t === 'op' && (this.peek() as { s: string }).s === '^') {
      this.i += 1
      const right = this.parsePow()
      if (!right) return null
      return { op: '^', a: left, b: right }
    }
    return left
  }

  private parseUnary(): MathExpr | null {
    if (this.peek()?.t === 'op' && (this.peek() as { s: string }).s === '-') {
      this.i += 1
      const inner = this.parseUnary()
      if (!inner) return null
      return { op: 'neg', a: inner }
    }
    if (this.peek()?.t === 'op' && (this.peek() as { s: string }).s === '+') {
      this.i += 1
      return this.parseUnary()
    }
    return this.parsePrimary()
  }

  private parsePrimary(): MathExpr | null {
    const tok = this.peek()
    if (!tok) return null
    if (tok.t === 'n') {
      this.i += 1
      return { op: 'n', n: tok.n }
    }
    if (tok.t === 'id') {
      this.i += 1
      if (this.peek()?.t === '(') {
        this.i += 1
        const args: MathExpr[] = []
        if (this.peek()?.t !== ')') {
          const first = this.parseAdd()
          if (!first) return null
          args.push(first)
          while (this.peek()?.t === ',') {
            this.i += 1
            const next = this.parseAdd()
            if (!next) return null
            args.push(next)
          }
        }
        if (this.peek()?.t !== ')') return null
        this.i += 1
        return { op: 'call', name: tok.s.toLowerCase(), args }
      }
      return { op: 'v', name: tok.s }
    }
    if (tok.t === '(') {
      this.i += 1
      const inner = this.parseAdd()
      if (!inner || this.peek()?.t !== ')') return null
      this.i += 1
      return inner
    }
    return null
  }
}

export function parseMathExpr(input: string): MathExpr | null {
  const toks = tokenize(input)
  if (!toks || toks.length === 0) return null
  return new Parser(toks).parse()
}

function callValue(name: string, args: number[]): number | null {
  const x = args[0]
  if (x == null || !Number.isFinite(x)) return null
  if (name === 'sin') return Math.sin(x)
  if (name === 'cos') return Math.cos(x)
  if (name === 'tan') return Math.tan(x)
  if (name === 'cot') {
    const t = Math.tan(x)
    if (!Number.isFinite(t) || Math.abs(t) < 1e-12) return null
    return 1 / t
  }
  if (name === 'sqrt') return x < 0 ? null : Math.sqrt(x)
  if (name === 'abs') return Math.abs(x)
  if (name === 'ln' || name === 'log') return x > 0 ? Math.log(x) : null
  if (name === 'exp') return Math.exp(x)
  if (name === 'asin') return x < -1 || x > 1 ? null : Math.asin(x)
  if (name === 'acos') return x < -1 || x > 1 ? null : Math.acos(x)
  if (name === 'atan') return Math.atan(x)
  return null
}

export function evalMathExpr(expr: MathExpr, vars: Record<string, number>, deg = false): number | null {
  if (expr.op === 'n') return expr.n
  if (expr.op === 'v') {
    if (expr.name === 'pi' || expr.name === 'PI') return Math.PI
    if (expr.name === 'e' || expr.name === 'E') return Math.E
    const key = Object.keys(vars).find((name) => name.toLowerCase() === expr.name.toLowerCase())
    if (!key) return null
    const value = vars[key]
    return Number.isFinite(value) ? value : null
  }
  if (expr.op === 'neg') {
    const inner = evalMathExpr(expr.a, vars, deg)
    return inner == null ? null : -inner
  }
  if (expr.op === 'call') {
    if (!CALLS.has(expr.name) || expr.args.length !== 1) return null
    let arg = evalMathExpr(expr.args[0], vars, deg)
    if (arg == null) return null
    if (deg && (expr.name === 'sin' || expr.name === 'cos' || expr.name === 'tan' || expr.name === 'cot')) {
      arg = (arg * Math.PI) / 180
    }
    const value = callValue(expr.name, [arg])
    return value == null || !Number.isFinite(value) ? null : value
  }
  const left = evalMathExpr(expr.a, vars, deg)
  const right = evalMathExpr(expr.b, vars, deg)
  if (left == null || right == null) return null
  if (expr.op === '+') return left + right
  if (expr.op === '-') return left - right
  if (expr.op === '*') return left * right
  if (expr.op === '/') return right === 0 ? null : left / right
  if (expr.op === '^') {
    const value = Math.pow(left, right)
    return Number.isFinite(value) ? value : null
  }
  return null
}

function isConst(expr: MathExpr, variable: string): boolean {
  if (expr.op === 'n') return true
  if (expr.op === 'v') return expr.name.toLowerCase() !== variable.toLowerCase()
  if (expr.op === 'neg') return isConst(expr.a, variable)
  if (expr.op === 'call') return expr.args.every((arg) => isConst(arg, variable))
  return isConst(expr.a, variable) && isConst(expr.b, variable)
}

export function diffMathExpr(expr: MathExpr, variable: string): MathExpr | null {
  const v = variable.toLowerCase()
  if (expr.op === 'n') return { op: 'n', n: 0 }
  if (expr.op === 'v') {
    if (expr.name === 'pi' || expr.name === 'e' || expr.name === 'PI' || expr.name === 'E') return { op: 'n', n: 0 }
    return { op: 'n', n: expr.name.toLowerCase() === v ? 1 : 0 }
  }
  if (expr.op === 'neg') {
    const inner = diffMathExpr(expr.a, variable)
    return inner ? { op: 'neg', a: inner } : null
  }
  if (expr.op === '+' || expr.op === '-') {
    const da = diffMathExpr(expr.a, variable)
    const db = diffMathExpr(expr.b, variable)
    if (!da || !db) return null
    return { op: expr.op, a: da, b: db }
  }
  if (expr.op === '*') {
    const da = diffMathExpr(expr.a, variable)
    const db = diffMathExpr(expr.b, variable)
    if (!da || !db) return null
    return { op: '+', a: { op: '*', a: da, b: expr.b }, b: { op: '*', a: expr.a, b: db } }
  }
  if (expr.op === '/') {
    const da = diffMathExpr(expr.a, variable)
    const db = diffMathExpr(expr.b, variable)
    if (!da || !db) return null
    return {
      op: '/',
      a: { op: '-', a: { op: '*', a: da, b: expr.b }, b: { op: '*', a: expr.a, b: db } },
      b: { op: '^', a: expr.b, b: { op: 'n', n: 2 } },
    }
  }
  if (expr.op === '^' && isConst(expr.b, variable)) {
    const da = diffMathExpr(expr.a, variable)
    if (!da) return null
    return {
      op: '*',
      a: { op: '*', a: expr.b, b: { op: '^', a: expr.a, b: { op: '-', a: expr.b, b: { op: 'n', n: 1 } } } },
      b: da,
    }
  }
  if (expr.op === 'call') {
    if (expr.args.length !== 1) return null
    const arg = expr.args[0]
    const du = diffMathExpr(arg, variable)
    if (!du) return null
    const name = expr.name
    let factor: MathExpr | null = null
    if (name === 'sin') factor = { op: 'call', name: 'cos', args: [arg] }
    else if (name === 'cos') factor = { op: 'neg', a: { op: 'call', name: 'sin', args: [arg] } }
    else if (name === 'tan') {
      factor = { op: '/', a: { op: 'n', n: 1 }, b: { op: '^', a: { op: 'call', name: 'cos', args: [arg] }, b: { op: 'n', n: 2 } } }
    } else if (name === 'exp') factor = { op: 'call', name: 'exp', args: [arg] }
    else if (name === 'ln' || name === 'log') factor = { op: '/', a: { op: 'n', n: 1 }, b: arg }
    else if (name === 'sqrt') {
      factor = { op: '/', a: { op: 'n', n: 1 }, b: { op: '*', a: { op: 'n', n: 2 }, b: { op: 'call', name: 'sqrt', args: [arg] } } }
    }
    if (!factor) return null
    return { op: '*', a: factor, b: du }
  }
  return null
}

const SAMPLE_X = [-2, -1, -0.5, 0.5, 1, 1.5, 2, 3]

export function expressionsNear(left: MathExpr, right: MathExpr, variable: string, vars: Record<string, number>, deg = false): boolean {
  let compared = 0
  for (const x of SAMPLE_X) {
    const scope = { ...vars, [variable]: x }
    const a = evalMathExpr(left, scope, deg)
    const b = evalMathExpr(right, scope, deg)
    if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) continue
    const scale = Math.max(1, Math.abs(a), Math.abs(b))
    if (Math.abs(a - b) > 1e-4 * scale) return false
    compared += 1
  }
  return compared >= 3
}

export function integrateSimpson(
  expr: MathExpr,
  variable: string,
  a: number,
  b: number,
  vars: Record<string, number>,
  deg = false
): number | null {
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return a === b ? 0 : null
  const n = 256
  const h = (b - a) / n
  const at = (x: number) => evalMathExpr(expr, { ...vars, [variable]: x }, deg)
  const fa = at(a)
  const fb = at(b)
  if (fa == null || fb == null) return null
  let sum = fa + fb
  for (let i = 1; i < n; i++) {
    const y = at(a + i * h)
    if (y == null || !Number.isFinite(y)) return null
    sum += (i % 2 === 0 ? 2 : 4) * y
  }
  const value = (sum * h) / 3
  return Number.isFinite(value) ? value : null
}
