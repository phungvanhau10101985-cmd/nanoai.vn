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
