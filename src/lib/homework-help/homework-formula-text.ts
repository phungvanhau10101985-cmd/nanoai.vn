/**
 * Tách chữ bài tập thành lời và công thức để vẽ kiểu sách giáo khoa.
 * Không đổi chuỗi gốc lưu trong hội thoại.
 */

export type StudyFormulaPart =
  | { kind: 'text'; text: string }
  | { kind: 'chem'; tex: string; display: boolean }
  | { kind: 'math'; tex: string; display: boolean }

const TWO_LETTER = new Set([
  'He', 'Li', 'Be', 'Ne', 'Na', 'Mg', 'Al', 'Si', 'Cl', 'Ar', 'Ca', 'Sc', 'Ti', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn',
  'Ga', 'Ge', 'As', 'Se', 'Br', 'Kr', 'Rb', 'Sr', 'Ag', 'Cd', 'In', 'Sn', 'Sb', 'Te', 'Xe', 'Cs', 'Ba', 'Pt', 'Au', 'Hg',
  'Pb', 'Bi', 'Rn', 'Fr', 'Ra',
])
const ONE_LETTER = new Set(['H', 'B', 'C', 'N', 'O', 'F', 'P', 'S', 'K', 'I', 'V', 'W', 'Y', 'U'])

const SUB_DIGIT: Record<string, string> = {
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
}
const SUP_DIGIT: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
}

const VIETNAMESE = /[\u00C0-\u024F\u1E00-\u1EFF]/
const UNITS = new Set(['g', 'kg', 'mg', 'gam', 'ml', 'l', 'mol', 'm', 'cm', 'mm', 'km', 'dm', 's', 'h', 'min', 'pa', 'hz', 'j', 'n', 'w'])

function normalizeSchoolChar(ch: string): string {
  if (SUB_DIGIT[ch]) return SUB_DIGIT[ch]
  if (SUP_DIGIT[ch]) return SUP_DIGIT[ch]
  if (ch === '⁺') return '+'
  if (ch === '⁻' || ch === '−' || ch === '–') return '-'
  if (ch === '·' || ch === '⋅') return '.'
  return ch
}

function normalizeSchool(text: string): string {
  return [...text].map(normalizeSchoolChar).join('')
}

function isBoundary(text: string, index: number): boolean {
  if (index <= 0) return true
  const prev = text[index - 1] ?? ''
  return !/[A-Za-z0-9]/.test(prev) && !VIETNAMESE.test(prev)
}

function readElement(text: string, index: number): number | null {
  const two = text.slice(index, index + 2)
  if (TWO_LETTER.has(two)) return index + 2
  const one = text[index] ?? ''
  if (ONE_LETTER.has(one)) return index + 1
  return null
}

function readDigits(text: string, index: number): number {
  let end = index
  while (end < text.length && text[end] >= '0' && text[end] <= '9') end += 1
  return end
}

function readFormulaBody(text: string, index: number): { end: number; atoms: number; digits: boolean; groups: boolean } | null {
  let end = index
  let atoms = 0
  let digits = false
  let groups = false
  while (end < text.length) {
    if (text[end] === '(') {
      const inner = readFormulaBody(text, end + 1)
      if (!inner || text[inner.end] !== ')') break
      groups = true
      atoms += Math.max(1, inner.atoms)
      digits = digits || inner.digits
      end = inner.end + 1
      const counted = readDigits(text, end)
      if (counted > end) digits = true
      end = counted
      continue
    }
    const next = readElement(text, end)
    if (next == null) break
    atoms += 1
    end = next
    const counted = readDigits(text, end)
    if (counted > end) {
      const after = text[counted] ?? ''
      const run = counted - end
      if ((after === '+' || after === '-') && run === 1) break
      if ((after === '+' || after === '-') && run > 1) {
        digits = true
        end = counted - 1
        break
      }
      digits = true
      end = counted
    }
  }
  if (end === index || atoms === 0) return null
  return { end, atoms, digits, groups }
}

function formulaIsReal(body: { atoms: number; digits: boolean; groups: boolean }): boolean {
  return body.digits || body.groups || body.atoms >= 2
}

function readCharge(text: string, index: number): { end: number; charge: string } | null {
  if (text[index] === '^') {
    const wrapped = text.slice(index).match(/^\^\{(\d*[+-])\}/)
    if (wrapped) return { end: index + wrapped[0].length, charge: wrapped[1] ?? '' }
    const plain = text.slice(index).match(/^\^(\d*[+-])/)
    if (plain) return { end: index + plain[0].length, charge: plain[1] ?? '' }
  }
  if (text[index] === '+' || text[index] === '-') return { end: index + 1, charge: text[index] }
  const digitsEnd = readDigits(text, index)
  if (digitsEnd === index) return null
  const sign = text[digitsEnd] ?? ''
  if (sign !== '+' && sign !== '-') return null
  return { end: digitsEnd + 1, charge: text.slice(index, digitsEnd) + sign }
}

type ChemPiece = { start: number; end: number; body: string; charge: string }

function readChemCore(text: string, index: number): ChemPiece | null {
  const cursor = index
  const body = readFormulaBody(text, cursor)
  if (!body) return null
  let end = body.end
  let charge = ''
  const charged = readCharge(text, end)
  if (charged) {
    charge = charged.charge
    end = charged.end
  }
  if (!formulaIsReal(body) && !charge) return null
  let formula = text.slice(cursor, body.end)
  while (end < text.length && (text[end] === '.' || text[end] === '·')) {
    const water = readChemPiece(text, end + 1)
    if (!water || water.start !== end + 1) break
    formula += `.${water.body}`
    end = water.end
    charge = water.charge || charge
  }
  return { start: index, end, body: formula, charge }
}

function readChemPiece(text: string, index: number): ChemPiece | null {
  const digitsEnd = readDigits(text, index)
  if (digitsEnd > index && digitsEnd - index <= 3) {
    const ahead = readChemCore(text, digitsEnd)
    if (ahead && ahead.start === digitsEnd) {
      return {
        start: index,
        end: ahead.end,
        body: `${text.slice(index, digitsEnd)}${ahead.body}`,
        charge: ahead.charge,
      }
    }
  }
  return readChemCore(text, index)
}

function pieceTex(piece: ChemPiece): string {
  const charge = piece.charge ? `^{${piece.charge}}` : ''
  return `${piece.body}${charge}`
}

function readArrow(text: string, index: number): { end: number; arrow: string } | null {
  const slice = text.slice(index)
  if (slice.startsWith('→') || slice.startsWith('⟶')) return { end: index + 1, arrow: '->' }
  if (slice.startsWith('⇌') || slice.startsWith('⇔') || slice.startsWith('↔')) return { end: index + 1, arrow: '<=>' }
  if (slice.startsWith('->')) return { end: index + 2, arrow: '->' }
  if (slice.startsWith('<=>')) return { end: index + 3, arrow: '<=>' }
  return null
}

function skipSpaces(text: string, index: number): number {
  let end = index
  while (text[end] === ' ') end += 1
  return end
}

function matchChem(text: string, index: number): { end: number; tex: string } | null {
  if (!isBoundary(text, index)) return null
  const first = readChemPiece(text, index)
  if (!first) return null
  const pieces = [pieceTex(first)]
  let end = first.end
  while (end < text.length) {
    const spaced = skipSpaces(text, end)
    const arrow = readArrow(text, spaced)
    const plus = text[spaced] === '+'
    if (!arrow && !plus) break
    const after = skipSpaces(text, arrow ? arrow.end : spaced + 1)
    const next = readChemPiece(text, after)
    if (!next || next.start !== after) break
    if (arrow) {
      pieces.push(arrow.arrow, pieceTex(next))
    } else {
      pieces.push('+', pieceTex(next))
    }
    end = next.end
  }
  return { end, tex: pieces.join(' ') }
}

function readMathToken(text: string, index: number, inEquation: boolean): { end: number; strong: boolean } | null {
  const slice = text.slice(index)
  const fn = slice.match(/^(sqrt|sin|cos|tan|cot|log|ln)(?![A-Za-z])/)
  if (fn) return { end: index + fn[0].length, strong: fn[0] === 'sqrt' }
  if (slice.startsWith('√')) {
    const grouped = slice.match(/^√\s*\([^)]+\)/)
    if (grouped) return { end: index + grouped[0].length, strong: true }
    const simple = slice.match(/^√\s*[a-zA-Z0-9]+/)
    if (simple) return { end: index + simple[0].length, strong: true }
  }
  const number = slice.match(/^\d+(?:[.,]\d+)?(?:[a-zA-Z](?:\^\{?-?\d+\}?|[²³⁴])?)?/)
  if (number) {
    return { end: index + number[0].length, strong: /[\^²³⁴]/.test(number[0]) }
  }
  if (inEquation) {
    const product = slice.match(/^[a-z]{2,3}(?![A-Za-z])/)
    if (product && !UNITS.has(product[0])) return { end: index + product[0].length, strong: false }
  }
  const variable = slice.match(/^[a-zA-Z](?:\^\{?-?\d+\}?|_\d+|[²³⁴])?/)
  if (variable) return { end: index + variable[0].length, strong: /[\^_²³⁴]/.test(variable[0]) }
  const group = slice.match(/^\([^()]{1,80}\)/)
  if (group && /[=^√]/.test(group[0]) && !/^\(\d+\)$/.test(group[0])) {
    return { end: index + group[0].length, strong: true }
  }
  return null
}

function matchMath(text: string, index: number): { end: number; tex: string } | null {
  if (!isBoundary(text, index)) return null
  if (VIETNAMESE.test(text[index] ?? '')) return null
  const first = readMathToken(text, index, false)
  if (!first) return null
  let end = first.end
  let strong = first.strong
  let tokens = 1
  while (end < text.length) {
    const op = text.slice(end).match(/^\s*([+\-*/=<>≤≥≠×÷·^])\s*/)
    if (!op) break
    const after = end + op[0].length
    if (VIETNAMESE.test(text[after] ?? '')) break
    const inEquation = strong || op[1] === '='
    const next = readMathToken(text, after, inEquation)
    if (!next) break
    const tokenText = text.slice(after, next.end)
    const previousToken = text.slice(index, end).trim().split(/\s+/).pop() ?? ''
    if (op[1] === '/' && UNITS.has(previousToken.toLowerCase()) && UNITS.has(tokenText.toLowerCase())) break
    if (tokens >= 1 && UNITS.has(tokenText.toLowerCase()) && /\d/.test(text[end - 1] ?? '')) break
    if (op[1] === '=' || op[1] === '/' || op[1] === '^' || op[1] === '×' || op[1] === '÷' || op[1] === '·') strong = true
    end = next.end
    strong = strong || next.strong
    tokens += 1
    if (end - index > 80) return null
  }
  if (!strong) return null
  const raw = text.slice(index, end).trim()
  if (/^\(?\d+\)?$/.test(raw)) return null
  return { end, tex: mathToTex(raw) }
}

function mathToTex(raw: string): string {
  let tex = raw
  tex = tex.replace(/√\s*\(([^)]+)\)/g, '\\sqrt{$1}')
  tex = tex.replace(/√\s*([a-zA-Z0-9]+)/g, '\\sqrt{$1}')
  tex = tex.replace(/π/g, '\\pi ')
  tex = tex.replace(/α/g, '\\alpha ')
  tex = tex.replace(/β/g, '\\beta ')
  tex = tex.replace(/γ/g, '\\gamma ')
  tex = tex.replace(/Δ/g, '\\Delta ')
  tex = tex.replace(/θ/g, '\\theta ')
  tex = tex.replace(/ω/g, '\\omega ')
  tex = tex.replace(/λ/g, '\\lambda ')
  tex = tex.replace(/μ/g, '\\mu ')
  tex = tex.replace(/∞/g, '\\infty ')
  tex = tex.replace(/≤/g, ' \\le ')
  tex = tex.replace(/≥/g, ' \\ge ')
  tex = tex.replace(/≠/g, ' \\ne ')
  tex = tex.replace(/×/g, ' \\times ')
  tex = tex.replace(/÷/g, ' \\div ')
  tex = tex.replace(/·/g, ' \\cdot ')
  tex = tex.replace(/±/g, ' \\pm ')
  tex = tex.replace(/(\d),(\d)/g, '$1{,}$2')
  tex = tex.replace(/([A-Za-z0-9])²/g, '$1^{2}')
  tex = tex.replace(/([A-Za-z0-9])³/g, '$1^{3}')
  tex = tex.replace(/([A-Za-z0-9])⁴/g, '$1^{4}')
  tex = tex.replace(/\^\{(-?\d+)\}/g, '^{$1}')
  tex = tex.replace(/\^(-?\d+)/g, '^{$1}')
  tex = tex.replace(/_(\d+)/g, '_{$1}')
  tex = tex.replace(/([A-Za-z0-9]+|\([^()]+\))\s*\/\s*([A-Za-z0-9]+|\([^()]+\))/g, '\\frac{$1}{$2}')
  return tex.replace(/\s+/g, ' ').trim()
}

function segmentLine(line: string): StudyFormulaPart[] {
  const source = normalizeSchool(line)
  const parts: StudyFormulaPart[] = []
  let index = 0
  let buffer = ''
  const flush = () => {
    if (!buffer) return
    parts.push({ kind: 'text', text: buffer })
    buffer = ''
  }
  while (index < source.length) {
    if (source[index] === '$') {
      const close = source.indexOf('$', index + 1)
      if (close > index + 1) {
        flush()
        parts.push({ kind: 'math', tex: source.slice(index + 1, close).trim(), display: false })
        index = close + 1
        continue
      }
    }
    const chem = matchChem(source, index)
    if (chem) {
      flush()
      parts.push({ kind: 'chem', tex: chem.tex, display: false })
      index = chem.end
      continue
    }
    const math = matchMath(source, index)
    if (math) {
      flush()
      parts.push({ kind: 'math', tex: math.tex, display: false })
      index = math.end
      continue
    }
    buffer += line[index] ?? source[index] ?? ''
    index += 1
  }
  flush()
  const prose = parts
    .filter((part) => part.kind === 'text')
    .map((part) => part.text)
    .join('')
    .replace(/[\s.,;:|()[\]-]/g, '')
  const display = prose.length === 0 && parts.some((part) => part.kind !== 'text')
  if (!display) return parts
  return parts.map((part) => (part.kind === 'text' ? part : { ...part, display: true }))
}

export function segmentStudyFormula(input: string): StudyFormulaPart[] {
  const prepared = input.replace(/\s\|\s/g, '\n')
  const lines = prepared.split('\n')
  const parts: StudyFormulaPart[] = []
  lines.forEach((line, lineIndex) => {
    if (lineIndex > 0) parts.push({ kind: 'text', text: '\n' })
    parts.push(...segmentLine(line))
  })
  return parts
}

export function studyTextHasFormula(input: string): boolean {
  return segmentStudyFormula(input).some((part) => part.kind !== 'text')
}
