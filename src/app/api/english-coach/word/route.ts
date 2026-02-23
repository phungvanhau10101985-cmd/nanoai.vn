import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

type WordPayload = {
  word?: string
  contextSentence?: string
  targetLanguage?: string
  nativeLanguage?: string
}

type WordResult = {
  partOfSpeech: string
  meaning: string
  pronunciation: string
  exampleTarget: string
  exampleNative: string
}
const wordCacheStats = { hit: 0, miss: 0 }

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
    return {
      partOfSpeech: String((parsed as { partOfSpeech?: unknown }).partOfSpeech || '').trim(),
      meaning,
      pronunciation: String(parsed.pronunciation || '').trim(),
      exampleTarget: String(parsed.exampleTarget || '').trim(),
      exampleNative: String(parsed.exampleNative || '').trim(),
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

    if (!word) {
      return NextResponse.json({ error: 'Thiếu từ cần giải nghĩa.' }, { status: 400 })
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
      .select('id, meaning, pronunciation, part_of_speech, example_target, example_native, pronunciation_audio_url')
      .eq('normalized_word', normalizedWord)
      .eq('normalized_target_language', normalizedTarget)
      .eq('normalized_native_language', normalizedNative)
      .order('updated_at', { ascending: false })
      .limit(1)

    const cached = Array.isArray(cachedRows) && cachedRows.length > 0 ? cachedRows[0] : null
    if (cached) {
      wordCacheStats.hit += 1
      void recordCacheMetric(adminSupabase, 'word_hit')
      void adminSupabase
        .from('language_coach_vocab_cache')
        .update({ last_used_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', cached.id)
      console.info(`[WORD] cache-hit word="${word}"`)
      logWordCacheStats(word)
      return NextResponse.json({
        partOfSpeech: String(cached.part_of_speech || '').trim(),
        meaning: String(cached.meaning || '').trim(),
        pronunciation: String(cached.pronunciation || '').trim() || word,
        exampleTarget: String(cached.example_target || '').trim() || word,
        exampleNative: String(cached.example_native || '').trim() || `Bạn vừa bấm từ "${word}".`,
        pronunciationAudioUrl: String(cached.pronunciation_audio_url || '').trim(),
        cached: true,
      })
    }
    wordCacheStats.miss += 1
    void recordCacheMetric(adminSupabase, 'word_miss')
    console.info(`[WORD] cache-miss word="${word}"`)

    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Thiếu GOOGLE_API_KEY.' }, { status: 500 })
    }

    const prompt = `Bạn là giáo viên ngôn ngữ.
Hãy giải thích từ "${word}" trong ngữ cảnh câu: "${contextSentence || '(không có ngữ cảnh)'}".
Ngôn ngữ mục tiêu: ${targetLanguage}.
Ngôn ngữ mẹ đẻ của học sinh: ${nativeLanguage}.

Yêu cầu:
1) meaning: giải thích nghĩa NGẮN gọn bằng ${nativeLanguage}. Nếu ngữ cảnh thiếu, vẫn phải trả nghĩa phổ biến nhất của từ.
2) pronunciation: phiên âm hoặc gợi ý phát âm dễ đọc.
3) partOfSpeech: loại từ ngắn gọn (noun/verb/adj/adv/...).
4) exampleTarget: 1 câu ví dụ ngắn bằng ${targetLanguage}.
5) exampleNative: dịch tự nhiên câu ví dụ sang ${nativeLanguage}.

Trả về JSON hợp lệ, không markdown:
{
  "partOfSpeech": "...",
  "meaning": "...",
  "pronunciation": "...",
  "exampleTarget": "...",
  "exampleNative": "..."
}`

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const result = await model.generateContent(prompt)
    const text = result.response.text()?.trim() || ''
    const parsed = safeParse(text)

    if (!parsed) {
      logWordCacheStats(word)
      return NextResponse.json({
        partOfSpeech: '',
        meaning: `Nghĩa phổ biến của "${word}" đang được cập nhật. Hãy thử lại sau vài giây.`,
        pronunciation: word,
        exampleTarget: `I use "${word}" in a sentence.`,
        exampleNative: `Ví dụ dùng từ "${word}" trong câu.`,
        cached: false,
      })
    }

    const completed: WordResult = {
      partOfSpeech: parsed.partOfSpeech || '',
      meaning: parsed.meaning,
      pronunciation: parsed.pronunciation || word,
      exampleTarget: parsed.exampleTarget || `I use "${word}" in a sentence.`,
      exampleNative: parsed.exampleNative || `Ví dụ dùng từ "${word}" trong câu.`,
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
        meaning: completed.meaning,
        pronunciation: completed.pronunciation || null,
        example_target: completed.exampleTarget || null,
        example_native: completed.exampleNative || null,
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

