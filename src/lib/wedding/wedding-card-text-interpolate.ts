import type { WebLocale } from '@/lib/i18n/config'

export type WeddingCardTextTokens = {
  groomName: string
  brideName: string
  guestName?: string
}

export const WEDDING_CARD_TEXT_TOKEN_HINT =
  'Có thể dùng {groom}, {bride}, {couple}, {guest} — hệ thống tự thay theo thông tin thiệp.'

export function weddingCoupleLabel(groomName: string, brideName: string, locale: WebLocale): string {
  const groom = groomName.trim()
  const bride = brideName.trim()
  if (groom && bride) {
    return locale === 'vi' ? `${groom} và ${bride}` : `${groom} & ${bride}`
  }
  return groom || bride
}

export function interpolateWeddingCardText(
  template: string,
  tokens: WeddingCardTextTokens,
  locale: WebLocale,
): string {
  if (!template.trim()) return ''
  const groom = tokens.groomName.trim()
  const bride = tokens.brideName.trim()
  const guest = tokens.guestName?.trim() ?? ''
  const couple = weddingCoupleLabel(groom, bride, locale)
  return template
    .replace(/\{groom\}/g, groom)
    .replace(/\{bride\}/g, bride)
    .replace(/\{guest\}/g, guest)
    .replace(/\{couple\}/g, couple)
}

function hasWeddingTextTokens(template: string): boolean {
  return /\{(groom|bride|couple|guest)\}/.test(template)
}

function textAlreadyUsesCurrentCouple(template: string, tokens: WeddingCardTextTokens, locale: WebLocale): boolean {
  const groom = tokens.groomName.trim()
  const bride = tokens.brideName.trim()
  const couple = weddingCoupleLabel(groom, bride, locale)
  if (couple && template.includes(couple)) return true
  if (groom && bride && template.includes(groom) && template.includes(bride)) return true
  return false
}

/** Chuẩn hoá nội dung cũ (tên hardcode) trước khi thay placeholder theo thiệp hiện tại. */
export function normalizeLegacyWeddingCardText(
  template: string,
  tokens: WeddingCardTextTokens,
  locale: WebLocale,
): string {
  if (!template.trim() || hasWeddingTextTokens(template) || textAlreadyUsesCurrentCouple(template, tokens, locale)) {
    return template
  }

  if (locale === 'vi') {
    return template
      .replace(/^[^\n]+?\s+xin(\s+chân thành cảm ơn)/iu, `{couple} xin$1`)
      .replace(/^([^\n]{1,120}?\s+và\s+[^\n,.]{1,40}?)(\s+(?:đã|cùng|xin)\b)/iu, `{couple}$2`)
  }

  if (locale === 'en') {
    return template.replace(
      /^[^\n]+?\s+(sincerely thank|thank you warmly|thank you)/iu,
      `{couple} $1`,
    )
  }

  return template
}

export function resolveWeddingCardDisplayText(
  template: string,
  tokens: WeddingCardTextTokens,
  locale: WebLocale,
): string {
  if (!template.trim()) return ''
  const normalized = normalizeLegacyWeddingCardText(template, tokens, locale)
  return interpolateWeddingCardText(normalized, tokens, locale)
}

export function escapeWeddingHighlightRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function collectWeddingHighlightTerms(
  tokens: WeddingCardTextTokens,
  locale: WebLocale,
): string[] {
  const couple = weddingCoupleLabel(tokens.groomName, tokens.brideName, locale)
  const terms = [couple, tokens.groomName.trim(), tokens.brideName.trim(), tokens.guestName?.trim() ?? '']
  return [...new Set(terms.filter((term) => term.length >= 2))].sort((a, b) => b.length - a.length)
}
