import type { KanaLexicon } from './kana-lexicon'
import type { PinyinLexicon, PinyinWord } from './pinyin-lexicon'

let pinyinLexicon: PinyinLexicon | null = null
let pinyinLexiconLoad: Promise<PinyinLexicon> | null = null
let kanaLexicon: KanaLexicon | null = null
let kanaLexiconLoad: Promise<KanaLexicon> | null = null

export function primePinyinLexicon(): Promise<PinyinLexicon> {
  if (pinyinLexicon) return Promise.resolve(pinyinLexicon)
  if (!pinyinLexiconLoad) {
    pinyinLexiconLoad = import('./pinyin-lexicon').then((mod) => {
      const loaded = mod.getPinyinLexicon()
      pinyinLexicon = loaded
      return loaded
    })
  }
  return pinyinLexiconLoad
}

export function primeKanaLexicon(): Promise<KanaLexicon> {
  if (kanaLexicon) return Promise.resolve(kanaLexicon)
  if (!kanaLexiconLoad) {
    kanaLexiconLoad = import('./kana-lexicon').then((mod) => {
      const loaded = mod.getKanaLexicon()
      kanaLexicon = loaded
      return loaded
    })
  }
  return kanaLexiconLoad
}

export type HangulState = { cho: number | null; jung: number | null; jong: number | null }

export type ImeSession = {
  raw: string
  hangul: HangulState
}

export type ImeStep = {
  session: ImeSession
  commit: string
  replace: number
}

const EMPTY_HANGUL: HangulState = { cho: null, jung: null, jong: null }

export function emptyImeSession(): ImeSession {
  return { raw: '', hangul: { ...EMPTY_HANGUL } }
}

export function imeIsEmpty(session: ImeSession): boolean {
  return !session.raw && session.hangul.cho == null && session.hangul.jung == null && session.hangul.jong == null
}

const PINYIN_WORD_LIMIT = 20
const PINYIN_CANDIDATE_LIMIT = 9

function normalizePinyinRaw(raw: string): string {
  return raw.toLowerCase().replace(/ü/g, 'v')
}

function wordCost(freq: number, logTotal: number): number {
  return logTotal - Math.log(Math.max(1, freq))
}

let pinyinSyllables: Set<string> | null = null

function pinyinSyllableSet(lexicon: PinyinLexicon): Set<string> {
  if (!pinyinSyllables) pinyinSyllables = new Set(lexicon.syllables)
  return pinyinSyllables
}

function wordForSlice(slice: string, lexicon: PinyinLexicon): PinyinWord | null {
  if (!slice.includes("'")) return lexicon.byPy.get(slice)?.[0] || null
  const parts = slice.split("'")
  if (parts.some((part) => !part)) return null
  const syllables = pinyinSyllableSet(lexicon)
  if (parts.some((part) => !syllables.has(part))) return null
  const words = lexicon.byPy.get(parts.join(''))
  return words?.find((word) => [...word.text].length === parts.length) || null
}

type PinyinPath = { text: string; cost: number }

function segmentPinyin(raw: string, lexicon: PinyinLexicon): Array<PinyinPath | undefined> {
  const dp: Array<PinyinPath | undefined> = Array(raw.length + 1)
  dp[0] = { text: '', cost: 0 }
  for (let i = 0; i < raw.length; i += 1) {
    const state = dp[i]
    if (!state) continue
    if (raw[i] === "'") {
      if (!dp[i + 1] || state.cost < dp[i + 1].cost) dp[i + 1] = { text: state.text, cost: state.cost }
      continue
    }
    const limit = Math.min(PINYIN_WORD_LIMIT, raw.length - i)
    for (let len = 1; len <= limit; len += 1) {
      const word = wordForSlice(raw.slice(i, i + len), lexicon)
      if (!word) continue
      const cost = state.cost + wordCost(word.freq, lexicon.logTotal)
      const next = i + len
      if (!dp[next] || cost < dp[next].cost) dp[next] = { text: state.text + word.text, cost }
    }
  }
  return dp
}

function bestPrediction(raw: string, dp: Array<PinyinPath | undefined>, lexicon: PinyinLexicon): PinyinPath | null {
  let best: PinyinPath | null = null
  for (let i = 0; i < raw.length; i += 1) {
    const state = dp[i]
    if (!state) continue
    const rest = raw.slice(i)
    if (rest.length < 2) continue
    const bucket = lexicon.byPrefix.get(rest.slice(0, 2))
    if (!bucket) continue
    for (const word of bucket) {
      if (word.py.length <= rest.length || !word.py.startsWith(rest)) continue
      const cost = state.cost + wordCost(word.freq, lexicon.logTotal)
      if (!best || cost < best.cost) best = { text: state.text + word.text, cost }
      break
    }
  }
  return best
}

type ZhCandidate = { text: string; eat: number }

function zhCandidates(rawInput: string): ZhCandidate[] {
  const raw = normalizePinyinRaw(rawInput)
  if (!raw) return []
  const lexicon = pinyinLexicon
  if (!lexicon) return []
  const dp = segmentPinyin(raw, lexicon)
  const exact = dp[raw.length]
  const predicted = raw.includes("'") ? null : bestPrediction(raw, dp, lexicon)
  const list: ZhCandidate[] = []
  const seen = new Set<string>()
  const push = (text: string, eat: number) => {
    const value = String(text || '')
    if (!value || seen.has(value)) return
    seen.add(value)
    list.push({ text: value, eat })
  }
  const predictFirst = Boolean(predicted && (!exact || predicted.cost < exact.cost))
  if (predictFirst && predicted) push(predicted.text, raw.length)
  if (exact) push(exact.text, raw.length)
  const head = raw.split("'")[0]
  const prefixes: PinyinWord[] = []
  const limit = Math.min(PINYIN_WORD_LIMIT, head.length)
  for (let len = limit; len >= 1; len -= 1) {
    const words = lexicon.byPy.get(head.slice(0, len))
    if (!words) continue
    for (const word of words) prefixes.push(word)
  }
  prefixes.sort((a, b) => b.py.length - a.py.length || b.freq - a.freq)
  for (const word of prefixes) push(word.text, word.py.length)
  return list.slice(0, PINYIN_CANDIDATE_LIMIT)
}

function commitZh(rawInput: string, index: number): { commit: string; raw: string } {
  const raw = normalizePinyinRaw(rawInput)
  const picks = zhCandidates(raw)
  const pick = picks[index]
  if (!pick) return { commit: '', raw }
  return { commit: pick.text, raw: raw.slice(Math.max(0, Math.min(raw.length, pick.eat))) }
}

const KANA: Record<string, string> = {
  a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お',
  ka: 'か', ki: 'き', ku: 'く', ke: 'け', ko: 'こ',
  ga: 'が', gi: 'ぎ', gu: 'ぐ', ge: 'げ', go: 'ご',
  sa: 'さ', shi: 'し', su: 'す', se: 'せ', so: 'そ',
  si: 'し',
  za: 'ざ', ji: 'じ', zu: 'ず', ze: 'ぜ', zo: 'ぞ',
  zi: 'じ',
  ta: 'た', chi: 'ち', tsu: 'つ', te: 'て', to: 'と',
  ti: 'ち', tu: 'つ',
  da: 'だ', di: 'ぢ', du: 'づ', de: 'で', do: 'ど',
  na: 'な', ni: 'に', nu: 'ぬ', ne: 'ね', no: 'の',
  ha: 'は', hi: 'ひ', fu: 'ふ', he: 'へ', ho: 'ほ',
  hu: 'ふ',
  ba: 'ば', bi: 'び', bu: 'ぶ', be: 'べ', bo: 'ぼ',
  pa: 'ぱ', pi: 'ぴ', pu: 'ぷ', pe: 'ぺ', po: 'ぽ',
  ma: 'ま', mi: 'み', mu: 'む', me: 'め', mo: 'も',
  ya: 'や', yu: 'ゆ', yo: 'よ',
  ra: 'ら', ri: 'り', ru: 'る', re: 'れ', ro: 'ろ',
  wa: 'わ', wo: 'を',
  kya: 'きゃ', kyu: 'きゅ', kyo: 'きょ',
  gya: 'ぎゃ', gyu: 'ぎゅ', gyo: 'ぎょ',
  sha: 'しゃ', shu: 'しゅ', sho: 'しょ',
  sya: 'しゃ', syu: 'しゅ', syo: 'しょ',
  ja: 'じゃ', ju: 'じゅ', jo: 'じょ',
  cha: 'ちゃ', chu: 'ちゅ', cho: 'ちょ',
  tya: 'ちゃ', tyu: 'ちゅ', tyo: 'ちょ',
  nya: 'にゃ', nyu: 'にゅ', nyo: 'にょ',
  hya: 'ひゃ', hyu: 'ひゅ', hyo: 'ひょ',
  bya: 'びゃ', byu: 'びゅ', byo: 'びょ',
  pya: 'ぴゃ', pyu: 'ぴゅ', pyo: 'ぴょ',
  mya: 'みゃ', myu: 'みゅ', myo: 'みょ',
  rya: 'りゃ', ryu: 'りゅ', ryo: 'りょ',
  fa: 'ふぁ', fi: 'ふぃ', fe: 'ふぇ', fo: 'ふぉ',
}

const KANA_KEYS = Object.keys(KANA).sort((a, b) => b.length - a.length)

const JA_WORDS: Record<string, string> = {
  konnichiwa: 'こんにちは',
  konbanwa: 'こんばんは',
}

type KanaSpan = { kana: number; romaji: number }

function toKana(raw: string): { kana: string; partial: string; spans: KanaSpan[] } {
  const source = raw.toLowerCase()
  const known = JA_WORDS[source]
  if (known) return { kana: known, partial: '', spans: [{ kana: [...known].length, romaji: source.length }] }
  let index = 0
  let kana = ''
  const spans: KanaSpan[] = []
  const push = (text: string, romaji: number) => {
    kana += text
    spans.push({ kana: [...text].length, romaji })
  }
  while (index < source.length) {
    const current = source[index]
    const next = source[index + 1]
    if (current === next && current !== 'n' && /[bcdfghjklmpqrstvwxyz]/.test(current)) {
      push('っ', 1)
      index += 1
      continue
    }
    if (current === 'n') {
      const after = source[index + 1] || ''
      if (!after) return { kana, partial: 'n', spans }
      if (after === 'n') {
        const third = source[index + 2] || ''
        if (third && 'aiueoy'.includes(third)) {
          push('ん', 1)
          index += 1
          continue
        }
        push('ん', 2)
        index += 2
        continue
      }
      if (!'aiueoy'.includes(after)) {
        push('ん', 1)
        index += 1
        continue
      }
    }
    let matched = ''
    for (const key of KANA_KEYS) {
      if (source.startsWith(key, index)) {
        matched = key
        break
      }
    }
    if (matched) {
      push(KANA[matched], matched.length)
      index += matched.length
      continue
    }
    const rest = source.slice(index)
    if (KANA_KEYS.some((key) => key.startsWith(rest))) return { kana, partial: rest, spans }
    push(source[index], 1)
    index += 1
  }
  return { kana, partial: '', spans }
}

function romajiForKana(spans: KanaSpan[], kanaCount: number): number {
  let kana = 0
  let romaji = 0
  for (const span of spans) {
    if (kana >= kanaCount) break
    kana += span.kana
    romaji += span.romaji
  }
  return romaji
}

const JA_SPLIT = 1100
const JA_FALLBACK = 7200
const JA_WORD_LIMIT = 18
const JA_CANDIDATE_LIMIT = 9

type JaPath = { text: string; cost: number; firstEat: number }

function segmentKana(kana: string, lexicon: KanaLexicon): Array<JaPath | undefined> {
  const dp: Array<JaPath | undefined> = Array(kana.length + 1)
  dp[0] = { text: '', cost: 0, firstEat: 0 }
  for (let i = 0; i < kana.length; i += 1) {
    const state = dp[i]
    if (!state) continue
    let any = false
    const limit = Math.min(JA_WORD_LIMIT, kana.length - i)
    for (let len = 1; len <= limit; len += 1) {
      const word = lexicon.get(kana.slice(i, i + len))
      if (!word) continue
      any = true
      const cost = state.cost + word.cost + (i > 0 ? JA_SPLIT : 0)
      const next = i + len
      const firstEat = i === 0 ? len : state.firstEat
      if (!dp[next] || cost < dp[next].cost) dp[next] = { text: state.text + word.surface, cost, firstEat }
    }
    if (!any) {
      const next = i + 1
      const cost = state.cost + JA_FALLBACK
      const firstEat = i === 0 ? 1 : state.firstEat
      if (!dp[next] || cost < dp[next].cost) dp[next] = { text: state.text + kana[i], cost, firstEat }
    }
  }
  return dp
}

type JaCandidate = { text: string; eat: number }

function jaCandidates(kana: string): JaCandidate[] {
  if (!kana) return []
  const eaten = kana.length
  const kata = toKatakana(kana)
  const lexicon = kanaLexicon
  if (!lexicon) {
    return kata === kana ? [{ text: kana, eat: eaten }] : [{ text: kana, eat: eaten }, { text: kata, eat: eaten }]
  }
  const best = segmentKana(kana, lexicon)[kana.length]
  const list: JaCandidate[] = []
  const seen = new Set<string>()
  const push = (text: string, eat: number) => {
    const value = String(text || '')
    if (!value || seen.has(value)) return
    seen.add(value)
    list.push({ text: value, eat })
  }
  if (best) push(best.text, eaten)
  push(kana, eaten)
  if (kata !== kana) push(kata, eaten)
  if (best && best.firstEat > 0) {
    const word = lexicon.get(kana.slice(0, best.firstEat))
    if (word) for (const alt of word.alts) push(alt, best.firstEat)
  }
  return list.slice(0, JA_CANDIDATE_LIMIT)
}

function commitJa(rawInput: string, index: number): { commit: string; raw: string } {
  const parsed = toKana(rawInput)
  if (!parsed.kana) return { commit: '', raw: rawInput }
  const picks = jaCandidates(parsed.kana)
  const pick = picks[index]
  if (!pick) return { commit: '', raw: rawInput }
  const romaji = romajiForKana(parsed.spans, pick.eat)
  return { commit: pick.text, raw: rawInput.toLowerCase().slice(romaji) }
}

function toKatakana(value: string): string {
  return [...value].map((char) => {
    const code = char.codePointAt(0) || 0
    if (code >= 0x3041 && code <= 0x3096) return String.fromCodePoint(code + 0x60)
    return char
  }).join('')
}

const CHO = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']
const JUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ']
const JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']
const CHO_OF: Record<string, number> = { r: 0, R: 1, s: 2, e: 3, E: 4, f: 5, a: 6, q: 7, Q: 8, t: 9, T: 10, d: 11, w: 12, W: 13, c: 14, z: 15, x: 16, v: 17, g: 18 }
const JUNG_OF: Record<string, number> = { k: 0, o: 1, i: 2, O: 3, j: 4, p: 5, u: 6, P: 7, h: 8, y: 12, n: 13, b: 17, m: 18, l: 20 }
const JONG_OF: Record<string, number> = { r: 1, R: 2, s: 4, e: 7, f: 8, a: 16, q: 17, t: 19, T: 20, d: 21, w: 22, c: 23, z: 24, x: 25, v: 26, g: 27 }
const JUNG_COMBO: Record<string, number> = { '8:k': 9, '8:o': 10, '8:l': 11, '13:j': 14, '13:p': 15, '13:l': 16, '18:l': 19 }
const JUNG_BACK: Record<number, number> = { 9: 8, 10: 8, 11: 8, 14: 13, 15: 13, 16: 13, 19: 18 }
const JONG_COMBO: Record<string, number> = { '1:t': 3, '4:w': 5, '4:g': 6, '8:r': 9, '8:a': 10, '8:q': 11, '8:t': 12, '8:x': 13, '8:v': 14, '8:g': 15, '17:t': 18 }
const JONG_BACK: Record<number, number> = { 3: 1, 5: 4, 6: 4, 9: 8, 10: 8, 11: 8, 12: 8, 13: 8, 14: 8, 15: 8, 18: 17 }
const JONG_TO_CHO: Record<number, number> = { 1: 0, 2: 1, 4: 2, 7: 3, 8: 5, 16: 6, 17: 7, 19: 9, 20: 10, 21: 11, 22: 12, 23: 14, 24: 15, 25: 16, 26: 17, 27: 18 }
const JONG_SPLIT_KEEP: Record<number, number> = { 3: 1, 5: 4, 6: 4, 9: 8, 10: 8, 11: 8, 12: 8, 13: 8, 14: 8, 15: 8, 18: 17 }
const JONG_SPLIT_NEXT: Record<number, number> = { 3: 9, 5: 12, 6: 18, 9: 0, 10: 6, 11: 7, 12: 9, 13: 16, 14: 17, 15: 18, 18: 9 }

function composeHangul(state: HangulState): string {
  if (state.cho == null && state.jung == null && state.jong == null) return ''
  if (state.cho == null) {
    return `${state.jung == null ? '' : JUNG[state.jung]}${state.jong ? JONG[state.jong] : ''}`
  }
  if (state.jung == null) return CHO[state.cho]
  return String.fromCharCode(0xac00 + state.cho * 588 + state.jung * 28 + (state.jong || 0))
}

function typeKorean(state: HangulState, key: string): { state: HangulState; commit: string } {
  const cho = CHO_OF[key]
  const jung = JUNG_OF[key]
  const known = cho != null || jung != null || JONG_OF[key] != null
  if (!known) return { state: { ...EMPTY_HANGUL }, commit: composeHangul(state) + key }
  if (state.cho == null && state.jung == null && state.jong == null) {
    if (cho != null) return { state: { cho, jung: null, jong: null }, commit: '' }
    return { state: { cho: null, jung: jung ?? null, jong: null }, commit: '' }
  }
  if (state.jung == null) {
    if (jung != null) return { state: { cho: state.cho, jung, jong: null }, commit: '' }
    return { state: { cho: cho ?? null, jung: null, jong: null }, commit: composeHangul(state) }
  }
  if (!state.jong) {
    const combo = state.jung != null ? JUNG_COMBO[`${state.jung}:${key}`] : undefined
    if (combo != null) return { state: { cho: state.cho, jung: combo, jong: null }, commit: '' }
    const jong = state.cho != null ? JONG_OF[key] : undefined
    if (jong != null) return { state: { cho: state.cho, jung: state.jung, jong }, commit: '' }
    if (jung != null) return { state: { cho: null, jung, jong: null }, commit: composeHangul(state) }
    return { state: { cho: cho ?? null, jung: null, jong: null }, commit: composeHangul(state) }
  }
  const jongCombo = JONG_COMBO[`${state.jong}:${key}`]
  if (jongCombo != null) return { state: { cho: state.cho, jung: state.jung, jong: jongCombo }, commit: '' }
  if (jung != null) {
    const keep = JONG_SPLIT_KEEP[state.jong] || 0
    const nextCho = JONG_SPLIT_NEXT[state.jong] ?? JONG_TO_CHO[state.jong] ?? 0
    return {
      state: { cho: nextCho, jung, jong: null },
      commit: composeHangul({ cho: state.cho, jung: state.jung, jong: keep || null }),
    }
  }
  return { state: { cho: cho ?? null, jung: null, jong: null }, commit: composeHangul(state) }
}

function backspaceKorean(state: HangulState): { state: HangulState; replace: number } {
  if (state.jong) {
    const back = JONG_BACK[state.jong]
    return { state: { ...state, jong: back || null }, replace: 0 }
  }
  if (state.jung != null) {
    const back = JUNG_BACK[state.jung]
    return { state: { ...state, jung: back ?? null }, replace: 0 }
  }
  if (state.cho != null) return { state: { ...EMPTY_HANGUL }, replace: 0 }
  return { state, replace: 1 }
}

const THAI_BASE: Record<string, string> = {
  '`': '_', '1': 'ๅ', '2': '/', '3': '-', '4': 'ภ', '5': 'ถ', '6': 'ุ', '7': 'ึ', '8': 'ค', '9': 'ต', '0': 'จ', '-': 'ข', '=': 'ช',
  q: 'ๆ', w: 'ไ', e: 'ำ', r: 'พ', t: 'ะ', y: 'ั', u: 'ี', i: 'ร', o: 'น', p: 'ย', '[': 'บ', ']': 'ล', '\\': 'ฃ',
  a: 'ฟ', s: 'ห', d: 'ก', f: 'ด', g: 'เ', h: '้', j: '่', k: 'า', l: 'ส', ';': 'ว', "'": 'ง',
  z: 'ผ', x: 'ป', c: 'แ', v: 'อ', b: 'ิ', n: 'ื', m: 'ท', ',': 'ม', '.': 'ใ', '/': 'ฝ',
}
const THAI_SHIFT: Record<string, string> = {
  '~': '%', '!': '+', '@': '๑', '#': '๒', $: '๓', '%': '๔', '^': 'ู', '&': '฿', '*': '๕', '(': '๖', ')': '๗', _: '๘', '+': '๙',
  Q: '๐', W: '"', E: 'ฎ', R: 'ฑ', T: 'ธ', Y: 'ํ', U: '๊', I: 'ณ', O: 'ฯ', P: 'ญ', '{': 'ฐ', '}': ',', '|': 'ฅ',
  A: 'ฤ', S: 'ฆ', D: 'ฏ', F: 'โ', G: 'ฌ', H: '็', J: '๋', K: 'ษ', L: 'ศ', ':': 'ซ', '"': '.',
  Z: '(', X: ')', C: 'ฉ', V: 'ฮ', B: 'ฺ', N: '์', M: '?', '<': 'ฒ', '>': 'ฬ', '?': 'ฦ',
}

const VOWEL_TONE: Record<string, string> = {
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

function stripTone(char: string): { base: string; tone: number; upper: boolean } {
  const lower = char.toLowerCase()
  const upper = lower !== char
  if (lower === 'đ') return { base: 'đ', tone: 0, upper }
  for (const [base, row] of Object.entries(VOWEL_TONE)) {
    const tone = [...row].indexOf(lower)
    if (tone >= 0) return { base, tone, upper }
  }
  return { base: lower, tone: 0, upper }
}

function withTone(base: string, tone: number, upper = false): string {
  const row = VOWEL_TONE[base]
  const marked = row ? [...row][tone] || base : base
  return upper ? marked.toUpperCase() : marked
}

function isViVowel(char: string): boolean {
  return Boolean(char) && Boolean(VOWEL_TONE[stripTone(char).base])
}

const VI_CODAS = ['ch', 'nh', 'ng', 'c', 'm', 'n', 'p', 't']
const VI_CLUSTERS = [
  'a', 'ă', 'â', 'e', 'ê', 'i', 'o', 'ô', 'ơ', 'u', 'ư', 'y',
  'ai', 'ao', 'au', 'ay', 'âu', 'ây', 'eo', 'eu', 'êu',
  'ia', 'ie', 'iê', 'iu', 'oa', 'oă', 'oe', 'oi', 'ôi', 'ơi',
  'ua', 'uâ', 'ue', 'uê', 'ui', 'uo', 'uô', 'uơ', 'uy',
  'ưa', 'ưi', 'ươ', 'ưu',
  'iêu', 'yêu', 'oai', 'oay', 'oeo', 'uay', 'uây', 'uôi', 'uơi', 'ươi', 'ươu',
  'uya', 'uye', 'uyê', 'uyu',
]
const VI_ROOF: Record<string, string> = { a: 'â', e: 'ê', o: 'ô' }
const VI_ROOF_BACK: Record<string, string> = { â: 'a', ê: 'e', ô: 'o' }
const VI_HORN: Record<string, string> = { a: 'ă', o: 'ơ', u: 'ư' }
const VI_HORN_BACK: Record<string, string> = { ă: 'a', ơ: 'o', ư: 'u' }

function clusterOk(bases: string[]): boolean {
  const key = bases.join('')
  return VI_CLUSTERS.some((item) => item === key || item.startsWith(key))
}

function trailingConsonants(chars: string[]): string {
  let cons = ''
  for (let index = chars.length - 1; index >= 0; index -= 1) {
    if (isViVowel(chars[index])) break
    cons = stripTone(chars[index]).base + cons
  }
  return cons
}

function vowelRun(chars: string[]): { indexes: number[]; bases: string[]; coda: string } {
  const cons = trailingConsonants(chars)
  const coda = VI_CODAS.includes(cons) ? cons : ''
  if (cons && !coda) return { indexes: [], bases: [], coda: '' }
  const end = chars.length - cons.length
  const indexes: number[] = []
  for (let index = end - 1; index >= 0 && isViVowel(chars[index]); index -= 1) indexes.unshift(index)
  let bases = indexes.map((index) => stripTone(chars[index]).base)
  const onset = indexes.length ? (indexes[0] > 0 ? stripTone(chars[indexes[0] - 1]).base : '') : ''
  if (bases.length >= 2 && ((onset === 'q' && bases[0] === 'u') || (onset === 'g' && bases[0] === 'i'))) {
    indexes.shift()
    bases = bases.slice(1)
  }
  return { indexes, bases, coda }
}

function toneOffset(bases: string[], terminated: boolean): number {
  if (bases.length <= 1) return 0
  const roof = bases.findIndex((base) => 'âêô'.includes(base))
  if (roof >= 0) return roof
  const hook = bases.findIndex((base) => 'ăơư'.includes(base))
  if (hook >= 0) {
    const joined = bases.join('')
    if (joined === 'ươ' || joined === 'ươi' || joined === 'ươu') return 1
    return hook
  }
  if (bases.length >= 3) return 1
  const joined = bases.join('')
  if (joined === 'oa' || joined === 'oe' || joined === 'uy') return 1
  return terminated ? 0 : 1
}

function markIndex(chars: string[]): number {
  const last = chars[chars.length - 1]
  if (isViVowel(last)) return chars.length - 1
  const cons = trailingConsonants(chars)
  if (!VI_CODAS.includes(cons)) return -1
  const end = chars.length - cons.length
  return end > 0 && isViVowel(chars[end - 1]) ? end - 1 : -1
}

function replaceVowel(chars: string[], index: number, nextBase: string): boolean {
  const start = (() => {
    let cursor = index
    while (cursor > 0 && isViVowel(chars[cursor - 1])) cursor -= 1
    return cursor
  })()
  const end = (() => {
    let cursor = index
    while (cursor + 1 < chars.length && isViVowel(chars[cursor + 1])) cursor += 1
    return cursor
  })()
  const bases: string[] = []
  for (let cursor = start; cursor <= end; cursor += 1) bases.push(cursor === index ? nextBase : stripTone(chars[cursor]).base)
  if (!clusterOk(bases)) return false
  const current = stripTone(chars[index])
  chars[index] = withTone(nextBase, current.tone, current.upper)
  return true
}

function applyRoof(chars: string[], key: string, cmd: string): string {
  const index = markIndex(chars)
  if (index < 0) return chars.join('') + key
  const current = stripTone(chars[index])
  if (VI_ROOF_BACK[current.base] === cmd) {
    chars[index] = withTone(VI_ROOF_BACK[current.base], current.tone, current.upper)
    chars.push(key)
    return chars.join('')
  }
  if (current.base === cmd && VI_ROOF[cmd] && replaceVowel(chars, index, VI_ROOF[cmd])) return chars.join('')
  return chars.join('') + key
}

function applyHorn(chars: string[], key: string): string {
  const last = chars[chars.length - 1]
  const prev = chars.length > 1 ? chars[chars.length - 2] : ''
  const lastTone = stripTone(last || '')
  const prevTone = prev ? stripTone(prev) : null
  if (prevTone && isViVowel(prev) && isViVowel(last) && prevTone.base === 'ư' && lastTone.base === 'ơ') {
    chars[chars.length - 2] = prevTone.upper ? 'U' : 'u'
    chars[chars.length - 1] = withTone('o', lastTone.tone, lastTone.upper)
    chars.push(key)
    return chars.join('')
  }
  if (prevTone && isViVowel(prev) && isViVowel(last) && (prevTone.base === 'u' || prevTone.base === 'ư') && (lastTone.base === 'o' || lastTone.base === 'ô')) {
    chars[chars.length - 2] = withTone('ư', prevTone.tone, prevTone.upper)
    chars[chars.length - 1] = withTone('ơ', lastTone.tone, lastTone.upper)
    return chars.join('')
  }
  const index = markIndex(chars)
  if (index < 0) return chars.join('') + key
  const current = stripTone(chars[index])
  const back = VI_HORN_BACK[current.base]
  if (back) {
    chars[index] = withTone(back, current.tone, current.upper)
    chars.push(key)
    return chars.join('')
  }
  const next = VI_HORN[current.base]
  if (next && replaceVowel(chars, index, next)) return chars.join('')
  return chars.join('') + key
}

function applyToneKey(chars: string[], key: string, cmd: string): string {
  const tone = cmd === 'z' ? 0 : { s: 1, f: 2, r: 3, x: 4, j: 5 }[cmd] || 0
  const run = vowelRun(chars)
  if (!run.indexes.length) return chars.join('') + key
  if ((tone === 2 || tone === 3 || tone === 4) && (run.coda === 'c' || run.coda === 'ch' || run.coda === 'p' || run.coda === 't')) {
    return chars.join('') + key
  }
  const offset = toneOffset(run.bases, run.coda === '')
  const index = run.indexes[offset]
  if (index == null) return chars.join('') + key
  const current = stripTone(chars[index])
  if (current.tone === tone) {
    chars[index] = withTone(current.base, 0, current.upper)
    chars.push(key)
    return chars.join('')
  }
  chars[index] = withTone(current.base, tone, current.upper)
  return chars.join('')
}

function applyTelexChar(prev: string, key: string): string {
  if (!prev) return key
  const cmd = key.toLowerCase()
  const chars = [...prev]
  const last = stripTone(chars[chars.length - 1])
  if (cmd === 'd') {
    if (last.base === 'đ') {
      chars[chars.length - 1] = last.upper ? 'D' : 'd'
      chars.push(key)
      return chars.join('')
    }
    if (last.base === 'd') {
      const before = chars.length > 1 ? stripTone(chars[chars.length - 2]).base : ''
      if (!VOWEL_TONE[before]) {
        chars[chars.length - 1] = last.upper ? 'Đ' : 'đ'
        return chars.join('')
      }
    }
    return prev + key
  }
  if (cmd === 'w') return applyHorn(chars, key)
  if (cmd === 'a' || cmd === 'e' || cmd === 'o') return applyRoof(chars, key, cmd)
  if ('sfrxjz'.includes(cmd)) return applyToneKey(chars, key, cmd)
  return prev + key
}

function applyTelex(raw: string): string {
  let text = ''
  for (const char of raw) text = applyTelexChar(text, char)
  return text
}

const HI_CONS: Array<[string, string]> = [
  ['ksh', 'क्ष'], ['chh', 'छ'], ['jh', 'झ'], ['kh', 'ख'], ['gh', 'घ'],
  ['Th', 'ठ'], ['Dh', 'ढ'], ['th', 'थ'], ['dh', 'ध'], ['ph', 'फ'], ['bh', 'भ'],
  ['Sh', 'ष'], ['sh', 'श'], ['gy', 'ज्ञ'], ['ch', 'च'], ['ng', 'ङ'], ['ny', 'ञ'],
  ['k', 'क'], ['g', 'ग'], ['j', 'ज'], ['T', 'ट'], ['D', 'ड'], ['N', 'ण'],
  ['t', 'त'], ['d', 'द'], ['p', 'प'], ['b', 'ब'], ['s', 'स'], ['n', 'न'],
  ['m', 'म'], ['y', 'य'], ['r', 'र'], ['l', 'ल'], ['v', 'व'], ['w', 'व'],
  ['h', 'ह'], ['q', 'क़'], ['f', 'फ़'], ['z', 'ज़'],
]
const HI_VOWELS: Array<[string, string, string]> = [
  ['rii', 'ॠ', 'ॄ'], ['ri', 'ऋ', 'ृ'],
  ['aa', 'आ', 'ा'], ['ai', 'ऐ', 'ै'], ['au', 'औ', 'ौ'],
  ['ii', 'ई', 'ी'], ['ee', 'ई', 'ी'], ['uu', 'ऊ', 'ू'], ['oo', 'ऊ', 'ू'],
  ['a', 'अ', ''], ['i', 'इ', 'ि'], ['u', 'उ', 'ु'], ['e', 'ए', 'े'], ['o', 'ओ', 'ो'],
]

function matchHiToken(source: string, index: number, table: Array<[string, string] | [string, string, string]>): number {
  let found = -1
  let length = 0
  for (let cursor = 0; cursor < table.length; cursor += 1) {
    const token = table[cursor][0]
    if (token.length > length && source.startsWith(token, index)) {
      found = cursor
      length = token.length
    }
  }
  return found
}

function hiCanGrow(source: string, index: number, length: number): boolean {
  if (index + length !== source.length) return false
  const head = source.slice(index, index + length)
  return [...HI_CONS, ...HI_VOWELS].some((token) => token[0].startsWith(head) && token[0].length > head.length)
}

function transliterateHindi(raw: string): { text: string; pending: string; rest: string } {
  const source = raw
  let index = 0
  let text = ''
  let pending = ''
  let lastWasVowel = false
  let lastVowel = ''
  while (index < source.length) {
    const vowelIndex = matchHiToken(source, index, HI_VOWELS)
    const consIndex = matchHiToken(source, index, HI_CONS)
    const vowel = vowelIndex >= 0 ? HI_VOWELS[vowelIndex] : null
    const cons = consIndex >= 0 ? HI_CONS[consIndex] : null
    const vowelLen = vowel?.[0].length || 0
    const consLen = cons?.[0].length || 0
    if (cons && cons[0] === 'n' && consLen === 1 && lastWasVowel && consLen >= vowelLen) {
      const after = source.slice(index + 1)
      const nextIsVowel = matchHiToken(after, 0, HI_VOWELS) === 0 && after.startsWith('a') ? false : matchHiToken(source, index + 1, HI_VOWELS) >= 0
      const atEnd = index + 1 === source.length
      const nextCons = matchHiToken(source, index + 1, HI_CONS) >= 0
      const endAnusvara = atEnd && (lastVowel === 'ai' || lastVowel === 'i')
      if ((endAnusvara || nextCons) && !nextIsVowel) {
        if (pending) {
          text += pending
          pending = ''
        }
        text += 'ं'
        lastWasVowel = false
        lastVowel = ''
        index += 1
        continue
      }
    }
    if (vowel && vowelLen >= consLen) {
      if (pending) {
        const matra = vowel[2] === '' && pending === 'य' && text.endsWith('्') ? 'ा' : vowel[2]
        text += pending + matra
        pending = ''
      } else {
        text += vowel[1]
      }
      lastWasVowel = true
      lastVowel = vowel[0]
      index += vowelLen
      continue
    }
    if (cons) {
      if (hiCanGrow(source, index, consLen)) return { text, pending, rest: source.slice(index) }
      if (pending) text += `${pending}्`
      pending = cons[1]
      lastWasVowel = false
      lastVowel = ''
      index += consLen
      continue
    }
    if (pending) {
      text += pending
      pending = ''
    }
    text += source[index]
    lastWasVowel = false
    lastVowel = ''
    index += 1
  }
  return { text, pending, rest: '' }
}

function hindiPreview(raw: string): string {
  const parsed = transliterateHindi(raw)
  let tail = parsed.pending
  if (parsed.rest) {
    const vowelIndex = matchHiToken(parsed.rest, 0, HI_VOWELS)
    const consIndex = matchHiToken(parsed.rest, 0, HI_CONS)
    const vowel = vowelIndex >= 0 ? HI_VOWELS[vowelIndex] : null
    const cons = consIndex >= 0 ? HI_CONS[consIndex] : null
    if (vowel && vowel[0] === parsed.rest) tail += tail ? vowel[2] : vowel[1]
    else if (cons && cons[0] === parsed.rest) tail += cons[1]
    else tail += parsed.rest
  }
  return parsed.text + tail
}

function commitHindi(raw: string): string {
  const parsed = transliterateHindi(raw)
  const restPreview = parsed.rest ? hindiPreview(parsed.rest) : ''
  const restIsPreview = Boolean(parsed.rest) && restPreview !== parsed.rest
  return parsed.text + parsed.pending + (restIsPreview ? restPreview : parsed.rest)
}

const ZH_PUNCT: Record<string, string> = { ',': '，', '.': '。', '?': '？', '!': '！', ':': '：', ';': '；' }
const JA_PUNCT: Record<string, string> = { ',': '、', '.': '。', '?': '？', '!': '！' }

function feedRaw(session: ImeSession, text: string): ImeSession {
  return { ...session, raw: session.raw + text }
}

export function imeComposition(languageCode: string, session: ImeSession): string {
  if (languageCode === 'zh') return session.raw
  if (languageCode === 'ja') {
    const { kana, partial } = toKana(session.raw)
    return kana + partial
  }
  if (languageCode === 'ko') return composeHangul(session.hangul)
  if (languageCode === 'vi') return applyTelex(session.raw)
  if (languageCode === 'hi') return hindiPreview(session.raw)
  return ''
}

export function imeCandidates(languageCode: string, session: ImeSession): string[] {
  if (languageCode === 'zh' && session.raw) return zhCandidates(session.raw).map((item) => item.text)
  if (languageCode === 'ja' && session.raw) return jaCandidates(toKana(session.raw).kana).map((item) => item.text)
  if (languageCode === 'hi' && session.raw) {
    const preview = hindiPreview(session.raw)
    return preview ? [preview] : []
  }
  if (languageCode === 'vi' && session.raw) {
    const preview = applyTelex(session.raw)
    return preview && preview !== session.raw ? [preview] : []
  }
  return []
}

export function imeFeed(languageCode: string, session: ImeSession, text: string): ImeStep {
  let current = session
  let commit = ''
  for (const char of [...text]) {
    const step = imeFeedChar(languageCode, current, char)
    current = step.session
    commit += step.commit
  }
  return { session: current, commit, replace: 0 }
}

function imeFeedChar(languageCode: string, session: ImeSession, char: string): ImeStep {
  if (languageCode === 'ko') {
    const next = typeKorean(session.hangul, char)
    return { session: { raw: '', hangul: next.state }, commit: next.commit, replace: 0 }
  }
  if (languageCode === 'th') {
    const mapped = THAI_SHIFT[char] || THAI_BASE[char] || THAI_BASE[char.toLowerCase()] || char
    return { session, commit: mapped, replace: 0 }
  }
  if (languageCode === 'en') return { session, commit: char, replace: 0 }
  if (languageCode === 'zh') {
    if (/[a-zA-ZüÜ]/.test(char) || char === "'") {
      const next = char === "'" ? "'" : char.toLowerCase().replace('ü', 'v').replace('Ü', 'v')
      return { session: feedRaw(session, next), commit: '', replace: 0 }
    }
    if (char === ' ') {
      if (!session.raw) return { session, commit: ' ', replace: 0 }
      const picked = commitZh(session.raw, 0)
      return { session: { ...session, raw: picked.raw }, commit: picked.commit, replace: 0 }
    }
    if (/^[1-9]$/.test(char) && session.raw && zhCandidates(session.raw).length) {
      const picked = commitZh(session.raw, Number(char) - 1)
      return { session: { ...session, raw: picked.raw }, commit: picked.commit || char, replace: 0 }
    }
    const punct = ZH_PUNCT[char]
    if (punct) {
      const picked = session.raw ? commitZh(session.raw, 0) : { commit: '', raw: '' }
      return { session: { ...session, raw: picked.raw }, commit: picked.commit + punct, replace: 0 }
    }
    const picked = session.raw ? commitZh(session.raw, 0) : { commit: '', raw: '' }
    return { session: { ...session, raw: picked.raw }, commit: picked.commit + char, replace: 0 }
  }
  if (languageCode === 'ja') {
    if (/[a-zA-Z]/.test(char)) return { session: feedRaw(session, char.toLowerCase()), commit: '', replace: 0 }
    if (char === ' ') {
      if (!session.raw) return { session, commit: ' ', replace: 0 }
      const parsed = toKana(session.raw)
      if (!parsed.kana) return { session: emptyImeSession(), commit: `${parsed.partial} `, replace: 0 }
      const picked = commitJa(session.raw, 0)
      return { session: { ...session, raw: picked.raw }, commit: picked.commit, replace: 0 }
    }
    if (/^[1-9]$/.test(char) && jaCandidates(toKana(session.raw).kana).length) {
      const picked = commitJa(session.raw, Number(char) - 1)
      return { session: { ...session, raw: picked.raw }, commit: picked.commit || char, replace: 0 }
    }
    const punct = JA_PUNCT[char]
    const parsed = toKana(session.raw)
    if (!parsed.kana) return { session: emptyImeSession(), commit: `${parsed.partial}${punct || char}`, replace: 0 }
    const picked = commitJa(session.raw, 0)
    return { session: { ...session, raw: picked.raw }, commit: picked.commit + (punct || char), replace: 0 }
  }
  if (languageCode === 'vi' || languageCode === 'hi') {
    if (languageCode === 'vi' && /[a-zA-Z]/.test(char)) return { session: feedRaw(session, char), commit: '', replace: 0 }
    if (languageCode === 'hi' && /[a-zA-Z]/.test(char)) return { session: feedRaw(session, char), commit: '', replace: 0 }
    if (char === ' ') {
      const word = languageCode === 'vi' ? applyTelex(session.raw) : commitHindi(session.raw)
      if (!session.raw) return { session, commit: ' ', replace: 0 }
      return { session: emptyImeSession(), commit: `${word} `, replace: 0 }
    }
    const word = languageCode === 'vi' ? applyTelex(session.raw) : commitHindi(session.raw)
    return { session: emptyImeSession(), commit: `${word}${char}`, replace: 0 }
  }
  return { session, commit: char, replace: 0 }
}

export function imeBackspace(languageCode: string, session: ImeSession): ImeStep {
  if (languageCode === 'ko') {
    const next = backspaceKorean(session.hangul)
    return { session: { raw: '', hangul: next.state }, commit: '', replace: next.replace }
  }
  if (!session.raw) return { session, commit: '', replace: 1 }
  return { session: { ...session, raw: [...session.raw].slice(0, -1).join('') }, commit: '', replace: 0 }
}

export function imeCommitCandidate(languageCode: string, session: ImeSession, index: number): ImeStep {
  if (languageCode === 'zh') {
    const picked = commitZh(session.raw, index)
    return { session: { ...session, raw: picked.raw }, commit: picked.commit, replace: 0 }
  }
  if (languageCode === 'ja') {
    const picked = commitJa(session.raw, index)
    return { session: { ...session, raw: picked.raw }, commit: picked.commit, replace: 0 }
  }
  return imeFlush(languageCode, session)
}

export function imeFlush(languageCode: string, session: ImeSession): ImeStep {
  if (imeIsEmpty(session)) return { session, commit: '', replace: 0 }
  if (languageCode === 'zh') {
    let current = session
    let commit = ''
    let guard = 0
    while (current.raw && guard < 12) {
      const before = current.raw
      const picked = commitZh(current.raw, 0)
      if (!picked.commit || picked.raw === before) {
        commit += current.raw
        current = emptyImeSession()
        break
      }
      commit += picked.commit
      current = { ...current, raw: picked.raw }
      guard += 1
    }
    return { session: current, commit, replace: 0 }
  }
  if (languageCode === 'ja') {
    let current = session
    let commit = ''
    let guard = 0
    while (current.raw && guard < 8) {
      const parsed = toKana(current.raw)
      if (!parsed.kana) {
        commit += parsed.partial
        current = emptyImeSession()
        break
      }
      const before = current.raw
      const picked = commitJa(current.raw, 0)
      if (!picked.commit || picked.raw === before) {
        commit += parsed.kana + parsed.partial
        current = emptyImeSession()
        break
      }
      commit += picked.commit
      current = { ...current, raw: picked.raw }
      guard += 1
    }
    return { session: current, commit, replace: 0 }
  }
  if (languageCode === 'ko') return { session: emptyImeSession(), commit: composeHangul(session.hangul), replace: 0 }
  if (languageCode === 'vi') return { session: emptyImeSession(), commit: applyTelex(session.raw), replace: 0 }
  if (languageCode === 'hi') return { session: emptyImeSession(), commit: commitHindi(session.raw), replace: 0 }
  return { session: emptyImeSession(), commit: session.raw, replace: 0 }
}

export function imeTypeText(languageCode: string, text: string): string {
  let session = emptyImeSession()
  let output = ''
  const step = imeFeed(languageCode, session, text)
  session = step.session
  output += step.commit
  const flushed = imeFlush(languageCode, session)
  return output + flushed.commit
}
