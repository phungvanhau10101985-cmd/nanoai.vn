import { createHash } from 'crypto'
import {
  applySharedReadings,
  missingReadingTexts,
  readingLanguageCode,
  type CoachExample,
  type CoachSense,
} from '@/lib/coach-reading'
import { fetchTransliterationCacheByKeysPg, upsertTransliterationCachePg } from '@/lib/db/language-coach-transliteration-tokenize-pg'
import { usableSentenceReading } from '@/lib/coach-reading'

export async function storeSentenceReadingsIfMissing(
  code: string,
  pairs: Array<{ text: string; reading: string }>
): Promise<void> {
  if (!code || pairs.length === 0) return
  const clean = pairs
    .map((pair) => ({
      text: String(pair.text || '').trim(),
      reading: usableSentenceReading(code, pair.reading),
    }))
    .filter((pair) => pair.text && pair.reading)
  if (clean.length === 0) return
  const existing = await sharedReadingsByText(code, clean.map((pair) => pair.text))
  const nowIso = new Date().toISOString()
  await Promise.all(clean.filter((pair) => !existing.has(pair.text)).map((pair) => upsertTransliterationCachePg({
    cacheKey: transliterationCacheKey(code, pair.text),
    languageCode: code,
    transliteration: pair.reading,
    nowIso,
  })))
}

export function transliterationCacheKey(languageCode: string, text: string): string {
  const hash = createHash('sha256').update(String(text || '').trim()).digest('hex')
  return `${languageCode}:${hash}`
}

export async function sharedReadingsByText(
  code: string,
  texts: string[]
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(texts.map((text) => String(text || '').trim()).filter(Boolean)))
  const out = new Map<string, string>()
  if (!code || unique.length === 0) return out
  const keyByText = new Map(unique.map((text) => [transliterationCacheKey(code, text), text]))
  const rows = await fetchTransliterationCacheByKeysPg(Array.from(keyByText.keys()))
  for (const row of rows) {
    const text = keyByText.get(row.cache_key)
    const reading = String(row.transliteration || '').trim()
    if (text && reading) out.set(text, reading)
  }
  return out
}

export async function fillSharedSentenceReadings<T extends {
  targetLanguage?: string | null
  senses: CoachSense[]
  exampleItems: CoachExample[]
}>(items: T[]): Promise<Array<T & { readingsChanged: boolean }>> {
  const jobs: Array<{ index: number; code: string; text: string }> = []
  items.forEach((item, index) => {
    const code = readingLanguageCode(String(item.targetLanguage || ''))
    if (!code) return
    for (const text of missingReadingTexts(code, item.senses, item.exampleItems)) {
      jobs.push({ index, code, text })
    }
  })
  const byCode = new Map<string, string[]>()
  for (const job of jobs) {
    const list = byCode.get(job.code) || []
    list.push(job.text)
    byCode.set(job.code, list)
  }
  const readings = new Map<string, Map<string, string>>()
  await Promise.all(Array.from(byCode.entries()).map(async ([code, texts]) => {
    readings.set(code, await sharedReadingsByText(code, texts))
  }))
  return items.map((item, index) => {
    const code = readingLanguageCode(String(item.targetLanguage || ''))
    if (!code) return { ...item, readingsChanged: false }
    const filled = applySharedReadings(code, item.senses, item.exampleItems, readings.get(code) || new Map())
    const touched = jobs.some((job) => job.index === index) && filled.changed
    return {
      ...item,
      senses: filled.senses,
      exampleItems: filled.examples,
      readingsChanged: touched || filled.changed,
    }
  })
}
