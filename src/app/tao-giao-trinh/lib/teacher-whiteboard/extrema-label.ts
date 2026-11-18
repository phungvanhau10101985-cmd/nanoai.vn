import { evalMathExpr, type MathExpr } from '../curriculum-math-expr'
import type { ParsedPlot } from './plot'

type R = { n: number; d: number }

export type ExtremumPart =
  | { t: 'text'; s: string }
  | { t: 'frac'; num: string; den: string }

export type LabeledExtremum = {
  x: number
  y: number
  kind: 'min' | 'max'
  parts: ExtremumPart[]
}

const SUB = '₀₁₂₃₄₅₆₇₈₉'

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.trunc(a))
  let y = Math.abs(Math.trunc(b))
  while (y) {
    const t = x % y
    x = y
    y = t
  }
  return x || 1
}

function lcm(a: number, b: number): number {
  return Math.abs(a * b) / gcd(a, b)
}

function rat(n: number, d = 1): R {
  if (d < 0) {
    n = -n
    d = -d
  }
  const g = gcd(n, d)
  return { n: n / g, d: d / g }
}

function rAdd(a: R, b: R, sign = 1): R {
  return rat(a.n * b.d + sign * b.n * a.d, a.d * b.d)
}

function rMul(a: R, b: R): R {
  return rat(a.n * b.n, a.d * b.d)
}

function approxRational(value: number, maxDen = 48): R | null {
  if (!Number.isFinite(value)) return null
  const sign = value < 0 ? -1 : 1
  const v = Math.abs(value)
  if (Math.abs(v - Math.round(v)) < 1e-9) return rat(sign * Math.round(v), 1)
  let a = Math.floor(v)
  let h0 = 1
  let h1 = a
  let k0 = 0
  let k1 = 1
  let f = v
  for (let i = 0; i < 14; i += 1) {
    const frac = f - a
    if (frac < 1e-10) break
    f = 1 / frac
    a = Math.floor(f + 1e-10)
    const h2 = a * h1 + h0
    const k2 = a * k1 + k0
    if (k2 > maxDen) break
    h0 = h1
    h1 = h2
    k0 = k1
    k1 = k2
    if (Math.abs(v - h1 / k1) < 1e-9) return rat(sign * h1, k1)
  }
  if (k1 > 0 && k1 <= maxDen && Math.abs(v - h1 / k1) < 1e-8) return rat(sign * h1, k1)
  return null
}

function numToR(n: number): R | null {
  if (!Number.isFinite(n)) return null
  if (Math.abs(n - Math.round(n)) < 1e-9) return rat(Math.round(n), 1)
  return approxRational(n)
}

function trimPoly(poly: R[]): R[] {
  const out = poly.slice()
  while (out.length > 1 && out[out.length - 1].n === 0) out.pop()
  return out
}

function polyAdd(a: R[], b: R[], sign = 1): R[] {
  const n = Math.max(a.length, b.length)
  const out: R[] = []
  for (let i = 0; i < n; i += 1) out.push(rAdd(a[i] ?? rat(0), b[i] ?? rat(0), sign))
  return trimPoly(out)
}

function polyMul(a: R[], b: R[]): R[] {
  if (a.length === 0 || b.length === 0) return [rat(0)]
  const out = Array.from({ length: a.length + b.length - 1 }, () => rat(0))
  for (let i = 0; i < a.length; i += 1) {
    for (let j = 0; j < b.length; j += 1) out[i + j] = rAdd(out[i + j], rMul(a[i], b[j]))
  }
  return trimPoly(out)
}

function polyPow(base: R[], exp: number): R[] | null {
  if (!Number.isInteger(exp) || exp < 0 || exp > 6) return null
  let out: R[] = [rat(1)]
  for (let i = 0; i < exp; i += 1) out = polyMul(out, base)
  return out
}

function polyDiff(poly: R[]): R[] {
  const out: R[] = []
  for (let i = 1; i < poly.length; i += 1) out.push(rMul(poly[i], rat(i)))
  return trimPoly(out.length ? out : [rat(0)])
}

function exprToPoly(expr: MathExpr, variable: string): R[] | null {
  const v = variable.toLowerCase()
  if (expr.op === 'n') return numToR(expr.n) ? [numToR(expr.n)!] : null
  if (expr.op === 'v') {
    const name = expr.name.toLowerCase()
    if (name === v) return [rat(0), rat(1)]
    return null
  }
  if (expr.op === 'neg') {
    const inner = exprToPoly(expr.a, variable)
    return inner ? polyMul(inner, [rat(-1)]) : null
  }
  if (expr.op === '+' || expr.op === '-') {
    const a = exprToPoly(expr.a, variable)
    const b = exprToPoly(expr.b, variable)
    if (!a || !b) return null
    return polyAdd(a, b, expr.op === '+' ? 1 : -1)
  }
  if (expr.op === '*') {
    const a = exprToPoly(expr.a, variable)
    const b = exprToPoly(expr.b, variable)
    if (!a || !b) return null
    return polyMul(a, b)
  }
  if (expr.op === '/') {
    const b = exprToPoly(expr.b, variable)
    const a = exprToPoly(expr.a, variable)
    if (!a || !b || b.length !== 1 || b[0].n === 0) return null
    return polyMul(a, [rat(b[0].d, b[0].n)])
  }
  if (expr.op === '^') {
    const base = exprToPoly(expr.a, variable)
    if (!base || expr.b.op !== 'n') return null
    return polyPow(base, expr.b.n)
  }
  return null
}

function toIntPoly(poly: R[]): number[] | null {
  let den = 1
  for (const c of poly) {
    den = lcm(den, c.d)
    if (den > 1e6) return null
  }
  const out = poly.map((c) => (den / c.d) * c.n)
  if (out.some((v) => !Number.isInteger(v) || Math.abs(v) > 1e9)) return null
  while (out.length > 1 && out[out.length - 1] === 0) out.pop()
  return out
}

function splitSquare(n: number): { sq: number; rest: number } {
  let rest = Math.abs(Math.trunc(n))
  let sq = 1
  for (let p = 2; p * p <= rest; ) {
    const pp = p * p
    if (rest % pp === 0) {
      rest /= pp
      sq *= p
    } else p += p === 2 ? 1 : 2
  }
  return { sq, rest }
}

function subIndex(n: number): string {
  return String(n).replace(/[0-9]/g, (d) => SUB[Number(d)] ?? d)
}

function formatApprox(n: number): string {
  const t = Math.round(n * 1000) / 1000
  if (Math.abs(t - Math.round(t)) < 1e-9) return String(Math.round(t))
  return String(t)
}

function kindText(kind: 'min' | 'max', lang: string): string {
  const l = lang.toLowerCase()
  if (l.startsWith('en')) return kind === 'min' ? 'local minimum' : 'local maximum'
  if (l.startsWith('zh')) return kind === 'min' ? '极小值' : '极大值'
  if (l.startsWith('ja')) return kind === 'min' ? '極小' : '極大'
  if (l.startsWith('ko')) return kind === 'min' ? '극소' : '극대'
  return kind === 'min' ? 'điểm cực tiểu' : 'điểm cực đại'
}

function ratParts(n: number, d: number): ExtremumPart[] {
  const g = gcd(n, d)
  let nn = n / g
  let dd = d / g
  if (dd < 0) {
    nn = -nn
    dd = -dd
  }
  if (dd === 1) return [{ t: 'text', s: String(nn) }]
  const neg = nn < 0
  return [{ t: 'frac', num: `${neg ? '−' : ''}${Math.abs(nn)}`, den: String(dd) }]
}

function radicalParts(numConst: number, numRad: number, rest: number, den: number, sign: 1 | -1): ExtremumPart[] {
  if (den < 0) return radicalParts(-numConst, -numRad, rest, -den, sign)
  const g = gcd(gcd(numConst, numRad), den)
  const c = numConst / g
  const s = numRad / g
  const d = den / g
  if (rest === 1 || s === 0) return ratParts(c + sign * s * (rest === 1 ? 1 : 0), d)
  const rad = rest === 1 ? '' : `√${rest}`
  const coef = Math.abs(s) === 1 ? '' : String(Math.abs(s))
  const radBody = `${s < 0 ? '−' : ''}${coef}${rad}`
  let body: string
  if (c === 0) body = sign === 1 ? radBody : radBody.startsWith('−') ? radBody.slice(1) : `−${radBody}`
  else {
    const left = c < 0 ? `−${Math.abs(c)}` : String(c)
    const op = sign === 1 ? (s < 0 ? ' − ' : ' + ') : s < 0 ? ' + ' : ' − '
    const right = `${coef}${rad}`
    body = `${left}${op}${right}`
  }
  if (d === 1) return [{ t: 'text', s: c === 0 ? body : `(${body})` }]
  return [{ t: 'frac', num: body, den: String(d) }]
}

function exactValue(numConst: number, numRad: number, rest: number, den: number, sign: 1 | -1): number {
  return (numConst + sign * numRad * Math.sqrt(rest)) / den
}

type Alg = { c: number; rad: number; rest: number; den: number }

function simplifyAlg(a: Alg): Alg {
  let c = a.c
  let rad = a.rad
  let den = a.den
  if (den < 0) {
    c = -c
    rad = -rad
    den = -den
  }
  const g = gcd(gcd(c, rad), den)
  return { c: c / g, rad: rad / g, rest: a.rest, den: den / g }
}

function algParts(a: Alg): ExtremumPart[] {
  const v = simplifyAlg(a)
  if (v.rad === 0 || v.rest === 0) return ratParts(v.c, v.den)
  if (v.rest === 1) return ratParts(v.c + v.rad, v.den)
  const sign: 1 | -1 = v.rad < 0 ? -1 : 1
  return radicalParts(v.c, Math.abs(v.rad), v.rest, v.den, sign)
}

function mulAlg(p: Alg, q: Alg): Alg {
  return simplifyAlg({
    c: p.c * q.c + p.rad * q.rad * p.rest,
    rad: p.c * q.rad + p.rad * q.c,
    rest: p.rest,
    den: p.den * q.den,
  })
}

function addAlg(p: Alg, q: Alg): Alg {
  return simplifyAlg({
    c: p.c * q.den + q.c * p.den,
    rad: p.rad * q.den + q.rad * p.den,
    rest: p.rest,
    den: p.den * q.den,
  })
}

function scaleAlg(k: number, p: Alg): Alg {
  return simplifyAlg({ c: p.c * k, rad: p.rad * k, rest: p.rest, den: p.den })
}

function evalPolyAlg(coeffs: number[], x: Alg): Alg | null {
  let acc: Alg = { c: 0, rad: 0, rest: x.rest, den: 1 }
  let pow: Alg = { c: 1, rad: 0, rest: x.rest, den: 1 }
  for (let i = 0; i < coeffs.length; i += 1) {
    if (i > 0) pow = mulAlg(pow, x)
    if (coeffs[i] !== 0) acc = addAlg(acc, scaleAlg(coeffs[i], pow))
    if (![acc.c, acc.rad, acc.den, pow.c, pow.rad, pow.den].every((n) => Number.isSafeInteger(n))) return null
  }
  return acc
}

function solveDerivative(deriv: number[], from: number, to: number): Array<{ x: number; parts: ExtremumPart[]; exact: boolean; alg: Alg }> {
  while (deriv.length > 1 && deriv[deriv.length - 1] === 0) deriv.pop()
  const deg = deriv.length - 1
  if (deg <= 0) return []
  if (deg === 1) {
    const b = deriv[1]
    const c = deriv[0]
    if (b === 0) return []
    const x = -c / b
    if (x < from - 1e-6 || x > to + 1e-6) return []
    const alg = simplifyAlg({ c: -c, rad: 0, rest: 0, den: b })
    return [{ x, parts: algParts(alg), exact: true, alg }]
  }
  if (deg !== 2) return []
  const a = deriv[2]
  const b = deriv[1]
  const c = deriv[0]
  const disc = b * b - 4 * a * c
  if (disc < 0) return []
  const { sq, rest } = splitSquare(disc)
  const out: Array<{ x: number; parts: ExtremumPart[]; exact: boolean; alg: Alg }> = []
  const signs: Array<1 | -1> = disc === 0 ? [1] : [-1, 1]
  for (const sign of signs) {
    const x = exactValue(-b, sq, rest, 2 * a, sign)
    if (x < from - 1e-6 || x > to + 1e-6) continue
    const alg = simplifyAlg({ c: -b, rad: sign * sq, rest, den: 2 * a })
    out.push({ x, parts: algParts(alg), exact: true, alg })
  }
  out.sort((p, q) => p.x - q.x)
  return out
}

function evalAt(expr: MathExpr, variable: string, x: number): number | null {
  const v = evalMathExpr(expr, { [variable]: x, pi: Math.PI, e: Math.E })
  return v == null || !Number.isFinite(v) ? null : v
}

function numericRoots(expr: MathExpr, variable: string, from: number, to: number): number[] {
  const deriv = (x: number) => {
    const h = 1e-4
    const a = evalAt(expr, variable, x - h)
    const b = evalAt(expr, variable, x + h)
    if (a == null || b == null) return null
    return (b - a) / (2 * h)
  }
  const steps = 240
  const roots: number[] = []
  let prevX = from
  let prev = deriv(from)
  for (let i = 1; i <= steps; i += 1) {
    const x = from + ((to - from) * i) / steps
    const cur = deriv(x)
    if (prev != null && cur != null && prev === 0) roots.push(prevX)
    else if (prev != null && cur != null && prev * cur < 0) {
      let lo = prevX
      let hi = x
      let flo = prev
      for (let k = 0; k < 40; k += 1) {
        const mid = (lo + hi) / 2
        const fm = deriv(mid)
        if (fm == null || Math.abs(fm) < 1e-8) {
          lo = hi = mid
          break
        }
        if (flo * fm <= 0) hi = mid
        else {
          lo = mid
          flo = fm
        }
      }
      roots.push((lo + hi) / 2)
    }
    prevX = x
    prev = cur
  }
  return roots
}

export function extremumKindText(kind: 'min' | 'max', lang = 'vi'): string {
  return kindText(kind, lang)
}

export function labelPlotExtrema(parsed: ParsedPlot, from: number, to: number, lang = 'vi'): LabeledExtremum[] {
  const variable = parsed.axis === 'y' ? 'x' : 'y'
  const lo = Math.min(from, to)
  const hi = Math.max(from, to)
  const poly = exprToPoly(parsed.expr, variable)
  const intPoly = poly ? toIntPoly(poly) : null
  const deriv = poly ? toIntPoly(polyDiff(poly)) : null
  const exact = deriv ? solveDerivative(deriv, lo, hi) : []
  const raw = exact.length > 0
    ? exact
    : numericRoots(parsed.expr, variable, lo, hi).map((x) => ({ x, parts: [] as ExtremumPart[], exact: false, alg: null as Alg | null }))
  const xs = raw.filter((root, index) => raw.findIndex((other) => Math.abs(other.x - root.x) < 0.05) === index)
  const out: LabeledExtremum[] = []
  for (const root of xs) {
    const yVal = parsed.axis === 'y' ? evalAt(parsed.expr, variable, root.x) : root.x
    const xVal = parsed.axis === 'y' ? root.x : evalAt(parsed.expr, variable, root.x)
    if (xVal == null || yVal == null) continue
    const h = 0.05
    const left = evalAt(parsed.expr, variable, root.x - h)
    const mid = evalAt(parsed.expr, variable, root.x)
    const right = evalAt(parsed.expr, variable, root.x + h)
    if (left == null || mid == null || right == null) continue
    const curve = left + right - 2 * mid
    const scale = Math.max(1, Math.abs(left), Math.abs(mid), Math.abs(right))
    const kind: 'min' | 'max' | null = curve > 1e-4 * scale ? 'min' : curve < -1e-4 * scale ? 'max' : null
    if (!kind) continue
    const idx = subIndex(out.length + 1)
    const yAlg = root.exact && root.alg && intPoly ? evalPolyAlg(intPoly, root.alg) : null
    const yExactParts = yAlg ? algParts(yAlg) : null
    const xParts: ExtremumPart[] = root.exact && root.parts.length > 0 ? root.parts : [{ t: 'text', s: formatApprox(root.x) }]
    const yParts: ExtremumPart[] = yExactParts && yExactParts.length > 0 ? yExactParts : [{ t: 'text', s: formatApprox(parsed.axis === 'y' ? yVal : root.x) }]
    const abscissa = parsed.axis === 'y' ? xParts : yParts
    const ordinate = parsed.axis === 'y' ? yParts : xParts
    const parts: ExtremumPart[] = [
      { t: 'text', s: `(x${idx}; y${idx}) = (` },
      ...abscissa,
      { t: 'text', s: '; ' },
      ...ordinate,
      { t: 'text', s: `) (${kindText(kind, lang)})` },
    ]
    out.push({
      x: parsed.axis === 'y' ? root.x : xVal,
      y: parsed.axis === 'y' ? yVal : root.x,
      kind,
      parts,
    })
  }
  return out
}

export function flattenExtremumParts(parts: ExtremumPart[]): string {
  return parts.map((p) => (p.t === 'text' ? p.s : `(${p.num})/(${p.den})`)).join('')
}

export type LabeledIntersection = {
  x: number
  y: number
  parts: ExtremumPart[]
}

function rNeg(a: R): R {
  return rat(-a.n, a.d)
}

function rSub(a: R, b: R): R {
  return rAdd(a, b, -1)
}

function rDiv(a: R, b: R): R {
  return rat(a.n * b.d, a.d * b.n)
}

function rPow(a: R, k: number): R {
  let out = rat(1)
  for (let i = 0; i < k; i += 1) out = rMul(out, a)
  return out
}

function rNum(a: R): number {
  return a.n / a.d
}

function intersectionText(lang: string): string {
  const l = lang.toLowerCase()
  if (l.startsWith('en')) return 'intersection'
  if (l.startsWith('zh')) return '交点'
  if (l.startsWith('ja')) return '交点'
  if (l.startsWith('ko')) return '교점'
  return 'giao điểm'
}

function coordinateParts(index: number, xParts: ExtremumPart[], yParts: ExtremumPart[], lang: string): ExtremumPart[] {
  const sub = subIndex(index)
  return [
    { t: 'text', s: `(x${sub}; y${sub}) = (` },
    ...xParts,
    { t: 'text', s: '; ' },
    ...yParts,
    { t: 'text', s: `) (${intersectionText(lang)})` },
  ]
}

type Trip = { a: R; b: R; c: R }
type SymRoot = { h: R; p: R; q: R; sParts: ExtremumPart[] }

function mulS(t: Trip, p: R, q: R): Trip {
  return {
    a: rMul(t.c, rNeg(q)),
    b: rSub(t.a, rMul(t.c, p)),
    c: t.b,
  }
}

function addTrip(u: Trip, v: Trip): Trip {
  return { a: rAdd(u.a, v.a), b: rAdd(u.b, v.b), c: rAdd(u.c, v.c) }
}

function scaleTrip(k: R, t: Trip): Trip {
  return { a: rMul(k, t.a), b: rMul(k, t.b), c: rMul(k, t.c) }
}

function mulShift(t: Trip, h: R, p: R, q: R): Trip {
  return addTrip(mulS(t, p, q), scaleTrip(h, t))
}

function reducePoly(coeffs: number[], h: R, p: R, q: R): Trip {
  let acc: Trip = { a: rat(0), b: rat(0), c: rat(0) }
  for (let i = coeffs.length - 1; i >= 0; i -= 1) {
    acc = mulShift(acc, h, p, q)
    acc = addTrip(acc, { a: rat(coeffs[i]), b: rat(0), c: rat(0) })
  }
  return acc
}

function formatTrip(t: Trip, sParts: ExtremumPart[]): ExtremumPart[] {
  if (t.b.n === 0 && t.c.n === 0) return ratParts(t.a.n, t.a.d)
  const parts: ExtremumPart[] = []
  const pushTerm = (coef: R, body: ExtremumPart[]) => {
    if (coef.n === 0) return
    const neg = coef.n < 0
    if (parts.length > 0) parts.push({ t: 'text', s: neg ? ' − ' : ' + ' })
    else if (neg) parts.push({ t: 'text', s: '−' })
    const abs = rat(Math.abs(coef.n), coef.d)
    if (!(abs.n === 1 && abs.d === 1)) {
      parts.push(...ratParts(abs.n, abs.d))
      parts.push({ t: 'text', s: '·' })
    }
    parts.push(...body)
  }
  if (t.a.n !== 0) parts.push(...ratParts(t.a.n, t.a.d))
  pushTerm(t.b, sParts)
  pushTerm(t.c, [{ t: 'text', s: '(' }, ...sParts, { t: 'text', s: ')²' }])
  return parts
}

function sqrtRatParts(value: R): ExtremumPart[] | null {
  if (value.n < 0 || value.d === 0) return null
  const folded = value.n * value.d
  const { sq, rest } = splitSquare(folded)
  const coef = rat(sq, value.d)
  if (rest === 1) return ratParts(coef.n, coef.d)
  const parts: ExtremumPart[] = []
  if (!(coef.n === 1 && coef.d === 1)) {
    parts.push(...ratParts(Math.abs(coef.n), coef.d))
    if (coef.n < 0) parts.unshift({ t: 'text', s: '−' })
  } else if (coef.n < 0) parts.push({ t: 'text', s: '−' })
  parts.push({ t: 'text', s: rest === 0 ? '0' : `√${rest}` })
  return parts
}

function cubicSymbolic(coeffs: number[]): Array<{ x: number; parts: ExtremumPart[]; sym: SymRoot }> | null {
  if (coeffs.length !== 4 || coeffs[3] === 0) return null
  const A = rat(coeffs[3])
  const B = rat(coeffs[2])
  const C = rat(coeffs[1])
  const D = rat(coeffs[0])
  const a = rDiv(B, A)
  const b = rDiv(C, A)
  const c = rDiv(D, A)
  const p = rDiv(rSub(rMul(rat(3), b), rPow(a, 2)), rat(3))
  const q = rDiv(rAdd(rSub(rMul(rat(2), rPow(a, 3)), rMul(rat(9), rMul(a, b))), rMul(rat(27), c)), rat(27))
  const h = rNeg(rDiv(a, rat(3)))
  const disc = rAdd(rPow(rDiv(q, rat(2)), 2), rPow(rDiv(p, rat(3)), 3))
  const out: Array<{ x: number; parts: ExtremumPart[]; sym: SymRoot }> = []
  if (disc.n < 0) {
    const amp = rNeg(rDiv(p, rat(3)))
    const ampParts = sqrtRatParts(amp)
    if (!ampParts) return null
    const ampNum = Math.sqrt(Math.max(0, rNum(amp)))
    const argNum = Math.max(-1, Math.min(1, rNum(rNeg(rDiv(q, rat(2)))) / (rNum(amp) * ampNum || 1)))
    const base = Math.acos(argNum)
    for (let k = 0; k < 3; k += 1) {
      const angle = base / 3 - (2 * Math.PI * k) / 3
      const ratio = angle / Math.PI
      const frac = approxRational(ratio, 36)
      const sNum = 2 * ampNum * Math.cos(angle)
      const x = sNum + rNum(h)
      let sParts: ExtremumPart[]
      if (frac && Math.abs(ratio - frac.n / frac.d) < 1e-8) {
        sParts = [
          { t: 'text', s: '2·' },
          ...ampParts,
          { t: 'text', s: ' cos(' },
          ...ratParts(frac.n, frac.d),
          { t: 'text', s: 'π)' },
        ]
      } else {
        sParts = [
          { t: 'text', s: '2·' },
          ...ampParts,
          { t: 'text', s: ' cos(φ' },
          { t: 'text', s: `${subIndex(k + 1)})` },
        ]
      }
      const parts = rNum(h) === 0
        ? sParts
        : [...sParts, { t: 'text', s: rNum(h) < 0 ? ' − ' : ' + ' }, ...ratParts(Math.abs(h.n), h.d)]
      out.push({ x, parts, sym: { h, p, q, sParts } })
    }
    return out
  }
  const rootDisc = sqrtRatParts(disc)
  if (!rootDisc) return null
  const half = rNeg(rDiv(q, rat(2)))
  const discNum = Math.sqrt(Math.max(0, rNum(disc)))
  const u = Math.cbrt(rNum(half) + discNum)
  const v = Math.cbrt(rNum(half) - discNum)
  const sParts: ExtremumPart[] = [
    { t: 'text', s: '∛(' },
    ...ratParts(half.n, half.d),
    { t: 'text', s: ' + ' },
    ...rootDisc,
    { t: 'text', s: ') + ∛(' },
    ...ratParts(half.n, half.d),
    { t: 'text', s: ' − ' },
    ...rootDisc,
    { t: 'text', s: ')' },
  ]
  const x = u + v + rNum(h)
  const parts = rNum(h) === 0
    ? sParts
    : [...sParts, { t: 'text', s: rNum(h) < 0 ? ' − ' : ' + ' }, ...ratParts(Math.abs(h.n), h.d)]
  return [{ x, parts, sym: { h, p, q, sParts } }]
}

function divisors(n: number): number[] {
  const v = Math.abs(Math.trunc(n))
  const out = [1]
  if (v <= 1) return out
  for (let i = 2; i * i <= v; i += 1) {
    if (v % i === 0) {
      out.push(i)
      if (i * i !== v) out.push(v / i)
    }
  }
  out.push(v)
  return out
}

function polyValueAtRational(coeffs: number[], p: number, q: number): number | null {
  const n = coeffs.length - 1
  let sum = 0
  for (let k = 0; k < coeffs.length; k += 1) {
    const term = coeffs[k] * p ** k * q ** (n - k)
    if (!Number.isSafeInteger(term)) return null
    sum += term
    if (!Number.isSafeInteger(sum)) return null
  }
  return sum
}

function deflateByRational(coeffs: number[], p: number, q: number): number[] | null {
  const n = coeffs.length - 1
  if (n < 1 || q === 0) return null
  const quot = new Array(n).fill(0)
  quot[n - 1] = coeffs[n] / q
  for (let k = n - 1; k >= 1; k -= 1) quot[k - 1] = (coeffs[k] + p * quot[k]) / q
  const rem = coeffs[0] + p * quot[0]
  if (Math.abs(rem) > 1e-6) return null
  if (quot.some((v) => !Number.isFinite(v) || Math.abs(v - Math.round(v)) > 1e-6)) return null
  return quot.map((v) => Math.round(v))
}

function quadraticAlgs(a: number, b: number, c: number): Alg[] {
  const disc = b * b - 4 * a * c
  if (disc < 0 || !Number.isInteger(disc)) return []
  const { sq, rest } = splitSquare(disc)
  const signs: Array<1 | -1> = disc === 0 ? [1] : [-1, 1]
  return signs.map((sign) => simplifyAlg({ c: -b, rad: sign * sq, rest, den: 2 * a }))
}

function solveIntPoly(coeffsIn: number[], from: number, to: number): Array<{ x: number; alg: Alg | null; parts: ExtremumPart[]; sym?: SymRoot }> | null {
  let coeffs = coeffsIn.slice()
  while (coeffs.length > 1 && coeffs[coeffs.length - 1] === 0) coeffs.pop()
  if (coeffs.every((c) => c === 0)) return []
  const found: Array<{ x: number; alg: Alg | null; parts: ExtremumPart[]; sym?: SymRoot }> = []
  while (coeffs.length - 1 >= 3) {
    const c0 = coeffs[0]
    const lead = coeffs[coeffs.length - 1]
    let hit: { p: number; q: number } | null = null
    if (c0 === 0) hit = { p: 0, q: 1 }
    else {
      const ps = divisors(c0)
      const qs = divisors(lead)
      for (const q of qs) {
        for (const p of ps) {
          for (const sign of [1, -1]) {
            const pp = sign * p
            const g = gcd(pp, q)
            const rp = pp / g
            const rq = q / g
            if (polyValueAtRational(coeffs, rp, rq) === 0) {
              hit = { p: rp, q: rq }
              break
            }
          }
          if (hit) break
        }
        if (hit) break
      }
    }
    if (!hit) {
      if (coeffs.length - 1 === 3) {
        const cubic = cubicSymbolic(coeffs)
        if (!cubic) return null
        return [...found, ...cubic.map((root) => ({ x: root.x, alg: null, parts: root.parts, sym: root.sym }))]
          .filter((root) => root.x >= from - 1e-6 && root.x <= to + 1e-6)
      }
      return null
    }
    const next = deflateByRational(coeffs, hit.p, hit.q)
    if (!next) return null
    const alg = simplifyAlg({ c: hit.p, rad: 0, rest: 0, den: hit.q })
    found.push({ x: hit.p / hit.q, alg, parts: algParts(alg) })
    coeffs = next
  }
  const deg = coeffs.length - 1
  if (deg === 1) {
    const alg = simplifyAlg({ c: -coeffs[0], rad: 0, rest: 0, den: coeffs[1] })
    found.push({ x: -coeffs[0] / coeffs[1], alg, parts: algParts(alg) })
  } else if (deg === 2) {
    if (!coeffs.every((c) => Number.isInteger(c))) return null
    for (const alg of quadraticAlgs(coeffs[2], coeffs[1], coeffs[0])) {
      found.push({ x: (alg.c + alg.rad * Math.sqrt(alg.rest || 0)) / alg.den, alg, parts: algParts(alg) })
    }
  } else if (deg > 2) return null
  return found.filter((root) => root.x >= from - 1e-6 && root.x <= to + 1e-6)
}

function numericZeros(fn: (x: number) => number | null, from: number, to: number): number[] {
  const steps = 320
  const roots: number[] = []
  let prevX = from
  let prev = fn(from)
  for (let i = 1; i <= steps; i += 1) {
    const x = from + ((to - from) * i) / steps
    const cur = fn(x)
    if (prev != null && cur != null && ((prev === 0) || prev * cur < 0)) {
      let lo = prevX
      let hi = x
      let flo = prev
      for (let k = 0; k < 48; k += 1) {
        const mid = (lo + hi) / 2
        const fm = fn(mid)
        if (fm == null || Math.abs(fm) < 1e-8) {
          lo = hi = mid
          break
        }
        if (flo * fm <= 0) hi = mid
        else {
          lo = mid
          flo = fm
        }
      }
      roots.push((lo + hi) / 2)
    }
    prevX = x
    prev = cur
  }
  return roots
}

/** Giao điểm của hai hàm cùng trục, trong khoảng vẽ. */
export function labelIntersections(a: ParsedPlot, b: ParsedPlot, from: number, to: number, lang = 'vi'): LabeledIntersection[] {
  if (a.axis !== b.axis) return []
  const variable = a.axis === 'y' ? 'x' : 'y'
  const lo = Math.min(from, to)
  const hi = Math.max(from, to)
  const polyA = exprToPoly(a.expr, variable)
  const polyB = exprToPoly(b.expr, variable)
  const intA = polyA ? toIntPoly(polyA) : null
  const intB = polyB ? toIntPoly(polyB) : null
  let exact: Array<{ x: number; alg: Alg | null; parts: ExtremumPart[]; sym?: SymRoot }> | null = null
  if (intA && intB) {
    const n = Math.max(intA.length, intB.length)
    const diff = Array.from({ length: n }, (_, i) => (intA[i] ?? 0) - (intB[i] ?? 0))
    exact = solveIntPoly(diff, lo, hi)
  }
  const roots = exact ?? numericZeros((t) => {
    const left = evalAt(a.expr, variable, t)
    const right = evalAt(b.expr, variable, t)
    if (left == null || right == null) return null
    return left - right
  }, lo, hi).map((x) => ({ x, alg: null as Alg | null, parts: [] as ExtremumPart[] }))
  const sorted = roots.slice().sort((p, q) => p.x - q.x)
  const out: LabeledIntersection[] = []
  for (const root of sorted) {
    if (out.some((item) => Math.abs(item.x - root.x) < 0.02)) continue
    const yAlg = root.alg && intA ? evalPolyAlg(intA, root.alg) : null
    const yTrip = root.sym && intA ? reducePoly(intA, root.sym.h, root.sym.p, root.sym.q) : null
    const param = root.x
    const value = yAlg
      ? (yAlg.c + yAlg.rad * Math.sqrt(yAlg.rest || 0)) / yAlg.den
      : evalAt(a.expr, variable, param)
    if (value == null || !Number.isFinite(value)) continue
    const xNum = a.axis === 'y' ? param : value
    const yNum = a.axis === 'y' ? value : param
    const paramParts = root.parts.length > 0 ? root.parts : [{ t: 'text' as const, s: formatApprox(param) }]
    const valueParts = yTrip && root.sym
      ? formatTrip(yTrip, root.sym.sParts)
      : yAlg
        ? algParts(yAlg)
        : [{ t: 'text' as const, s: formatApprox(value) }]
    const xParts = a.axis === 'y' ? paramParts : valueParts
    const yParts = a.axis === 'y' ? valueParts : paramParts
    out.push({ x: xNum, y: yNum, parts: coordinateParts(out.length + 1, xParts, yParts, lang) })
  }
  return out
}
