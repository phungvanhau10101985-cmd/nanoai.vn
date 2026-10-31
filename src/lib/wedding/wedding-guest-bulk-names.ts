import { WEDDING_GUEST_HONORIFIC_SUGGESTIONS } from '@/lib/wedding/wedding-guest-honorific-map'
import { normalizeGuestNameKey } from '@/lib/wedding/wedding-guest-invite-link'

export const WEDDING_GUEST_BULK_MAX_LINES = 400

const EXTRA_HONORIFICS = ['Cha', 'Má', 'Ma', 'Ngài', 'Sếp', 'Giám đốc', 'Em rể', 'Em dâu', 'Cụ nội', 'Cụ ngoại']

const HONORIFIC_PHRASES = [...WEDDING_GUEST_HONORIFIC_SUGGESTIONS, ...EXTRA_HONORIFICS]

export type WeddingGuestBulkName = {
  honorific: string
  name: string
  raw: string
}

export type WeddingGuestBulkReject = {
  raw: string
  reason: 'bare'
}

function foldVi(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLocaleLowerCase('vi')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const HONORIFIC_MATCHES = HONORIFIC_PHRASES.map((phrase) => ({
  phrase,
  folded: foldVi(phrase).split(' ').filter(Boolean),
})).sort((a, b) => b.folded.length - a.folded.length || b.phrase.length - a.phrase.length)

export function weddingGuestBulkNameKey(honorific: string, name: string): string {
  return normalizeGuestNameKey(`${honorific} ${name}`)
}

function titleCaseVi(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((word) => {
      const first = word.charAt(0).toLocaleUpperCase('vi')
      const rest = word.slice(1).toLocaleLowerCase('vi')
      return `${first}${rest}`
    })
    .join(' ')
}

/** Tách một dòng thành danh xưng + tên. Thiếu danh xưng hoặc thiếu tên thì loại. */
export function parseWeddingGuestBulkLine(raw: string): WeddingGuestBulkName | WeddingGuestBulkReject | null {
  const compact = raw
    .replace(/^[\s\-*•]+/, '')
    .replace(/[.;,]+$/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^quý\s+/iu, '')
  if (!compact) return null
  const words = compact.split(' ')
  const foldedWords = words.map((word) => foldVi(word)).filter(Boolean)
  if (!foldedWords.length) return { raw: compact, reason: 'bare' }

  for (const match of HONORIFIC_MATCHES) {
    if (foldedWords.length <= match.folded.length) continue
    const prefix = foldedWords.slice(0, match.folded.length).join(' ')
    if (prefix !== match.folded.join(' ')) continue
    const name = titleCaseVi(words.slice(match.folded.length).join(' '))
    if (!name) return { raw: compact, reason: 'bare' }
    return { honorific: match.phrase, name, raw: compact }
  }
  return { raw: compact, reason: 'bare' }
}

export function parseWeddingGuestBulkText(text: string): {
  guests: WeddingGuestBulkName[]
  rejected: WeddingGuestBulkReject[]
} {
  const guests: WeddingGuestBulkName[] = []
  const rejected: WeddingGuestBulkReject[] = []
  const seen = new Set<string>()
  const chunks = text
    .split(/\r?\n/)
    .flatMap((line) => line.split(/[,;]+/))
    .slice(0, WEDDING_GUEST_BULK_MAX_LINES)

  for (const chunk of chunks) {
    const parsed = parseWeddingGuestBulkLine(chunk)
    if (!parsed) continue
    if ('reason' in parsed) {
      rejected.push(parsed)
      continue
    }
    const key = weddingGuestBulkNameKey(parsed.honorific, parsed.name)
    if (seen.has(key)) continue
    seen.add(key)
    guests.push(parsed)
  }
  return { guests, rejected }
}

/** Giữ tên AI khi cùng chữ cái với tên đã tách, để khôi phục dấu tiếng Việt. */
export function acceptPolishedGuestName(current: string, polished: string): string {
  const next = polished.trim().replace(/\s+/g, ' ')
  if (!next) return current
  if (foldVi(next) !== foldVi(current)) return current
  return titleCaseVi(next)
}
