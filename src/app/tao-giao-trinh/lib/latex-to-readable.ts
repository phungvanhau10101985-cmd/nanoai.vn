/**
 * Chuyển LaTeX sang ký hiệu Unicode – sửa lỗi định dạng phổ biến cho học sinh dễ đọc.
 * Không cần MathJax/KaTeX.
 *
 * Các nhóm xử lý:
 * 1. Ký hiệu toán: \in→∈, \mathbb{R}→ℝ, \frac{1}{2}→(1)/(2)
 * 2. Chỉ số: x_1→x₁, x^2→x²
 * 3. Lỗi AI: } thay ), ≤ft (từ \left), \frac{1){2}
 * 4. Làm gọn an toàn: (1)/(2)→1/2, (√(3))/(2)→(√3)/2 — KHÔNG bỏ ngoặc phân số khi tử/mẫu có + hoặc -.
 */

const SUBSCRIPT_MAP: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
}

/** Unicode subscript (₁₂₃...) → ASCII để regex khớp */
const UNICODE_SUB_TO_ASCII: Record<string, string> = {
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
  '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
}

function unicodeSubToAscii(s: string): string {
  return s.replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (c) => UNICODE_SUB_TO_ASCII[c] ?? c)
}

/**
 * Đọc một khối `{ ... }` cân bằng; `openIdx` trỏ tới dấu `{` mở.
 */
function readBalancedBraces(s: string, openIdx: number): { inner: string; after: number } | null {
  if (openIdx < 0 || openIdx >= s.length || s[openIdx] !== '{') return null
  let depth = 1
  let i = openIdx + 1
  while (i < s.length && depth > 0) {
    const c = s[i]
    if (c === '{') depth++
    else if (c === '}') depth--
    i++
  }
  if (depth !== 0) return null
  return { inner: s.slice(openIdx + 1, i - 1), after: i }
}

/**
 * \\dfrac → \\frac (cùng cú pháp ngoặc)
 */
function normalizeFracCommands(s: string): string {
  return s.replace(/\\dfrac\s*\{/g, '\\frac{')
}

/**
 * Mọi \\frac{num}{den} với ngoặc `{}` lồng nhau → (num)/(den); đệ quy trong num/den.
 * Tránh lỗi regex [^}]* với x^{2} trong tử số.
 */
function expandFracBalanced(s: string): string {
  const t = normalizeFracCommands(s)
  if (!t.includes('\\frac{')) return t
  let out = ''
  let i = 0
  while (i < t.length) {
    const j = t.indexOf('\\frac{', i)
    if (j === -1) {
      out += t.slice(i)
      break
    }
    out += t.slice(i, j)
    const openNum = j + 5 // vị trí '{' ngay sau \frac
    const numRead = readBalancedBraces(t, openNum)
    if (!numRead || numRead.after >= t.length || t[numRead.after] !== '{') {
      out += t[j]!
      i = j + 1
      continue
    }
    const denRead = readBalancedBraces(t, numRead.after)
    if (!denRead) {
      out += t[j]!
      i = j + 1
      continue
    }
    const numExpanded = expandFracBalanced(numRead.inner)
    const denExpanded = expandFracBalanced(denRead.inner)
    out += `(${numExpanded})/(${denExpanded})`
    i = denRead.after
  }
  return out
}

const LATEX_MAP: [RegExp | string, string][] = [
  [/\$\\mathbb\{R\}\$/g, 'ℝ'],
  [/\$\\mathbb\{N\}\$/g, 'ℕ'],
  [/\$\\mathbb\{Z\}\$/g, 'ℤ'],
  [/\$\\infty\$/g, '∞'],
  [/\$\\Delta\$/g, 'Δ'],
  [/\$\\alpha\$/g, 'α'],
  [/\$\\beta\$/g, 'β'],
  [/\$\\Leftrightarrow\$/g, '⇔'],
  [/\$\\Rightarrow\$/g, '⇒'],
  [/\$\\ge\$/g, '≥'],
  [/\$\\leq\$/g, '≤'],
  [/\$\\le\$/g, '≤'],
  [/\$\\geq\$/g, '≥'],
  [/\$\\ne\$/g, '≠'],
  [/\$\\neq\$/g, '≠'],
  [/\$\\pm\$/g, '±'],
  [/\$\\sqrt\{([^}]+)\}\$/g, '√($1)'],
  [/\$\(-\\infty;\s*([^)]+)\)\$/g, '(-∞; $1)'],
  [/\$\(([^;]+);\s*\+\\infty\)\$/g, '($1; +∞)'],
  [/\$\(-\\infty;\s*\+\\infty\)\$/g, '(-∞; +∞)'],
  [/\$\\left\(\\frac\{([^}]+)\}\{([^}]+)\};\\s*\+\\infty\\right\)\$/g, '(($1)/($2); +∞)'],
  [/\$\(-\\infty;\s*([^)]+)\)\s*và\s*\(([^;]+);\s*\+\\infty\)\$/g, '(-∞; $1) và ($2; +∞)'],
  [/\$\\nearrow\$/g, '↗'],
  [/\$\\searrow\$/g, '↘'],
  [/\$\\times\$/g, '×'],
  [/\$\\div\$/g, '÷'],
  [/\$\\cdot\$/g, '·'],
  [/\$\\leftrightarrow\$/g, '↔'],
]

/** Chuyển x^2, x^3, x^{-1} trong chuỗi */
function convertSuperscripts(text: string): string {
  return text
    .replace(/\^2(?=[\s;,)\]}\-\d]|$)/g, '²')
    .replace(/\^3(?=[\s;,)\]}\-\d]|$)/g, '³')
    .replace(/\^1(?=[\s;,)\]}\-\d]|$)/g, '¹')
    .replace(/\^\{-1\}/g, '⁻¹')
    .replace(/\^\{2\}/g, '²')
    .replace(/\^\{3\}/g, '³')
    .replace(/\^\{n\}/g, 'ⁿ')
    .replace(/\^\{([^}]+)\}/g, '^$1')
}

/** Chuyển x_1, x_2, t_1, t_2... sang x₁, x₂, t₁, t₂; _{y'} → _y' */
function convertSubscripts(text: string): string {
  return text
    .replace(/_\{([^}]*)\}/g, '_$1') // _{y'} → _y'
    .replace(/_([0-9]+)/g, (_, digits) =>
      digits.split('').map((d: string) => SUBSCRIPT_MAP[d] ?? d).join('')
    )
}

/** Chuyển nội dung trong $...$ sang Unicode đọc được */
function convertLatexInline(match: string): string {
  let inner = match.slice(1, -1) // bỏ $ đầu cuối
  inner = convertSuperscripts(inner)
  inner = convertSubscripts(inner)
  // Thứ tự quan trọng: \left, \right TRƯỚC \le để tránh \left thành ≤ft
  inner = inner
    .replace(/\\left\(/g, '(')
    .replace(/\\right\)/g, ')')
    .replace(/\\left\[/g, '[')
    .replace(/\\right\]/g, ']')
    .replace(/\\left\{/g, '{')
    .replace(/\\right\}/g, '}')
    .replace(/\\left\./g, '')
    .replace(/\\right\./g, '')
    .replace(/\\infty/g, '∞')
    .replace(/\\int\^(\d+)_(\d+)/g, '∫[$2→$1]')
    .replace(/\\log_2\s*\{([^}]*)\}/g, 'log₂($1)')
    .replace(/\\log_2\s*\(([^)]*)\)/g, 'log₂($1)')
    .replace(/\\mathbb\{R\}/g, 'ℝ')
    .replace(/\\mathbb\{N\}/g, 'ℕ')
    .replace(/\\mathbb\{Z\}/g, 'ℤ')
    .replace(/\\mathbb\{Q\}/g, 'ℚ')
    .replace(/\\mathbb\{C\}/g, 'ℂ')
    .replace(/\\Delta/g, 'Δ')
    .replace(/\\in/g, '∈')
    .replace(/\\setminus/g, '∖')
    .replace(/\\rightarrow|\\to/g, '→')
    .replace(/\\leftarrow/g, '←')
    .replace(/\^\\prime/g, '′')
    .replace(/\\prime/g, '′')
    .replace(/\\Leftrightarrow/g, '⇔')
    .replace(/\\Rightarrow/g, '⇒')
    .replace(/\\ge|\\geq/g, '≥')
    .replace(/\\le|\\leq/g, '≤')
    .replace(/\\ne|\\neq/g, '≠')
    .replace(/\\pm/g, '±')
    .replace(/\\cdot/g, '·')
    .replace(/\\times/g, '×')
    .replace(/\\sqrt\{([^}]*)\}/g, '√($1)')
    .replace(/\\,/g, ' ')
    .replace(/\\quad/g, '  ')
    .replace(/\\qquad/g, '    ')
  return inner
}

/** Chuyển LaTeX ngoài $...$ (plain text có ký hiệu LaTeX) */
function convertPlainLatex(text: string): string {
  return text
    // --- \begin{cases}...\end{cases} → f(x) = {...} ---
    .replace(/\\begin\{cases\}\s*([\s\S]*?)\\end\{cases\}/g, (_, body) => {
      const lines = body.split(/\\\\/).map((l: string) => l.trim()).filter(Boolean)
      const parts = lines.map((line: string) => {
        const m = line.match(/^(.+?)\s*&\s*\\text\{\s*khi\s*\}\s*(.+)$/) || line.match(/^(.+?)\s*&\s*(.+)$/)
        if (m) return `${m[1].trim()} khi ${m[2].trim()}`
        return line.replace(/\\text\{\s*([^}]*)\s*\}/g, '$1')
      })
      return parts.join('; ')
    })
    .replace(/\\text\{\s*([^}]*)\s*\}/g, '$1')
    // --- \int_0^{\pi/2} hoặc \int^\pi/2{0} (lỗi format) ---
    .replace(/\\int_\{0\}\^\{\\pi\/2\}/g, '∫[0→π/2]')
    .replace(/\\int\^\\pi\/2\{0\}/g, '∫[0→π/2]')
    // --- \vec{AB} → AB (từ "Vectơ" đã rõ) ---
    .replace(/\\vec\{([^}]*)\}/g, '$1')
    // --- \pi → π ---
    .replace(/\\pi\b/g, 'π')
    // --- Tập hợp \left{...\right} → {...} ---
    .replace(/\\left\{([^}]*)\\right\}\s*\.?/g, '{$1}')
    .replace(/\\left\{([^}]*)\}/g, '{$1}')
    .replace(/\\left\s*\{\s*([^}]*)\s*\}\s*\\right\s*\.?/g, '{$1}')
    // --- Log: {log}₂{(x²-x+2)) hoặc {log}2{...} ---
    .replace(/\{log\}₂\{\(([^)]+)\)\)/g, 'log₂($1)')
    .replace(/\{log\}2\{\(([^)]+)\)\)/g, 'log₂($1)')
    .replace(/\{log\}₂\{([^}]+)\)\}/g, 'log₂($1)')
    .replace(/\{log\}2\{([^}]+)\)\}/g, 'log₂($1)')
    .replace(/\{log\}₂\{([^}]+)\}/g, 'log₂($1)')
    .replace(/\{log\}2\{([^}]+)\}/g, 'log₂($1)')
    .replace(/\\log_2\s*\{([^}]*)\}/g, 'log₂($1)')
    .replace(/\\log_2\s*\(([^)]*)\)/g, 'log₂($1)')
    // --- Tích phân: \int^2₁ (Unicode subscript), \int^a_b, \int_-1^2 ---
    .replace(/\\int\^(\d+)_([₁₂₃₄₅₆₇₈₉₀\d]+)\s/g, (_, a, b) => `∫[${unicodeSubToAscii(b)}→${a}] `)
    .replace(/\\int\^(\d+)_([₁₂₃₄₅₆₇₈₉₀\d]+)([^\s])/g, (_, a, b, c) => `∫[${unicodeSubToAscii(b)}→${a}]${c}`)
    .replace(/\\int\^(\d+)_(\d+)\s/g, '∫[$2→$1] ')
    .replace(/\\int\^(\d+)_(\d+)([^\s])/g, '∫[$2→$1]$3')
    .replace(/\\int_(-?\d+)\^(\d+)/g, '∫[$1→$2]')
    .replace(/\\int_(-?\d+)²/g, '∫[$1→2]')
    .replace(/\\int_\{([^}]+)\}\^\{([^}]+)\}/g, '∫[$1→$2]')
    .replace(/\\int\^(\d+)_(\d+)\s+f\(x\)\s*dx/g, '∫[$2→$1] f(x)dx')
    .replace(/\\int_(-?\d+)\^(\d+)\(/g, '∫[$1→$2](')
    // --- Lỗi AI phổ biến ---
    .replace(/≤ft/g, '(') // \left bị thành ≤ft do thứ tự replace
    .replace(/\\frac\{([^}]*)\)\{([^}]*)\}/g, '($1)/($2)') // \frac{1){2} (lỗi AI)
    // --- Ký hiệu toán ---
    .replace(/\\in\b/g, '∈')
    .replace(/\\setminus/g, '∖')
    .replace(/\\Leftrightarrow/g, '⇔')
    .replace(/\\Rightarrow/g, '⇒')
    .replace(/\\ge\b|\\geq\b/g, '≥')
    .replace(/\\le\b|\\leq\b/g, '≤')
    .replace(/\\ne\b|\\neq\b/g, '≠')
    .replace(/\\infty\b/g, '∞')
    .replace(/\\mathbb\{R\}/g, 'ℝ')
    .replace(/\\mathbb\{N\}/g, 'ℕ')
    .replace(/\\mathbb\{Z\}/g, 'ℤ')
    .replace(/\\mathbb\{Q\}/g, 'ℚ')
    .replace(/\\mathbb\{C\}/g, 'ℂ')
    .replace(/\\Delta\b/g, 'Δ')
    .replace(/\\cdot\b/g, '·')
    .replace(/\\times\b/g, '×')
    .replace(/\\div\b/g, '÷')
    .replace(/\\forall\b/g, '∀')
    .replace(/\\exists\b/g, '∃')
    .replace(/\\rightarrow\b|\\to\b/g, '→')
    .replace(/\\leftarrow\b/g, '←')
    .replace(/\^\\prime/g, '′')
    .replace(/\\prime\b/g, '′')
    .replace(/\\subset\b/g, '⊂')
    .replace(/\\supset\b/g, '⊃')
    .replace(/\\approx\b/g, '≈')
    .replace(/\\equiv\b/g, '≡')
    .replace(/\\perp\b/g, '⊥')
    .replace(/\\parallel\b/g, '∥')
    .replace(/\\angle\b/g, '∠')
    .replace(/\\sqrt\{([^}]*)\}/g, '√($1)')
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)')
    .replace(/\\left\(/g, '(')
    .replace(/\\right\)/g, ')')
    .replace(/\\left\[/g, '[')
    .replace(/\\right\]/g, ']')
    .replace(/\\left\./g, '')
    .replace(/\\right\./g, '') // \right. = delimiter vô hình
    .replace(/\\\{/g, '{')
    .replace(/\\\}/g, '}')
    .replace(/\\begin\{array\}\{[^}]*\}([\s\S]*?)\\end\{array\}/g, (_, body) =>
      body.replace(/\\\\/g, ', ').replace(/\s+/g, ' ').trim()
    )
}

/**
 * Làm gọn biểu thức cho học sinh dễ đọc.
 * Regex sửa lỗi định dạng LaTeX phổ biến:
 */
function studentFriendlyFormat(text: string): string {
  return text
    .replace(/\(√\(([^)]*)\)\)\/\((\d+)\)/g, '(√$1)/$2') // (√(3))/(2) → (√3)/2
    .replace(/\((\d+)\)\/\((\d+)\)/g, '$1/$2') // (1)/(2) → 1/2
    // Không gộp (a)/(b) → a/b chung: sẽ làm sai thứ tự phép tính (vd (x²+x+4)/(x-3) → x²+x+4/x-3).
    .replace(/\}\s*=/g, ') =') // } = → ) = (lỗi AI dùng } thay )
}

/**
 * Danh sách regex fix – dùng để kiểm tra / mở rộng.
 * Gọi applyLatexFixes(text) để áp dụng tất cả.
 */
export const LATEX_FIX_PATTERNS = [
  { pattern: /≤ft/g, replacement: '(', desc: '\\left bị corrupt' },
  { pattern: /\\frac\{([^}]*)\)\{([^}]*)\}/g, replacement: '($1)/($2)', desc: '\\frac{1){2}' },
  { pattern: /\(√\(([^)]*)\)\)\/\((\d+)\)/g, replacement: '(√$1)/$2', desc: '(√(3))/(2) → (√3)/2' },
  { pattern: /\((\d+)\)\/\((\d+)\)/g, replacement: '$1/$2', desc: '(1)/(2) → 1/2' },
  { pattern: /\}\s*=/g, replacement: ') =', desc: '} = → ) =' },
] as const

/** Áp dụng các regex fix lên text (chỉ phần student-friendly, không chạy toàn bộ latexToReadable) */
export function applyLatexFixes(text: string): string {
  let out = text
  for (const { pattern, replacement } of LATEX_FIX_PATTERNS) {
    out = out.replace(pattern, replacement)
  }
  return out
}

/**
 * Chuyển khối [bien_thien]...[/bien_thien] thành bảng biến thiên dễ đọc.
 * Cú pháp: [bien_thien]x:-∞,-2,0,2,+∞|f'(x):+,0,-,0,+|f(x):↗,↘,↗,↘,↗[/bien_thien]
 * Hoặc nhiều dòng: [bien_thien]\nx: -∞ | -2 | 0 | 2 | +∞\nf'(x): + | 0 | - | 0 | +\nf(x): ↗ | ↘ | ↗ | ↘ | ↗\n[/bien_thien]
 */
function renderVariationTable(inner: string): string {
  const rows: string[][] = []
  const rawRows = inner.split(/\|(?=\s*[^|]+:)/).map((s) => s.trim()).filter(Boolean)
  if (rawRows.length <= 1) {
    const lines = inner.split('\n').map((s) => s.trim()).filter(Boolean)
    for (const line of lines) {
      const colonIdx = line.indexOf(':')
      if (colonIdx >= 0) {
        const label = line.slice(0, colonIdx).trim()
        const rest = line.slice(colonIdx + 1)
        const cells = rest.split(/[|,;]/).map((c) => c.trim()).filter(Boolean)
        if (cells.length > 0) rows.push([label, ...cells])
      }
    }
  } else {
    for (const block of rawRows) {
      const colonIdx = block.indexOf(':')
      if (colonIdx >= 0) {
        const label = block.slice(0, colonIdx).trim()
        const rest = block.slice(colonIdx + 1)
        const cells = rest.split(/[|,;]/).map((c) => c.trim()).filter(Boolean)
        if (cells.length > 0) rows.push([label, ...cells])
      }
    }
  }
  if (rows.length === 0) return inner
  const norm = (s: string) => s.replace(/^-\s*infty$/i, '-∞').replace(/^\+\s*infty$/i, '+∞').trim()
  const normRows = rows.map((r) => [r[0], ...r.slice(1).map(norm)])
  const colCount = Math.max(...normRows.map((r) => r.length))
  const maxW = 5
  const pad = (s: string, w: number) => {
    const t = String(s).slice(0, w)
    return t.padEnd(w)
  }
  let result = '┌' + Array(colCount).fill('─'.repeat(maxW)).join('┬') + '┐\n'
  for (let i = 0; i < normRows.length; i++) {
    const r = normRows[i]
    const cells = [...r, ...Array(colCount - r.length).fill('')]
    result += '│' + cells.map((c) => pad(c, maxW)).join('│') + '│\n'
    if (i < normRows.length - 1) result += '├' + Array(colCount).fill('─'.repeat(maxW)).join('┼') + '┤\n'
  }
  result += '└' + Array(colCount).fill('─'.repeat(maxW)).join('┴') + '┘'
  return result
}

/** Chuyển toàn bộ LaTeX trong text sang ký hiệu đọc được */
export function latexToReadable(text: string): string {
  let out = text
  // Bước -1: Chuẩn hóa Unicode subscript (₁₂₃...) trong \int, {log} để regex khớp
  out = out.replace(/\\int\^(\d+)_([₁₂₃₄₅₆₇₈₉₀]+)/g, (_, a, b) => `\\int^${a}_${unicodeSubToAscii(b)}`)
  out = out.replace(/\{log\}([₁₂₃₄₅₆₇₈₉₀])/g, (_, d) => `{log}${unicodeSubToAscii(d)}`)
  // Bước 0: Xử lý bảng biến thiên [bien_thien]...[/bien_thien]
  out = out.replace(/\[bien_thien\]\s*([\s\S]*?)\s*\[\/bien_thien\]/gi, (_, inner) => renderVariationTable(inner))
  // Bước 0b: \frac với {...} lồng nhau (vd x^{2} trong tử) — trước mọi regex \frac [^}] đơn giản
  out = expandFracBalanced(out)
  // Bước 1: Chuyển LaTeX ngoài $...$ (plain text)
  out = convertPlainLatex(out)
  out = convertSubscripts(out)
  out = convertSuperscripts(out)
  // Bước 2: LATEX_MAP
  for (const [pattern, replacement] of LATEX_MAP) {
    out = out.replace(pattern, replacement)
  }
  // Bước 3: Nội dung trong $...$
  out = out.replace(/\$([^$]+)\$/g, (_, inner) => convertLatexInline('$' + inner + '$'))
  // Bước 4: Làm gọn cho học sinh dễ đọc
  out = studentFriendlyFormat(out)
  return out
}

/**
 * Cú pháp bảng biến thiên cho AI / người nhập:
 * [bien_thien]
 * x: -∞ | -2 | 0 | 2 | +∞
 * f'(x): + | 0 | - | 0 | +
 * f(x): ↗ | ↘ | ↗ | ↘ | ↗
 * [/bien_thien]
 *
 * Hoặc dạng ngắn: [bien_thien]x:-∞,-2,0,2,+∞|f'(x):+,0,-,0,+|f(x):↗,↘,↗,↘,↗[/bien_thien]
 */
export const BIEN_THIEN_SYNTAX = `[bien_thien]
x: -∞ | -2 | 0 | 2 | +∞
f'(x): + | 0 | - | 0 | +
f(x): ↗ | ↘ | ↗ | ↘ | ↗
[/bien_thien]`
