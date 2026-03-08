/**
 * Chuyển LaTeX phổ biến sang ký hiệu Unicode để học sinh đọc được
 * (không cần render MathJax/KaTeX)
 */

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
    .replace(/\^2(?=[\s;,)\]}]|$)/g, '²')
    .replace(/\^3(?=[\s;,)\]}]|$)/g, '³')
    .replace(/\^1(?=[\s;,)\]}]|$)/g, '¹')
    .replace(/\^\{-1\}/g, '⁻¹')
    .replace(/\^\{2\}/g, '²')
    .replace(/\^\{3\}/g, '³')
    .replace(/\^\{n\}/g, 'ⁿ')
    .replace(/\^\{([^}]+)\}/g, '^$1')
}

/** Chuyển nội dung trong $...$ sang Unicode đọc được */
function convertLatexInline(match: string): string {
  let inner = match.slice(1, -1) // bỏ $ đầu cuối
  inner = convertSuperscripts(inner)
  inner = inner
    .replace(/\\infty/g, '∞')
    .replace(/\\mathbb\{R\}/g, 'ℝ')
    .replace(/\\mathbb\{N\}/g, 'ℕ')
    .replace(/\\mathbb\{Z\}/g, 'ℤ')
    .replace(/\\Delta/g, 'Δ')
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
    .replace(/\\left\(/g, '(')
    .replace(/\\right\)/g, ')')
    .replace(/\\left\[/g, '[')
    .replace(/\\right\]/g, ']')
    .replace(/\\left\./g, '')
    .replace(/\\right\./g, '')
    .replace(/\\,/g, ' ')
    .replace(/\\quad/g, '  ')
    .replace(/\\qquad/g, '    ')
  return inner
}

/** Chuyển toàn bộ LaTeX trong text sang ký hiệu đọc được */
export function latexToReadable(text: string): string {
  let out = text
  for (const [pattern, replacement] of LATEX_MAP) {
    out = out.replace(pattern, replacement)
  }
  out = out.replace(/\$([^$]+)\$/g, (_, inner) => convertLatexInline('$' + inner + '$'))
  return out
}
