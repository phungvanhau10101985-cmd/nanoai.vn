const SCRIPT_WITHOUT_SPACES = new Set(['zh', 'ja', 'ko', 'th', 'hi'])

// Sentence marks only. Apostrophes stay so English contractions still match.
// Chinese quotes are removed for zh/ja/ko/th/hi, where they are not part of the word.
const SENTENCE_PUNCTUATION =
  /[.。．｡…⋯,，､、﹐﹑!！‼?？⁇;；:：~～〜\-—–‐‑‒―()（）\[\]［］【】「」『』《》〈〉<>＜＞।॥・·]/g

/** Mini writing grades characters. Any period, comma, or other sentence mark counts the same. */
export function normalizeCopyText(text: string, targetCode?: string): string {
  const dropSpaces = SCRIPT_WITHOUT_SPACES.has(String(targetCode || ''))
  let base = String(text || '')
    .replace(/[’‘]/g, "'")
    .replace(/[“”＂]/g, '"')
  if (dropSpaces) base = base.replace(/['"]/g, ' ')
  base = base.replace(SENTENCE_PUNCTUATION, ' ').replace(/\s+/g, ' ').trim()
  if (dropSpaces) return base.replace(/\s+/g, '')
  return base
}
