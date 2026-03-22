import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

type WordPayload = {
  word?: string
  contextSentence?: string
  targetLanguage?: string
  nativeLanguage?: string
}

type WordMeaningItem = {
  text: string
  pinyin?: string
}

type WordSenseItem = {
  gloss: string
  exampleTarget: string
  exampleNative: string
}

type WordExampleItem = {
  targetText: string
  targetPinyin?: string
  nativeText: string
}

type WordResult = {
  partOfSpeech: string
  meaning: string
  pronunciation: string
  exampleTarget: string
  exampleNative: string
  senses: WordSenseItem[]
  meaningItems: WordMeaningItem[]
  exampleItems: WordExampleItem[]
  usageLevel: 'high' | 'medium' | 'low'
  importanceScore: number
  contextSensitive: boolean
}
const wordCacheStats = { hit: 0, miss: 0 }

function tr(input: string): 'vi' | 'en' {
  return String(input || '').toLowerCase().includes('vietnamese') ? 'vi' : 'en'
}

function msg(locale: 'vi' | 'en', vi: string, en: string): string {
  return locale === 'vi' ? vi : en
}

function normalizeMeaningOutput(input: string): string {
  const cleaned = String(input || '')
    .replace(/\bNghĩa cốt lõi:\s*/gi, '')
    .replace(/\bCore meaning:\s*/gi, '')
    .replace(/\n?\s*[-•]?\s*(Ví dụ|Example)\s*:\s*[^.\n]*(?:[.\n]|$)/gi, ' ')
    .replace(/\n?\s*[-•]?\s*(Ngữ cảnh hay gặp|Common contexts?)\s*:\s*/gi, ' ')
  return cleaned
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeSenseGloss(input: string): string {
  const raw = String(input || '')
    .replace(/^\s*(nghĩa\s*\d+|sense\s*\d+)\s*[:\-]\s*/i, '')
    .replace(/\b(trong câu này|trong câu hiện tại|in this sentence|in the current context)\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  return raw
}

function normalizeSensesForDictionary(input: WordSenseItem[]): WordSenseItem[] {
  const seen = new Set<string>()
  const out: WordSenseItem[] = []
  for (const row of input) {
    const gloss = normalizeSenseGloss(row.gloss)
    const exampleTarget = String(row.exampleTarget || '').trim()
    const exampleNative = String(row.exampleNative || '').trim()
    if (!gloss && !(exampleTarget && exampleNative)) continue
    const key = gloss.toLowerCase()
    if (key && seen.has(key)) continue
    if (key) seen.add(key)
    out.push({
      gloss,
      exampleTarget,
      exampleNative,
    })
    if (out.length >= 5) break
  }
  return out
}

function buildMeaningFromSenses(
  senses: WordSenseItem[],
  fallbackMeaning: string
): string {
  const glosses = senses.map((s) => normalizeSenseGloss(s.gloss)).filter(Boolean)
  if (glosses.length === 0) return normalizeMeaningOutput(fallbackMeaning)
  if (glosses.length === 1) return glosses[0]
  return `${glosses[0]}; ${glosses[1]}`
}

function formatMeaningWithWord(word: string, meaning: string, locale: 'vi' | 'en'): string {
  const normalizedWord = String(word || '').trim()
  const normalizedMeaning = String(meaning || '').trim()
  if (!normalizedMeaning) return normalizedWord
  const lower = normalizedMeaning.toLowerCase()
  const wordPrefix = `${normalizedWord.toLowerCase()}:`
  if (lower.startsWith(wordPrefix)) return normalizedMeaning
  if (locale === 'vi') {
    const text = /^là\b/i.test(normalizedMeaning) ? normalizedMeaning : `là ${normalizedMeaning}`
    return `${normalizedWord}: ${text}`
  }
  return `${normalizedWord}: ${normalizedMeaning}`
}

function adminClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function recordCacheMetric(
  supabase: ReturnType<typeof adminClient>,
  metric: 'word_hit' | 'word_miss'
) {
  try {
    await supabase.rpc('increment_language_coach_cache_stat', { p_metric: metric, p_inc: 1 })
  } catch {
    // Keep word lookup fast and resilient even if stats logging fails.
  }
}

function normalizeLookup(input: string): string {
  return String(input || '').trim().toLowerCase()
}

function hashContextSentence(input: string): string {
  const normalized = String(input || '').trim().toLowerCase()
  if (!normalized) return ''
  return createHash('sha256').update(normalized).digest('hex').slice(0, 40)
}

function logWordCacheStats(word: string) {
  const total = wordCacheStats.hit + wordCacheStats.miss
  const hitRate = total > 0 ? ((wordCacheStats.hit / total) * 100).toFixed(1) : '0.0'
  console.info(`[WORD] "${word}" cache-stats hit=${wordCacheStats.hit} miss=${wordCacheStats.miss} hitRate=${hitRate}%`)
}

/** Zh/ja/ko/th/hi: targetText phải là chữ gốc, không phải romanization. Nếu targetText trông như Latin thì coi là sai format. */
function exampleItemsTargetTextLooksWrong(
  items: Array<{ targetText: string }>,
  targetLanguage: string
): boolean {
  const norm = String(targetLanguage || '').toLowerCase()
  if (!norm.includes('chinese') && !norm.includes('zh') && !norm.includes('mandarin') && !norm.includes('japanese') && !norm.includes('ja') && !norm.includes('korean') && !norm.includes('ko') && !norm.includes('thai') && !norm.includes('th') && !norm.includes('hindi') && !norm.includes('hi')) return false
  const hasNonLatin = (s: string) => /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\u0e00-\u0e7f\u0900-\u097f]/.test(s)
  for (const item of items) {
    const t = String(item.targetText || '').trim()
    if (!t) continue
    if (!hasNonLatin(t)) return true
  }
  return false
}

function sanitizeExampleItems(input: unknown): WordExampleItem[] {
  if (!Array.isArray(input)) return []
  return input
    .map((row) => ({
      targetText: String((row as { targetText?: unknown })?.targetText || '').trim(),
      targetPinyin: String((row as { targetPinyin?: unknown })?.targetPinyin || '').trim(),
      nativeText: String((row as { nativeText?: unknown })?.nativeText || '').trim(),
    }))
    .filter((row) => row.targetText && row.nativeText)
    .slice(0, 4)
}

function sanitizeSenseItems(input: unknown): WordSenseItem[] {
  if (!Array.isArray(input)) return []
  return input
    .map((row) => ({
      gloss: String((row as { gloss?: unknown })?.gloss || '').trim(),
      exampleTarget: String((row as { exampleTarget?: unknown })?.exampleTarget || '').trim(),
      exampleNative: String((row as { exampleNative?: unknown })?.exampleNative || '').trim(),
    }))
    .filter((row) => row.gloss || (row.exampleTarget && row.exampleNative))
    .slice(0, 5)
}

function parseJsonListField(input: unknown): unknown[] {
  if (Array.isArray(input)) return input
  const text = String(input || '').trim()
  if (!text) return []
  try {
    const parsed = JSON.parse(text)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function normalizeUsageLevel(input: unknown): 'high' | 'medium' | 'low' {
  const normalized = String(input || '').trim().toLowerCase()
  if (normalized === 'high' || normalized === 'medium' || normalized === 'low') return normalized
  return 'medium'
}

function normalizeImportanceScore(input: unknown): number {
  const n = Number(input)
  if (!Number.isFinite(n)) return 50
  return Math.min(100, Math.max(0, Math.round(n)))
}

function normalizeContextSensitive(input: unknown): boolean {
  if (typeof input === 'boolean') return input
  const normalized = String(input || '').trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes'
}

function safeParse(text: string): WordResult | null {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```/i, '')
    .replace(/```$/i, '')
    .trim()
  const tryParse = (candidate: string): WordResult | null => {
    const parsed = JSON.parse(candidate) as Partial<WordResult>
    const meaning = String(parsed.meaning || '').trim()
    if (!meaning) return null
    const senses = sanitizeSenseItems(parseJsonListField((parsed as { senses?: unknown }).senses))
    const exampleItems = sanitizeExampleItems(parseJsonListField((parsed as { exampleItems?: unknown }).exampleItems))
    const senseExamples = senses
      .map((s) => ({
        targetText: String(s.exampleTarget || '').trim(),
        targetPinyin: '',
        nativeText: String(s.exampleNative || '').trim(),
      }))
      .filter((s) => s.targetText && s.nativeText)
    const fallbackExampleItems =
      exampleItems.length > 0
        ? exampleItems
        : senseExamples.length > 0
          ? senseExamples
        : [{
            targetText: String((parsed as { exampleTarget?: unknown }).exampleTarget || '').trim(),
            targetPinyin: '',
            nativeText: String((parsed as { exampleNative?: unknown }).exampleNative || '').trim(),
          }].filter((row) => row.targetText && row.nativeText)
    return {
      partOfSpeech: String((parsed as { partOfSpeech?: unknown }).partOfSpeech || '').trim(),
      meaning,
      pronunciation: String(parsed.pronunciation || '').trim(),
      exampleTarget: String(parsed.exampleTarget || '').trim(),
      exampleNative: String(parsed.exampleNative || '').trim(),
      senses,
      meaningItems: [],
      exampleItems: fallbackExampleItems,
      usageLevel: normalizeUsageLevel((parsed as { usageLevel?: unknown }).usageLevel),
      importanceScore: normalizeImportanceScore((parsed as { importanceScore?: unknown }).importanceScore),
      contextSensitive: normalizeContextSensitive((parsed as { contextSensitive?: unknown }).contextSensitive),
    }
  }

  try {
    return tryParse(cleaned)
  } catch {
    const firstBrace = cleaned.indexOf('{')
    const lastBrace = cleaned.lastIndexOf('}')
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return tryParse(cleaned.slice(firstBrace, lastBrace + 1))
      } catch {
        return null
      }
    }
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as WordPayload
    const word = String(payload.word || '').trim()
    const contextSentence = String(payload.contextSentence || '').trim()
    const targetLanguage = String(payload.targetLanguage || 'English').trim()
    const nativeLanguage = String(payload.nativeLanguage || 'Vietnamese').trim()
    const locale = tr(nativeLanguage)

    if (!word) {
      return NextResponse.json({ error: msg(locale, 'Thiếu từ cần giải nghĩa.', 'Missing word to explain.') }, { status: 400 })
    }

    // Shared DB-first lookup: reuse meanings saved by any learner first,
    // only call AI when the database does not have this word yet.
    const adminSupabase = adminClient()
    const normalizedWord = normalizeLookup(word)
    const normalizedTarget = normalizeLookup(targetLanguage)
    const normalizedNative = normalizeLookup(nativeLanguage)
    const contextHash = hashContextSentence(contextSentence)
    const { data: cachedRows } = await adminSupabase
      .from('language_coach_vocab_cache')
      .select(
        'id, meaning, pronunciation, part_of_speech, example_target, example_native, pronunciation_audio_url, meaning_items_json, example_items_json, usage_level, importance_score, is_context_sensitive'
      )
      .eq('normalized_word', normalizedWord)
      .eq('normalized_target_language', normalizedTarget)
      .eq('normalized_native_language', normalizedNative)
      .order('updated_at', { ascending: false })
      .limit(1)

    const cached = Array.isArray(cachedRows) && cachedRows.length > 0 ? cachedRows[0] : null
    if (cached) {
      const cachedExampleItems = sanitizeExampleItems(parseJsonListField(cached.example_items_json))
      const itemsToCheck = cachedExampleItems.length > 0 ? cachedExampleItems : [{ targetText: String(cached.example_target || '').trim() }]
      if (exampleItemsTargetTextLooksWrong(itemsToCheck, targetLanguage)) {
        console.info(`[WORD] cache-bypass word="${word}" (targetText is pinyin, need original script)`)
      } else {
        const cachedSenseItemsRaw = sanitizeSenseItems(parseJsonListField(cached.meaning_items_json))
        wordCacheStats.hit += 1
        void recordCacheMetric(adminSupabase, 'word_hit')
        void adminSupabase
          .from('language_coach_vocab_cache')
          .update({ last_used_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', cached.id)
        const normalizedCachedSenses = normalizeSensesForDictionary(cachedSenseItemsRaw)
        const fallbackMeaning = formatMeaningWithWord(word, buildMeaningFromSenses(
          normalizedCachedSenses,
          String(cached.meaning || '').trim()
        ), locale)
        const fallbackExampleTarget = String(cached.example_target || '').trim() || word
        const fallbackExampleNative = String(cached.example_native || '').trim()
          || msg(locale, `Bạn vừa bấm từ "${word}".`, `You just tapped the word "${word}".`)
        const cachedSenseItems = normalizedCachedSenses.length > 0
          ? normalizedCachedSenses
          : (cachedExampleItems.length > 0
              ? cachedExampleItems.map((ex) => ({
                  gloss: '',
                  exampleTarget: String(ex.targetText || '').trim(),
                  exampleNative: String(ex.nativeText || '').trim(),
                }))
              : fallbackExampleTarget && fallbackExampleNative
                ? [{ gloss: '', exampleTarget: fallbackExampleTarget, exampleNative: fallbackExampleNative }]
                : [])
        console.info(`[WORD] cache-hit word="${word}"`)
        logWordCacheStats(word)
        return NextResponse.json({
        partOfSpeech: String(cached.part_of_speech || '').trim(),
        meaning: fallbackMeaning,
        pronunciation: String(cached.pronunciation || '').trim() || word,
        exampleTarget: fallbackExampleTarget,
        exampleNative: fallbackExampleNative,
        senses: cachedSenseItems,
        meaningItems: [],
        exampleItems: cachedExampleItems.length > 0
          ? cachedExampleItems
          : [{ targetText: fallbackExampleTarget, nativeText: fallbackExampleNative }],
        pronunciationAudioUrl: String(cached.pronunciation_audio_url || '').trim(),
        usageLevel: normalizeUsageLevel(cached.usage_level),
        importanceScore: normalizeImportanceScore(cached.importance_score),
        contextSensitive: normalizeContextSensitive(cached.is_context_sensitive),
        cached: true,
      })
      }
    }
    wordCacheStats.miss += 1
    void recordCacheMetric(adminSupabase, 'word_miss')
    console.info(`[WORD] cache-miss word="${word}"`)

    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: msg(locale, 'Thiếu GOOGLE_API_KEY.', 'Missing GOOGLE_API_KEY.') }, { status: 500 })
    }

    const prompt = `Bạn là giáo viên ngôn ngữ.
Hãy giải thích từ "${word}" trong ngữ cảnh câu: "${contextSentence || '(không có ngữ cảnh)'}".
Ngôn ngữ mục tiêu: ${targetLanguage}.
Ngôn ngữ mẹ đẻ của học sinh: ${nativeLanguage}.

Yêu cầu:
1) meaning: viết bằng ${nativeLanguage}, kiểu từ điển ngắn gọn nhưng đủ ý để học.
   - Bắt buộc mở đầu theo format: "${word}: ..." (ví dụ: "seafood: là hải sản, động vật biển dùng làm thức ăn.").
   - Ưu tiên nghĩa phổ biến trước, sau đó có thể thêm 1 ý mở rộng ngắn.
   - Tuyệt đối KHÔNG nhắc, trích dẫn, hoặc suy diễn từ câu ngữ cảnh hiện tại "${contextSentence || '(không có ngữ cảnh)'}" trong meaning.
   - Không tạo bất kỳ mục nào dạng "Trong câu hiện tại..." hoặc "Trong câu này...".
   - Văn phong tự nhiên, không lan man; dài khoảng 1-2 câu ngắn.
2) senses: mảng 3-5 mục, mỗi mục gồm:
   - gloss: nghĩa ngắn gọn của mục đó (bằng ${nativeLanguage}).
   - Ưu tiên senses[0] là nghĩa trực tiếp dễ hiểu nhất (ví dụ seafood -> hải sản).
   - exampleTarget: ví dụ ngắn ở ngôn ngữ mục tiêu
   - exampleNative: bản dịch ví dụ sang ${nativeLanguage}
3) pronunciation: phiên âm dễ đọc. Nếu ngôn ngữ là tiếng Trung thì dùng pinyin có dấu; tiếng Nhật dùng romaji; tiếng Hàn dùng romanization; tiếng Thái dùng RTGS; tiếng Hindi dùng IAST.
4) partOfSpeech: loại từ ngắn gọn (noun/verb/adj/adv/...).
5) exampleItems: mảng 2-3 ví dụ. QUAN TRỌNG:
   - targetText: PHẢI là chữ gốc (zh=汉字, ja=かな/漢字, ko=한글, th=อักษรไทย, hi=देवनागरी). KHÔNG được dùng pinyin/romaji/romanization cho targetText.
   - targetPinyin: phiên âm Latin (zh=pinyin, ja=romaji, ko=romanization, th=RTGS, hi=IAST).
   - nativeText: bản dịch sang ${nativeLanguage}.
6) exampleTarget: lấy từ exampleItems[0].targetText.
7) exampleNative: lấy từ exampleItems[0].nativeText.
8) usageLevel: mức độ dùng trong giao tiếp hằng ngày, chỉ nhận một trong: "high", "medium", "low".
9) importanceScore: điểm ưu tiên học từ 0-100 (cao = nên học sớm).
10) contextSensitive: true nếu nghĩa thay đổi nhiều theo ngữ cảnh, false nếu nghĩa khá ổn định.

Trả về JSON hợp lệ, không markdown:
{
  "partOfSpeech": "...",
  "meaning": "...",
  "senses": [{"gloss":"...","exampleTarget":"...","exampleNative":"..."}],
  "pronunciation": "...",
  "exampleItems": [{"targetText":"汉字/かな/한글","targetPinyin":"pinyin/romaji","nativeText":"..."}],
  "exampleTarget": "...",
  "exampleNative": "...",
  "usageLevel": "high|medium|low",
  "importanceScore": 0,
  "contextSensitive": false
}`

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel(GEMINI_25_FLASH_NO_THINKING)
    const result = await model.generateContent(prompt)
    const text = result.response.text()?.trim() || ''
    const parsed = safeParse(text)

    if (!parsed) {
      logWordCacheStats(word)
      return NextResponse.json({
        partOfSpeech: '',
        meaning: msg(
          locale,
          `Nghĩa phổ biến của "${word}" đang được cập nhật. Hãy thử lại sau vài giây.`,
          `The common meaning of "${word}" is being updated. Please try again in a few seconds.`
        ),
        pronunciation: word,
        exampleTarget: `I use "${word}" in a sentence.`,
        exampleNative: msg(locale, `Ví dụ dùng từ "${word}" trong câu.`, `An example using "${word}" in a sentence.`),
        senses: [],
        meaningItems: [],
        exampleItems: [
          {
            targetText: `I use "${word}" in a sentence.`,
            nativeText: msg(locale, `Ví dụ dùng từ "${word}" trong câu.`, `An example using "${word}" in a sentence.`),
          },
        ],
        usageLevel: 'medium',
        importanceScore: 50,
        contextSensitive: true,
        cached: false,
      })
    }

    const normalizedExampleItems = sanitizeExampleItems(parsed.exampleItems)
    const normalizedSenses = normalizeSensesForDictionary(sanitizeSenseItems(parsed.senses))
    const senseExamples = normalizedSenses
      .map((s) => ({
        targetText: String(s.exampleTarget || '').trim(),
        targetPinyin: '',
        nativeText: String(s.exampleNative || '').trim(),
      }))
      .filter((s) => s.targetText && s.nativeText)
    const primaryExample = normalizedExampleItems[0] || null
    const completed: WordResult = {
      partOfSpeech: parsed.partOfSpeech || '',
      meaning: formatMeaningWithWord(word, buildMeaningFromSenses(normalizedSenses, parsed.meaning), locale),
      pronunciation: parsed.pronunciation || word,
      exampleTarget: primaryExample?.targetText || parsed.exampleTarget || `I use "${word}" in a sentence.`,
      exampleNative: primaryExample?.nativeText
        || parsed.exampleNative
        || msg(locale, `Ví dụ dùng từ "${word}" trong câu.`, `An example using "${word}" in a sentence.`),
      senses: normalizedSenses,
      meaningItems: [],
      exampleItems: normalizedExampleItems.length > 0
        ? normalizedExampleItems
        : senseExamples.length > 0
          ? senseExamples
        : [{
            targetText: parsed.exampleTarget || `I use "${word}" in a sentence.`,
            nativeText: parsed.exampleNative || msg(locale, `Ví dụ dùng từ "${word}" trong câu.`, `An example using "${word}" in a sentence.`),
          }],
      usageLevel: 'medium',
      importanceScore: 50,
      contextSensitive: true,
    }

    await adminSupabase.from('language_coach_vocab_cache').upsert(
      {
        word,
        normalized_word: normalizedWord,
        target_language: targetLanguage,
        normalized_target_language: normalizedTarget,
        native_language: nativeLanguage,
        normalized_native_language: normalizedNative,
        context_hash: contextHash || null,
        part_of_speech: completed.partOfSpeech || null,
        meaning: normalizeMeaningOutput(completed.meaning),
        pronunciation: completed.pronunciation || null,
        example_target: completed.exampleTarget || null,
        example_native: completed.exampleNative || null,
        meaning_items_json: JSON.stringify(completed.senses),
        example_items_json: JSON.stringify(completed.exampleItems),
        usage_level: completed.usageLevel,
        importance_score: completed.importanceScore,
        is_context_sensitive: completed.contextSensitive,
        source_model: 'gemini-2.5-flash',
        last_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'normalized_word,normalized_target_language,normalized_native_language' }
    )
    logWordCacheStats(word)

    return NextResponse.json({
      ...completed,
      cached: false,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

