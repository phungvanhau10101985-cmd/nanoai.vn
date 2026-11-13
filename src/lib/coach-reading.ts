export type CoachSense = {
  gloss: string
  exampleTarget: string
  exampleNative: string
  examplePinyin?: string
}

export type CoachExample = {
  targetText: string
  targetPinyin?: string
  nativeText: string
}

export function readingLanguageCode(input: string): 'zh' | 'ja' | 'ko' | 'th' | 'hi' | 'en' | '' {
  const value = String(input || '').trim().toLowerCase()
  if (!value) return ''
  if (value === 'zh' || value.includes('chinese') || value.includes('mandarin')) return 'zh'
  if (value === 'ja' || value.includes('japanese')) return 'ja'
  if (value === 'ko' || value.includes('korean')) return 'ko'
  if (value === 'th' || value.includes('thai')) return 'th'
  if (value === 'hi' || value.includes('hindi')) return 'hi'
  if (value === 'en' || value.includes('english')) return 'en'
  return ''
}

const TONE_MARK = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüńňǹḿĀÁǍÀĒÉĚÈĪÍǏÌŌÓǑÒŪÚǓÙǕǗǙǛŃŇǸḾ]/u
const ENGLISH_ASIDE =
  /(?:looks correct|here is the pinyin|here's the pinyin|the pinyin is|pinyin is|here is the pronunciation|the pronunciation is)/gi

/** Pinyin / romaji đọc được. Bỏ câu tiếng Anh dính vào, ví dụ "Looks correct." */
export function stripReadingCommentary(value: string): string {
  let text = String(value || '')
    .normalize('NFC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[*_`#>]+/g, ' ')
    .replace(/[“”«»"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return ''
  text = text.replace(/^(?:pinyin|phiên âm|phát âm|pronunciation|romaji|romanization)\s*[:：]\s*/i, '')
  text = text.replace(new RegExp(`${ENGLISH_ASIDE.source}[\\s:：.,;!\\-—–。．…]*`, 'gi'), ' ')
  text = text.replace(/\s+/g, ' ').trim()
  if (TONE_MARK.test(text)) {
    const index = text.search(TONE_MARK)
    const head = text.slice(0, index)
    const tail = text.slice(index)
    const onset = head.match(/[A-Za-z]*$/)?.[0] || ''
    const prefix = head.slice(0, head.length - onset.length).trim()
    if (prefix && /[.!?。．:]|\b(?:the|this|that|here|correct|pinyin|pronunciation|looks)\b/i.test(prefix)) {
      text = `${onset}${tail}`.replace(/\s+/g, ' ').trim()
    }
  }
  return text.trim()
}

export function usableSentenceReading(code: string, value: string): string {
  const text = stripReadingCommentary(value)
  if (!text) return ''
  if (code === 'zh' && (/[ăơưđĂƠƯĐ]/.test(text) || text.includes('-'))) return ''
  return text
}

const READING_UNIT = /[\u4E00-\u9FFF\u3040-\u30FF\u30FB\u3005\uAC00-\uD7AF\u0E00-\u0E7F\u0900-\u097F]/u
const LATIN_UNIT = /[A-Za-z\u00C0-\u024F]/

/** Chữ hoặc từ có một âm. Bỏ dấu câu và khoảng trắng. */
export function pronunciationUnits(text: string): string[] {
  const units: string[] = []
  let latin = ''
  const flushLatin = () => {
    const word = latin.trim().toLowerCase()
    if (word) units.push(word)
    latin = ''
  }
  for (const ch of String(text || '').normalize('NFC')) {
    if (LATIN_UNIT.test(ch) || (latin && ch === "'")) {
      latin += ch
      continue
    }
    flushLatin()
    if (READING_UNIT.test(ch)) units.push(ch)
  }
  flushLatin()
  return units
}

function readingTokens(reading: string): string[] {
  return stripReadingCommentary(reading)
    .split(/\s+/)
    .map((token) => token.replace(/^[，。！？、；：,.!?;:/]+|[，。！？、；：,.!?;:/]+$/g, ''))
    .filter(Boolean)
}

export type PairedReadingPart =
  | { kind: 'gap'; text: string }
  | { kind: 'pair'; text: string; reading: string }

const HAN_CHAR = /[\u4E00-\u9FFF]/u
const KANA_CHAR = /[\u3040-\u30FF\u30FB\u3005]/u
const HANGUL_CHAR = /[\uAC00-\uD7AF]/u
const THAI_CHAR = /[\u0E00-\u0E7F]/u
const DEVA_CHAR = /[\u0900-\u097F]/u

function scriptKind(ch: string): 'han' | 'kana' | 'hangul' | 'thai' | 'deva' | 'latin' | '' {
  if (HAN_CHAR.test(ch)) return 'han'
  if (KANA_CHAR.test(ch)) return 'kana'
  if (HANGUL_CHAR.test(ch)) return 'hangul'
  if (THAI_CHAR.test(ch)) return 'thai'
  if (DEVA_CHAR.test(ch)) return 'deva'
  if (LATIN_UNIT.test(ch)) return 'latin'
  return ''
}

type ReadingChunk = { gapBefore: string; text: string }

function readingChunks(text: string, mode: 'char' | 'word'): { chunks: ReadingChunk[]; tail: string } {
  const chars = Array.from(String(text || '').normalize('NFC'))
  const chunks: ReadingChunk[] = []
  let gap = ''
  let index = 0
  while (index < chars.length) {
    const kind = scriptKind(chars[index])
    if (!kind) {
      gap += chars[index]
      index += 1
      continue
    }
    let token = ''
    if (kind === 'latin') {
      while (index < chars.length && (scriptKind(chars[index]) === 'latin' || (token && chars[index] === "'"))) {
        token += chars[index]
        index += 1
      }
    } else if (mode === 'char') {
      token = chars[index]
      index += 1
    } else {
      while (index < chars.length && scriptKind(chars[index]) === kind) {
        token += chars[index]
        index += 1
      }
    }
    chunks.push({ gapBefore: gap, text: token })
    gap = ''
  }
  return { chunks, tail: gap }
}

function sameReading(text: string, reading: string): boolean {
  return text.localeCompare(reading, undefined, { sensitivity: 'accent' }) === 0
}

/** Ghép mỗi từ hoặc mỗi chữ với một âm: I(aɪ), 今(jīn). Không khớp số âm thì gom cả cụm. */
export function pairedReading(source: string, reading: string): PairedReadingPart[] {
  const tokens = readingTokens(reading)
  if (!tokens.length) return []
  const raw = String(source || '').normalize('NFC')
  if (!raw.trim()) return [{ kind: 'pair', text: '', reading: tokens.join(' ') }]

  const charSplit = readingChunks(raw, 'char')
  const wordSplit = readingChunks(raw, 'word')
  let chosen = charSplit.chunks.length === tokens.length
    ? charSplit
    : wordSplit.chunks.length === tokens.length
      ? wordSplit
      : null
  let readings = tokens
  if (!chosen && wordSplit.chunks.length === 1) {
    chosen = wordSplit
    readings = [tokens.join('')]
  }
  if (!chosen) return [{ kind: 'pair', text: '', reading: tokens.join(' ') }]

  const parts: PairedReadingPart[] = []
  chosen.chunks.forEach((chunk, index) => {
    const kind = scriptKind(Array.from(chunk.text)[0] || '')
    if (!chunk.gapBefore && index > 0 && kind && kind !== 'latin') parts.push({ kind: 'gap', text: ' ' })
    else if (chunk.gapBefore) parts.push({ kind: 'gap', text: chunk.gapBefore })
    const phonetic = readings[index] || ''
    parts.push({
      kind: 'pair',
      text: chunk.text,
      reading: sameReading(chunk.text, phonetic) ? '' : phonetic,
    })
  })
  if (chosen.tail) parts.push({ kind: 'gap', text: chosen.tail })
  return parts
}

function sameUnits(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false
  return left.every((unit, index) => unit === right[index])
}

function isPrefixUnits(source: string[], kept: string[]): boolean {
  if (!kept.length || kept.length > source.length) return false
  return kept.every((unit, index) => unit === source[index])
}

function hanMajority(text: string): boolean {
  const units = pronunciationUnits(text)
  if (!units.length) return false
  const han = units.filter((unit) => /^[\u4E00-\u9FFF]$/u.test(unit)).length
  return han * 2 >= units.length
}

/**
 * Giữ các âm của đúng những chữ còn trong câu đã cắt.
 * Câu nguồn và câu cắt phải cùng thứ tự chữ. Không đoán khi số âm không khớp số chữ.
 */
export function alignReadingToCut(sourceText: string, sourceReading: string, keptText: string): string {
  const tokens = readingTokens(sourceReading)
  const sourceUnits = pronunciationUnits(sourceText)
  const keptUnits = pronunciationUnits(keptText)
  if (!tokens.length || !keptUnits.length || !sourceUnits.length) return ''
  if (sameUnits(sourceUnits, keptUnits)) {
    return tokens.length === keptUnits.length ? tokens.join(' ') : ''
  }
  if (tokens.length !== sourceUnits.length) return ''
  if (isPrefixUnits(sourceUnits, keptUnits)) return tokens.slice(0, keptUnits.length).join(' ')
  const keptTokens: string[] = []
  let cursor = 0
  for (let index = 0; index < sourceUnits.length && cursor < keptUnits.length; index += 1) {
    if (sourceUnits[index] !== keptUnits[cursor]) continue
    keptTokens.push(tokens[index])
    cursor += 1
  }
  if (cursor !== keptUnits.length) return ''
  return keptTokens.join(' ')
}

/** Pinyin hiển thị dưới câu đã cắt. Ưu tiên bản đúng số chữ; nếu bản đang có còn thừa âm thì cắt theo câu nguồn. */
export function readingForCutSentence(
  keptText: string,
  ownReading: string,
  sources: Array<{ text?: string; reading?: string }>
): string {
  const keptUnits = pronunciationUnits(keptText)
  const own = stripReadingCommentary(ownReading).replace(/\s+/g, ' ').trim()
  const ownTokens = readingTokens(own)
  if (!keptUnits.length) return own
  if (ownTokens.length === keptUnits.length) return ownTokens.join(' ')

  let best = ''
  let bestExtra = Number.POSITIVE_INFINITY
  const attempts: Array<{ text: string; reading: string }> = []
  for (const source of sources) {
    const text = String(source.text || '').trim()
    if (!text) continue
    const reading = stripReadingCommentary(String(source.reading || '')).trim()
    if (reading) attempts.push({ text, reading })
    if (own && ownTokens.length > keptUnits.length) attempts.push({ text, reading: own })
  }
  if (own) attempts.push({ text: keptText, reading: own })
  for (const attempt of attempts) {
    const sliced = alignReadingToCut(attempt.text, attempt.reading, keptText)
    if (!sliced) continue
    const sourceUnits = pronunciationUnits(attempt.text)
    const prefix = sameUnits(sourceUnits, keptUnits) || isPrefixUnits(sourceUnits, keptUnits)
    const extra = sourceUnits.length - keptUnits.length + (prefix ? 0 : 10000)
    if (extra < 0 || extra >= bestExtra) continue
    best = sliced
    bestExtra = extra
  }
  if (best) return best
  const prefixSource = sources.some((source) => isPrefixUnits(pronunciationUnits(String(source.text || '')), keptUnits))
  if (ownTokens.length > keptUnits.length && prefixSource && hanMajority(keptText)) {
    return ownTokens.slice(0, keptUnits.length).join(' ')
  }
  return own
}

/** Khi câu hiển thị ngắn hơn câu gốc, chỉ giữ pinyin của phần còn lại. */
export function readingStoredForShownText(rawText: string, shownText: string, reading: string): string {
  const clean = stripReadingCommentary(reading).replace(/\s+/g, ' ').trim()
  const shown = String(shownText || '').trim()
  if (!shown || !clean) return ''
  const aligned = alignReadingToCut(rawText || shown, clean, shown)
  if (aligned) return aligned
  const rawUnits = pronunciationUnits(rawText || shown)
  const shownUnits = pronunciationUnits(shown)
  if (shownUnits.length > 0 && rawUnits.length !== shownUnits.length) return ''
  return clean
}

export function syncCoachReadings<S extends CoachSense, E extends CoachExample>(
  code: string,
  senses: S[],
  examples: E[]
): { senses: S[]; examples: E[] } {
  const byText = new Map<string, string>()
  for (const example of examples) {
    const text = String(example.targetText || '').trim()
    const reading = usableSentenceReading(code, String(example.targetPinyin || ''))
    if (text && reading) byText.set(text, reading)
  }
  for (const sense of senses) {
    const text = String(sense.exampleTarget || '').trim()
    const reading = usableSentenceReading(code, String(sense.examplePinyin || ''))
    if (text && reading && !byText.has(text)) byText.set(text, reading)
  }
  return {
    senses: senses.map((sense) => {
      const text = String(sense.exampleTarget || '').trim()
      const reading = usableSentenceReading(code, String(sense.examplePinyin || '')) || byText.get(text) || ''
      return reading ? { ...sense, examplePinyin: reading } : sense
    }),
    examples: examples.map((example) => {
      const text = String(example.targetText || '').trim()
      const reading = usableSentenceReading(code, String(example.targetPinyin || '')) || byText.get(text) || ''
      return reading ? { ...example, targetPinyin: reading } : example
    }),
  }
}

export function missingReadingTexts(code: string, senses: CoachSense[], examples: CoachExample[]): string[] {
  const known = new Set<string>()
  const missing: string[] = []
  const seen = new Set<string>()
  const remember = (text: string, reading: string) => {
    const value = String(text || '').trim()
    if (!value || seen.has(value)) return
    seen.add(value)
    if (usableSentenceReading(code, reading)) known.add(value)
    else missing.push(value)
  }
  for (const example of examples) remember(example.targetText, String(example.targetPinyin || ''))
  for (const sense of senses) remember(sense.exampleTarget, String(sense.examplePinyin || ''))
  return missing.filter((text) => !known.has(text))
}

export function applySharedReadings<S extends CoachSense, E extends CoachExample>(
  code: string,
  senses: S[],
  examples: E[],
  readingsByText: Map<string, string>
): { senses: S[]; examples: E[]; changed: boolean } {
  const before = JSON.stringify({ senses, examples })
  const seeded = syncCoachReadings(code, senses, examples)
  const withCache = syncCoachReadings(
    code,
    seeded.senses.map((sense) => ({
      ...sense,
      examplePinyin: sense.examplePinyin || readingsByText.get(String(sense.exampleTarget || '').trim()) || '',
    })),
    seeded.examples.map((example) => ({
      ...example,
      targetPinyin: example.targetPinyin || readingsByText.get(String(example.targetText || '').trim()) || '',
    }))
  )
  return { ...withCache, changed: JSON.stringify(withCache) !== before }
}
