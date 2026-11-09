/**
 * Công thức và lệnh không gian dán vào ô visual.
 * Đồ thị 2D (y=..., f(x)=...) không đi qua đây.
 * Hình 3D mở https://www.geogebra.org/3d , appName "3d", phối cảnh T.
 */

export type GeoGebraAppName = 'classic' | 'graphing' | 'geometry' | '3d' | 'suite'

const ALLOWED_WORD =
  /^(sin|cos|tan|cot|sec|csc|sqrt|abs|ln|log|exp|asin|acos|atan|sinh|cosh|tanh|floor|ceil|round|pi|if|curve|surface|sphere|infinitecone|cone|cylinder|infinitecylinder|plane|perpendicularplane|orthogonalplane|vector|segment|ray|line|polygon|polyline|prism|pyramid|cube|tetrahedron|octahedron|dodecahedron|icosahedron|polyhedron|net|intersect|point|circle|ellipse)$/i

const NOT_A_POINT =
  /^(sin|cos|tan|cot|sec|csc|sqrt|abs|ln|log|exp|asin|acos|atan|sinh|cosh|tanh|floor|ceil|round|max|min|if|ncr|npr|gcd|lcm|mod|binomial)$/i

const SPATIAL_COMMAND =
  /^(sphere|cone|infinitecone|cylinder|infinitecylinder|plane|perpendicularplane|orthogonalplane|prism|pyramid|cube|tetrahedron|octahedron|dodecahedron|icosahedron|polyhedron|net|surface)$/i

const SUPERSCRIPT: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
  '⁻': '-',
}

function splitDepth0(input: string, sep: ',' | ';' | '\n'): string[] {
  const out: string[] = []
  let depth = 0
  let buf = ''
  for (const ch of input) {
    if (ch === '(') depth += 1
    else if (ch === ')') depth = Math.max(0, depth - 1)
    const hit =
      depth === 0 && (sep === '\n' ? ch === '\n' || ch === ';' : ch === sep)
    if (hit) {
      if (buf.trim()) out.push(buf.trim())
      buf = ''
      continue
    }
    buf += ch
  }
  if (buf.trim()) out.push(buf.trim())
  return out
}

function closeParen(s: string, open: number): number {
  let depth = 0
  for (let i = open; i < s.length; i += 1) {
    if (s[i] === '(') depth += 1
    else if (s[i] === ')') {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return -1
}

function isNumericExpr(raw: string): boolean {
  return /^[+-]?(?:\d+(?:\.\d+)?|pi)(?:[+\-*/^][+-]?(?:\d+(?:\.\d+)?|pi))*$/i.test(raw.trim())
}

function hasFreeVar(expr: string, name: string): boolean {
  const re = new RegExp(`(?<![A-Za-z0-9])${name}(?![A-Za-z0-9])`, 'i')
  return re.test(expr)
}

function hasSpatialPoint(s: string): boolean {
  for (let i = 0; i < s.length; i += 1) {
    if (s[i] !== '(') continue
    let j = i - 1
    while (j >= 0 && /[A-Za-z0-9]/.test(s[j])) j -= 1
    const ident = s.slice(j + 1, i)
    if (ident && NOT_A_POINT.test(ident)) continue
    const end = closeParen(s, i)
    if (end < 0) continue
    if (ident && /^[A-Za-z]\w*$/.test(ident) && s[end + 1] === '=') continue
    const parts = splitDepth0(s.slice(i + 1, end), ',')
    if (parts.length === 3 && parts.every(isNumericExpr)) return true
  }
  return false
}

function topLevelArgCount(s: string): number | null {
  const open = s.indexOf('(')
  if (open < 0) return null
  const end = closeParen(s, open)
  if (end < 0) return null
  const inner = s.slice(open + 1, end).trim()
  if (!inner) return 0
  return splitDepth0(inner, ',').length
}

export function geogebraCommandIsSpatial(command: string): boolean {
  const parts = splitDepth0(command, ';').flatMap((part) => splitDepth0(part, '\n'))
  return parts.some(isSpatialCommand)
}

function isSpatialCommand(cmd: string): boolean {
  const s = cmd.trim()
  if (!s) return false
  if (/^z=/i.test(s)) return true
  if (/^[A-Za-z]\w*\([A-Za-z],[A-Za-z]\)=/i.test(s)) return true
  const name = s.match(/^([A-Za-z]\w*)\s*\(/)?.[1] ?? ''
  if (name && SPATIAL_COMMAND.test(name)) return true
  if (/^curve\s*\(/i.test(s) && (topLevelArgCount(s) ?? 0) >= 6) return true
  if (hasSpatialPoint(s)) return true
  if (hasFreeVar(s, 'z') && s.includes('=')) return true
  return false
}

function replaceSuperscripts(s: string): string {
  return s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, (run) => {
    const body = run
      .split('')
      .map((ch) => SUPERSCRIPT[ch] ?? '')
      .join('')
    return `^(${body})`
  })
}

function replaceDepth0DecimalCommas(s: string): string {
  let out = ''
  let depth = 0
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i]
    if (ch === '(') depth += 1
    else if (ch === ')') depth = Math.max(0, depth - 1)
    if (ch === ',' && depth === 0 && /\d/.test(s[i - 1] || '') && /\d/.test(s[i + 1] || '')) {
      out += '.'
      continue
    }
    out += ch
  }
  return out
}

function toAsciiMath(s: string): string {
  return replaceSuperscripts(s)
    .replace(/π/g, 'pi')
    .replace(/√\(([^)]+)\)/g, 'sqrt($1)')
    .replace(/√([A-Za-z0-9.]+)/g, 'sqrt($1)')
    .replace(/[×·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/[−–—]/g, '-')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/[∣｜❘│┃¦]/g, '|')
}

function cutTrailingProse(s: string): string {
  const re = /\s+([A-Za-z]{2,})\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(s)) !== null) {
    if (!ALLOWED_WORD.test(m[1])) return s.slice(0, m.index)
  }
  return s
}

function isLhsAssignment(s: string, index: number): boolean {
  const before = s.slice(0, index).trimEnd()
  if (!before) return true
  const last = before[before.length - 1]
  return last === '\n' || last === ';' || last === ':' || last === ','
}

function sliceFromMath(s: string): string {
  const candidates: number[] = []
  const zRe = /z\s*=/gi
  let zm: RegExpExecArray | null
  while ((zm = zRe.exec(s)) !== null) {
    if (isLhsAssignment(s, zm.index)) candidates.push(zm.index)
  }
  const patterns = [
    /[A-Za-z]\w*\s*\(\s*[A-Za-z]\w*\s*,\s*[A-Za-z]\w*\s*\)\s*=/,
    /\b(?:sphere|cone|infinitecone|cylinder|infinitecylinder|plane|perpendicularplane|orthogonalplane|surface|curve|prism|pyramid|cube|tetrahedron|octahedron|dodecahedron|icosahedron|polyhedron|vector|segment|polygon)\s*\(/i,
    /[xyz]\s*(?:\^|\*\*|²)/i,
    /\(\s*[+-]?\d+(?:\.\d+)?\s*,\s*[+-]?\d+(?:\.\d+)?\s*,\s*[+-]?\d+(?:\.\d+)?\s*\)/,
  ]
  for (const re of patterns) {
    const m = re.exec(s)
    if (m) candidates.push(m.index)
  }
  let start = candidates.length > 0 ? Math.min(...candidates) : -1
  if (start <= 0) return s
  const named = s.slice(0, start).match(/([A-Za-z]\w*\s*=\s*)$/)
  if (named && named.index != null) start = named.index
  return s.slice(start)
}

function lowercaseStandaloneXYZT(s: string): string {
  return s.replace(/(?<![A-Za-z])[XYZT](?![A-Za-z])/g, (ch) => ch.toLowerCase())
}

function applyAbsBars(s: string): string {
  return s.replace(/\|([^|]+)\|/g, 'abs($1)')
}

function normalizeStatement(raw: string): string {
  const sliced = sliceFromMath(raw)
  const ascii = toAsciiMath(sliced)
  const noForeign = ascii.split(/[^\x00-\x7F]/)[0] ?? ''
  const noFigure = noForeign.replace(/\(\s*(hình|hinh|figure|fig)\b[^)]*\)/gi, '')
  const noProse = cutTrailingProse(noFigure)
  const compact = replaceDepth0DecimalCommas(noProse.replace(/\s+/g, ''))
  const leading = compact.match(/^[0-9A-Za-z+\-*/^().,=|<>&]+/)?.[0] ?? ''
  const trimmed = leading.replace(/[+\-*/^,.=|<>&]+$/, '')
  return applyAbsBars(lowercaseStandaloneXYZT(trimmed))
}

function isDomain(s: string): boolean {
  return /^[xyzt](>=|<=|>|<)-?\d+(?:\.\d+)?$/i.test(s)
}

function firstDepth0Comma(s: string): number {
  let depth = 0
  for (let i = 0; i < s.length; i += 1) {
    if (s[i] === '(') depth += 1
    else if (s[i] === ')') depth = Math.max(0, depth - 1)
    else if (s[i] === ',' && depth === 0) return i
  }
  return -1
}

function applyDomain(cmd: string, domain: string): string {
  const wrapped = cmd.match(/^(z|[A-Za-z]\w*\([^)]*\))=If\((.+)\)$/i)
  if (wrapped) {
    const comma = firstDepth0Comma(wrapped[2])
    if (comma < 0) return cmd
    const cond = wrapped[2].slice(0, comma)
    const rhs = wrapped[2].slice(comma + 1)
    return `${wrapped[1]}=If(${cond}&&${domain},${rhs})`
  }
  const plain = cmd.match(/^(z|[A-Za-z]\w*\([^)]*\))=(.+)$/i)
  if (!plain) return cmd
  return `${plain[1]}=If(${domain},${plain[2]})`
}

function foldDomains(parts: string[]): string[] {
  const out: string[] = []
  for (const part of parts) {
    if (isDomain(part) && out.length > 0) out[out.length - 1] = applyDomain(out[out.length - 1], part)
    else out.push(part)
  }
  return out
}

export function spatialGeoGebraCommand(rawInput: string): string | null {
  const raw = String(rawInput || '').trim()
  if (!raw || /^https?:\/\//i.test(raw)) return null
  const statements = splitDepth0(raw, '\n')
  const commands: string[] = []
  for (const statement of statements) {
    const normalized = normalizeStatement(statement)
    if (!normalized) continue
    commands.push(...foldDomains(splitDepth0(normalized, ',')))
  }
  const usable = commands.filter((cmd) => cmd.length >= 3 && cmd.length <= 800)
  if (usable.length === 0 || !usable.some(isSpatialCommand)) return null
  return usable.join(';')
}

export function buildSpatialGeoGebraUrl(rawInput: string): string | null {
  const command = spatialGeoGebraCommand(rawInput)
  if (!command) return null
  return `https://www.geogebra.org/3d?command=${encodeURIComponent(command)}`
}

export function appNameFromGeoGebraPath(pathname: string): GeoGebraAppName {
  const path = pathname.toLowerCase()
  if (/\/3d(\/|$)/.test(path)) return '3d'
  if (/\/graphing(\/|$)/.test(path)) return 'graphing'
  if (/\/geometry(\/|$)/.test(path)) return 'geometry'
  if (/\/calculator(\/|$)/.test(path)) return 'suite'
  return 'classic'
}

/** Lệnh 2D giữ app classic. Lệnh không gian hoặc đường dẫn /3d mở app 3D. */
export function geoGebraAppForEmbed(pathname: string, command: string | null): GeoGebraAppName {
  const fromPath = appNameFromGeoGebraPath(pathname)
  const cmd = String(command || '').trim()
  if (!cmd) return fromPath
  if (fromPath === 'geometry' && !geogebraCommandIsSpatial(cmd)) return 'geometry'
  if (fromPath === '3d' || geogebraCommandIsSpatial(cmd)) return '3d'
  return 'classic'
}
