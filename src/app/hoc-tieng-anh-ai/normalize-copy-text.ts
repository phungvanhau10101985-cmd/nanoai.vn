const SCRIPT_WITHOUT_SPACES = new Set(['zh', 'ja', 'ko', 'th', 'hi'])

// Period glyphs count as the same mark. A missing period does not match.
const PERIOD = /[.。．｡।॥]/g
// Comma glyphs count as the same mark. A missing comma does not match.
const COMMA = /[,，､、﹐﹑]/g
// Other marks stay out of the comparison. Apostrophes stay for contractions.
const OTHER_PUNCT =
  /[!！‼?？⁇;；:：~～〜\-—–‐‑‒―()（）\[\]［］【】「」『』《》〈〉<>＜＞・·…⋯]/g

/** Mini writing grades characters plus required periods and commas. */
export function normalizeCopyText(text: string, targetCode?: string): string {
  const dropSpaces = SCRIPT_WITHOUT_SPACES.has(String(targetCode || ''))
  let base = String(text || '')
    .replace(/[’‘]/g, "'")
    .replace(/[“”＂]/g, '"')
  if (dropSpaces) base = base.replace(/['"]/g, '')
  base = base
    .replace(PERIOD, '.')
    .replace(COMMA, ',')
    .replace(OTHER_PUNCT, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*([.,])\s*/g, '$1')
    .trim()
  if (dropSpaces) return base.replace(/\s+/g, '')
  return base
}
