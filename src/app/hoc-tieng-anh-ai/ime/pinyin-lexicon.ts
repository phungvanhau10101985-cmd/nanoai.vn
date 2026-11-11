import { PINYIN_LEXICON_PACK, PINYIN_SYLLABLES } from './pinyin-lexicon-data'

export type PinyinWord = { text: string; freq: number; py: string }

export type PinyinLexicon = {
  byPy: Map<string, PinyinWord[]>
  byPrefix: Map<string, PinyinWord[]>
  logTotal: number
  syllables: readonly string[]
}

// Phrases the stock list misses. Frequencies sit below the common homophone
// so the frequent reading stays first, and the phrase still appears beside it.
const EXTRA: Array<[string, string, number]> = [
  ['jintian', '金田', 8000],
  ['dengjikou', '登机口', 9000],
]

let cache: PinyinLexicon | null = null

export function getPinyinLexicon(): PinyinLexicon {
  if (cache) return cache
  const byPy = new Map<string, PinyinWord[]>()
  let total = 0
  for (const line of PINYIN_LEXICON_PACK.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const parts = trimmed.split(' ')
    const py = parts[0]
    if (!py) continue
    const words: PinyinWord[] = []
    for (let i = 1; i + 1 < parts.length; i += 2) {
      const freq = Number(parts[i + 1])
      if (!parts[i] || !Number.isFinite(freq) || freq <= 0) continue
      words.push({ text: parts[i], freq, py })
      total += freq
    }
    if (!words.length) continue
    words.sort((a, b) => b.freq - a.freq)
    byPy.set(py, words)
  }
  for (const [py, text, freq] of EXTRA) {
    const list = byPy.get(py) || []
    if (!list.some((word) => word.text === text)) {
      list.push({ text, freq, py })
      list.sort((a, b) => b.freq - a.freq)
      byPy.set(py, list)
      total += freq
    }
  }
  const byPrefix = new Map<string, PinyinWord[]>()
  for (const words of byPy.values()) {
    for (const word of words) {
      if (word.py.length < 2 || word.freq < 80) continue
      const key = word.py.slice(0, 2)
      const bucket = byPrefix.get(key)
      if (bucket) bucket.push(word)
      else byPrefix.set(key, [word])
    }
  }
  for (const bucket of byPrefix.values()) bucket.sort((a, b) => b.freq - a.freq)
  cache = { byPy, byPrefix, logTotal: Math.log(total), syllables: PINYIN_SYLLABLES }
  return cache
}
