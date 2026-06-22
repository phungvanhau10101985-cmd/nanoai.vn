import type { ReactNode } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import {
  collectWeddingHighlightTerms,
  escapeWeddingHighlightRegex,
  resolveWeddingCardDisplayText,
  type WeddingCardTextTokens,
} from '@/lib/wedding/wedding-card-text-interpolate'

export function renderWeddingHighlightedText(
  template: string,
  tokens: WeddingCardTextTokens,
  locale: WebLocale,
  highlightClassName: string,
): ReactNode {
  const text = resolveWeddingCardDisplayText(template, tokens, locale)
  const terms = collectWeddingHighlightTerms(tokens, locale)
  if (!text || terms.length === 0) return text

  const pattern = new RegExp(`(${terms.map(escapeWeddingHighlightRegex).join('|')})`, 'g')
  const parts = text.split(pattern)
  return parts.map((part, index) =>
    terms.includes(part) ? (
      <span key={`${index}-${part.slice(0, 12)}`} className={highlightClassName}>
        {part}
      </span>
    ) : (
      part
    ),
  )
}
