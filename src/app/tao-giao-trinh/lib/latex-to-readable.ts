/**
 * Chuyển LaTeX phổ biến sang ký hiệu Unicode để học sinh đọc được
 * (không cần render MathJax/KaTeX)
 */

const SUBSCRIPT_MAP: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
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
  [/\$\\frac\{([^}]+)\}\{([^}]+)\}\$/g, '($1)/($2)'],
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
    .replace(/\\left\./g, '')
    .replace(/\\right\./g, '')
    .replace(/\\infty/g, '∞')
    .replace(/\\mathbb\{R\}/g, 'ℝ')
    .replace(/\\mathbb\{N\}/g, 'ℕ')
    .replace(/\\mathbb\{Z\}/g, 'ℤ')
    .replace(/\\Delta/g, 'Δ')
    .replace(/\\in/g, '∈')
    .replace(/\\setminus/g, '∖')
    .replace(/\\Leftrightarrow/g, '⇔')
    .replace(/\\Rightarrow/g, '⇒')
    .replace(/\\ge|\\geq/g, '≥')
    .replace(/\\le|\\leq/g, '≤')
    .replace(/\\ne|\\neq/g, '≠')
    .replace(/\\pm/g, '±')
    .replace(/\\cdot/g, '·')
    .replace(/\\times/g, '×')
    .replace(/\\sqrt\{([^}]*)\}/g, '√($1)')
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)')
    .replace(/\\,/g, ' ')
    .replace(/\\quad/g, '  ')
    .replace(/\\qquad/g, '    ')
  return inner
}

/** Chuyển LaTeX ngoài $...$ (plain text có ký hiệu LaTeX) */
function convertPlainLatex(text: string): string {
  return text
    .replace(/≤ft/g, '(') // sửa lỗi \left bị thành ≤ft do thứ tự replace
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
    .replace(/\\Delta\b/g, 'Δ')
    .replace(/\\cdot\b/g, '·')
    .replace(/\\sqrt\{([^}]*)\}/g, '√($1)')
    .replace(/\\frac\{([^}]*)\)\{([^}]*)\}/g, '($1)/($2)') // \frac{1){2} (lỗi AI)
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
 * Làm gọn biểu thức cho học sinh dễ đọc:
 * - (1)/(2) → 1/2; (3)/(4) → 3/4
 * - (√(3))/(2) → (√3)/2
 * - } = → ) = (sửa lỗi AI dùng } thay )
 * - Giảm ngoặc thừa: ((1)/(2)) → (1/2)
 */
function studentFriendlyFormat(text: string): string {
  return text
    .replace(/\(√\(([^)]*)\)\)\/\((\d+)\)/g, '(√$1)/$2') // (√(3))/(2) → (√3)/2
    .replace(/\((\d+)\)\/\((\d+)\)/g, '$1/$2') // (1)/(2) → 1/2
    .replace(/\}\s*=/g, ') =') // } = → ) = (sửa lỗi AI)
}

/** Chuyển toàn bộ LaTeX trong text sang ký hiệu đọc được */
export function latexToReadable(text: string): string {
  let out = text
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
