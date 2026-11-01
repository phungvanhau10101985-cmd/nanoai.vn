import { WEDDING_GUEST_HONORIFIC_SUGGESTIONS } from '@/lib/wedding/wedding-guest-honorific-map'
import { normalizeGuestNameKey } from '@/lib/wedding/wedding-guest-invite-link'

/** Một đợt 12.000 ký tự tên ngắn vẫn có thể hơn 1.000 khách. */
export const WEDDING_GUEST_BULK_MAX_LINES = 2_500

/** Mỗi lần dán danh sách. Phần dài hơn giữ lại để tạo đợt sau. */
export const WEDDING_GUEST_BULK_MAX_CHARS = 12_000

/** Một lần AI trả JSON. Đoạn ngắn để danh sách khách không bị cắt giữa chừng. */
export const WEDDING_GUEST_BULK_AI_CHUNK_CHARS = 2_000

/** Cắt ở dấu xuống dòng, phẩy hoặc khoảng trắng gần mốc, để khỏi đứt giữa một khách. */
export function splitWeddingGuestBulkBatch(
  text: string,
  max = WEDDING_GUEST_BULK_MAX_CHARS,
): { batch: string; rest: string } {
  const source = text.replace(/\r\n/g, '\n')
  if (source.length <= max) return { batch: source, rest: '' }
  const head = source.slice(0, max)
  const newline = head.lastIndexOf('\n')
  const comma = Math.max(head.lastIndexOf(','), head.lastIndexOf(';'))
  const space = head.lastIndexOf(' ')
  const breakAt = newline > 0 ? newline : comma > 0 ? comma : space
  const cut = breakAt > 0 ? breakAt : max
  const batch = source.slice(0, cut).replace(/[\s,;]+$/u, '')
  const rest = source.slice(cut).replace(/^[\s,;]+/u, '')
  return { batch, rest }
}

const EXTRA_HONORIFICS = ['Cha', 'Má', 'Ma', 'Ngài', 'Sếp', 'Giám đốc', 'Em rể', 'Em dâu', 'Cụ nội', 'Cụ ngoại']

const HONORIFIC_PHRASES = [...WEDDING_GUEST_HONORIFIC_SUGGESTIONS, ...EXTRA_HONORIFICS]

export const WEDDING_GUEST_BULK_HONORIFICS = HONORIFIC_PHRASES

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

function foldHonorificToken(value: string): string {
  return foldVi(value).replace(/(.)\1+/g, '$1')
}

const TONE_ROWS: Record<string, string> = {
  a: 'aáàảãạ',
  ă: 'ăắằẳẵặ',
  â: 'âấầẩẫậ',
  e: 'eéèẻẽẹ',
  ê: 'êếềểễệ',
  i: 'iíìỉĩị',
  o: 'oóòỏõọ',
  ô: 'ôốồổỗộ',
  ơ: 'ơớờởỡợ',
  u: 'uúùủũụ',
  ư: 'ưứừửữự',
  y: 'yýỳỷỹỵ',
}

const STRONG_VOWELS = new Set(['ê', 'ơ', 'ô', 'â', 'ă'])

function stripToneMark(char: string): string {
  return char.normalize('NFD').replace(/[\u0301\u0300\u0309\u0303\u0323]/g, '').normalize('NFC')
}

function vowelBase(char: string): string {
  const bare = stripToneMark(char).toLocaleLowerCase('vi')
  return TONE_ROWS[bare] ? bare : ''
}

function applyTelexTone(text: string, toneKey: string): string | null {
  const toneIndex = { s: 1, f: 2, r: 3, x: 4, j: 5 }[toneKey] ?? 0
  if (!toneIndex) return null
  const chars = [...text]
  const vowels: number[] = []
  for (let index = 0; index < chars.length; index += 1) {
    if (vowelBase(chars[index])) vowels.push(index)
  }
  if (!vowels.length) return null
  let at = vowels[0]
  if (vowels.length > 1) {
    const strong = vowels.filter((index) => STRONG_VOWELS.has(vowelBase(chars[index])))
    const horn = vowels.filter((index) => vowelBase(chars[index]) === 'ư')
    if (strong.length) at = strong[strong.length - 1]
    else if (horn.length) at = horn[horn.length - 1]
    else {
      const last = vowels[vowels.length - 1]
      const pair = vowelBase(chars[vowels[0]]) + vowelBase(chars[vowels[1]])
      const oaBeforeConsonant =
        vowels.length === 2 && last < chars.length - 1 && (pair === 'oa' || pair === 'oe' || pair === 'uy')
      at = oaBeforeConsonant ? vowels[1] : vowels[0]
    }
  }
  const base = vowelBase(chars[at])
  const row = TONE_ROWS[base]
  if (!row) return null
  chars[at] = [...row][toneIndex] ?? chars[at]
  return chars.join('')
}

function applyTelexW(text: string): string | null {
  const chars = [...text]
  const vowels: number[] = []
  for (let index = 0; index < chars.length; index += 1) {
    if (vowelBase(chars[index])) vowels.push(index)
  }
  if (!vowels.length) return null
  const last = vowels[vowels.length - 1]
  const prev = vowels.length > 1 ? vowels[vowels.length - 2] : -1
  const lastBase = vowelBase(chars[last])
  const prevBase = prev >= 0 ? vowelBase(chars[prev]) : ''
  if ((prevBase === 'u' || prevBase === 'ư') && (lastBase === 'o' || lastBase === 'ô' || lastBase === 'ơ')) {
    chars[prev] = 'ư'
    chars[last] = 'ơ'
    return chars.join('')
  }
  if (lastBase === 'a') chars[last] = 'ă'
  else if (lastBase === 'o') chars[last] = 'ơ'
  else if (lastBase === 'u') chars[last] = 'ư'
  else return null
  return chars.join('')
}

function typeTelex(word: string): string {
  let out = ''
  for (const key of word.toLocaleLowerCase('vi')) {
    if (key === 'w') {
      out = applyTelexW(out) ?? `${out}w`
      continue
    }
    const chars = [...out]
    const last = chars.length ? vowelBase(chars[chars.length - 1]) || stripToneMark(chars[chars.length - 1]).toLocaleLowerCase('vi') : ''
    if ((key === 'a' || key === 'e' || key === 'o' || key === 'd') && last === key) {
      chars[chars.length - 1] = { a: 'â', e: 'ê', o: 'ô', d: 'đ' }[key] ?? key
      out = chars.join('')
      continue
    }
    if ('sfrxj'.includes(key)) {
      const toned = applyTelexTone(out, key)
      if (toned) {
        out = toned
        continue
      }
    }
    out += key
  }
  return out
}

function decodeTelexWord(word: string): string {
  if (!word || /[^\u0000-\u007f]/.test(word)) return word
  if (!/(dd|aa|ee|oo|aw|ow|uw|w|[sfrxj]$)/i.test(word)) return word
  const decoded = typeTelex(word)
  if (!decoded) return word
  const first = word.charAt(0)
  if (first !== first.toLocaleLowerCase('vi')) {
    return decoded.charAt(0).toLocaleUpperCase('vi') + decoded.slice(1)
  }
  return decoded
}

function prepareGuestChunk(raw: string): string {
  return raw
    .replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2')
    .replace(/[/|+·]+/g, ' ')
    .replace(/[!?…"'“”‘’()[\]{}]+/g, ' ')
    .replace(/[.]+(?=\s|$)/g, ' ')
    .split(/\s+/)
    .map((word) => decodeTelexWord(word))
    .filter(Boolean)
    .join(' ')
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

function honorificWordCountAt(foldedWords: string[], index: number): number {
  for (const match of HONORIFIC_MATCHES) {
    const len = match.folded.length
    if (index + len >= foldedWords.length) continue
    if (foldedWords.slice(index, index + len).join(' ') !== match.folded.join(' ')) continue
    return len
  }
  return 0
}

/** «bạn Hoa Bạn Mai Bạn Lương» → ba cụm, mỗi cụm một danh xưng. */
export function splitGluedHonorificGuests(raw: string): string[] {
  let compact = prepareGuestChunk(raw)
    .replace(/^[\s\-*•]+/, '')
    .replace(/^\d+\s*[.)-]\s*/, '')
    .replace(/[.;,]+$/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^quý\s+/iu, '')
  let previous = ''
  while (compact && compact !== previous) {
    previous = compact
    compact = compact.replace(/^(mời|thêm|cùng|với|còn|rồi|và|kèm|gồm)\s+/iu, '').trim()
  }
  if (!compact) return []
  const words = compact.split(' ')
  const foldedWords = words.map((word) => foldHonorificToken(word))
  const starts: number[] = []
  for (let index = 0; index < foldedWords.length; index += 1) {
    const len = honorificWordCountAt(foldedWords, index)
    if (!len) continue
    starts.push(index)
    index += len - 1
  }
  if (starts.length <= 1) return [compact]
  return starts
    .map((start, position) => {
      const end = position + 1 < starts.length ? starts[position + 1] : words.length
      return words
        .slice(start, end)
        .filter((word) => !/^\d+[.)-]?$/.test(word))
        .join(' ')
        .trim()
    })
    .filter(Boolean)
}

/** Tách một dòng thành danh xưng + tên. Thiếu danh xưng hoặc thiếu tên thì loại. */
export function parseWeddingGuestBulkLine(raw: string): WeddingGuestBulkName | WeddingGuestBulkReject | null {
  let compact = prepareGuestChunk(raw)
    .replace(/^[\s\-*•]+/, '')
    .replace(/^\d+\s*[.)-]\s*/, '')
    .replace(/[.;,]+$/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^quý\s+/iu, '')
  let previous = ''
  while (compact && compact !== previous) {
    previous = compact
    compact = compact.replace(/^(mời|thêm|cùng|với|còn|rồi|và|kèm|gồm)\s+/iu, '').trim()
  }
  if (!compact) return null
  const words = compact.split(' ')
  const foldedWords = words.map((word) => foldHonorificToken(word)).filter(Boolean)
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
    .flatMap((part) => part.split(/\s+(?:cùng với|cùng|với|và)\s+/iu))
    .flatMap((part) => splitGluedHonorificGuests(part))
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

/** Ghép kết quả AI đã tách thành khách, rồi kiểm lại danh xưng. */
export function weddingGuestsFromArrangedRows(rows: unknown[]): {
  guests: WeddingGuestBulkName[]
  rejected: WeddingGuestBulkReject[]
} {
  const guests: WeddingGuestBulkName[] = []
  const rejected: WeddingGuestBulkReject[] = []
  const seen = new Set<string>()

  for (const row of rows.slice(0, WEDDING_GUEST_BULK_MAX_LINES)) {
    let line = ''
    if (typeof row === 'string') line = row
    else if (row && typeof row === 'object') {
      const record = row as { honorific?: unknown; name?: unknown }
      line = `${String(record.honorific ?? '')} ${String(record.name ?? '')}`.trim()
    }
    const parsed = parseWeddingGuestBulkText(line)
    for (const guest of parsed.guests) {
      const key = weddingGuestBulkNameKey(guest.honorific, guest.name)
      if (seen.has(key)) continue
      seen.add(key)
      guests.push(guest)
    }
    rejected.push(...parsed.rejected)
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
