const MAX_TERMS = 40
const MAX_TERM_LENGTH = 80

/** Cụm khách muốn giữ nguyên. Tách bằng xuống dòng, phẩy, chấm phẩy hoặc dấu sổ. */
export function parseKeepTerms(raw: string): string[] {
  const parts = String(raw || '').split(/[\n,;|]/)
  const terms: string[] = []
  const seen = new Set<string>()
  for (const part of parts) {
    const term = part.replace(/[\u0000-\u001F]/g, '').trim()
    if (!term || term.length > MAX_TERM_LENGTH) continue
    const key = term.toLocaleLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    terms.push(term)
    if (terms.length >= MAX_TERMS) break
  }
  return terms
}

export function keepTermsPromptBlock(terms: string[]): string {
  if (terms.length === 0) return ''
  const lines = terms.map((term) => `- "${term.replace(/"/g, '')}"`).join('\n')
  return `\n\nAlso KEEP these strings exactly, character for character, wherever they appear, including inside a sentence that is otherwise translated:\n${lines}\n`
}
