import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { isPgConfigured } from '@/lib/db/pool'
import {
  fetchTtsCacheFullPg,
  incrementLanguageCoachCacheStatPg,
  touchTtsCachePg,
  upsertTtsCachePg,
} from '@/lib/db/language-coach-tts-pg'
import { createHash } from 'crypto'
import { trackApiUsage } from '@/lib/track-ai-usage'
import { getUserOrBypass } from '@/lib/auth'

type VoiceName =
  | 'Kore'
  | 'Puck'
  | 'Zephyr'
  | 'Autonoe'
  | 'Enceladus'
  | 'Sadachbia'
  | 'Orus'
  | 'Fenrir'
  | 'Iapetus'

type Payload = {
  text?: string
  voiceName?: VoiceName
  voiceStyle?: string
  locale?: string
  teacherGender?: 'male' | 'female'
  forceEngine?: 'auto' | 'gemini-only' | 'openai-only'
  targetLanguage?: string
  nativeLanguage?: string
  /** Bỏ qua cache, tạo âm thanh mới (dùng khi user báo phát âm sai) */
  skipCache?: boolean
}

type TtsExtracted = { audioBase64: string; mimeType: string } | null
type AttemptLog = { model: string; voice: VoiceName; ok: boolean; reason?: string; statusCode?: number }
const ttsCacheStats = { hit: 0, miss: 0 }
const OPENAI_TTS_MODEL = 'gpt-4o-mini-tts'

/**
 * Circuit breaker cho từng TTS model — tránh đợi 1-2s mỗi request khi Google TTS Preview đang lỗi.
 * - Trong window 60s: nếu model fail ≥ `FAILURE_THRESHOLD` lần → mở circuit (skip model trong cooldown).
 * - Sau cooldown: thử lại. Thành công → reset; thất bại → mở circuit lại.
 *
 * Threshold = 2: phản ứng nhanh khi Google flaky (cả 3.1 và 2.5 TTS Preview thỉnh thoảng trả 500 INTERNAL).
 * Sau 2 lần fail liên tiếp trong 60s → bypass Gemini, đi thẳng OpenAI trong 5 phút tiếp theo.
 *
 * Lưu ý: Map ở module scope nên tồn tại trong toàn bộ vòng đời server process. Trên Vercel/serverless,
 * mỗi instance giữ Map riêng — circuit breaker per-instance, không phân tán nhưng đủ giảm tải đáng kể.
 */
const TTS_CIRCUIT_FAILURE_THRESHOLD = 2
const TTS_CIRCUIT_WINDOW_MS = 60_000
const TTS_CIRCUIT_COOLDOWN_MS = 5 * 60_000
type CircuitState = { failures: number[]; cooldownUntil: number }
const ttsModelCircuitState = new Map<string, CircuitState>()

function isTtsModelCircuitClosed(model: string): boolean {
  const state = ttsModelCircuitState.get(model)
  if (!state) return true
  return Date.now() >= state.cooldownUntil
}

function recordTtsModelFailure(model: string): void {
  const now = Date.now()
  const state = ttsModelCircuitState.get(model) ?? { failures: [], cooldownUntil: 0 }
  state.failures = state.failures.filter((t) => now - t < TTS_CIRCUIT_WINDOW_MS)
  state.failures.push(now)
  if (state.failures.length >= TTS_CIRCUIT_FAILURE_THRESHOLD) {
    state.cooldownUntil = now + TTS_CIRCUIT_COOLDOWN_MS
    state.failures = []
    console.warn(
      `[TTS] circuit-breaker OPEN for ${model} — skip ${TTS_CIRCUIT_COOLDOWN_MS / 1000}s sau khi fail liên tiếp ${TTS_CIRCUIT_FAILURE_THRESHOLD} lần`
    )
  }
  ttsModelCircuitState.set(model, state)
}

function recordTtsModelSuccess(model: string): void {
  ttsModelCircuitState.delete(model)
}
const OPENAI_VOICE_BY_GEMINI: Record<VoiceName, string> = {
  Kore: 'nova',
  Puck: 'alloy',
  Zephyr: 'echo',
  Autonoe: 'shimmer',
  Enceladus: 'verse',
  Sadachbia: 'sage',
  Orus: 'onyx',
  Fenrir: 'marin',
  Iapetus: 'cedar',
}

function tr(input: string): 'vi' | 'en' {
  const value = String(input || '').toLowerCase()
  return value.startsWith('vi') || value.includes('vietnamese') ? 'vi' : 'en'
}

function msg(locale: 'vi' | 'en', vi: string, en: string): string {
  return locale === 'vi' ? vi : en
}

function compactAttempts(attempts: AttemptLog[]): string {
  return attempts
    .map((a) => `${a.model}/${a.voice}:${a.ok ? 'ok' : `fail(${a.statusCode || ''}${a.statusCode && a.reason ? ',' : ''}${a.reason || 'unknown'})`}`)
    .join(' | ')
}

function extractStatusCodeFromError(error: unknown): number | null {
  const status = (error as { status?: unknown })?.status
  if (typeof status === 'number' && status >= 100 && status <= 599) return status
  const message = error instanceof Error ? error.message : String(error || '')
  const match = message.match(/\b([1-5]\d{2})\b/)
  if (match) {
    const parsed = Number(match[1])
    if (parsed >= 100 && parsed <= 599) return parsed
  }
  return null
}

async function recordCacheMetric(metric: 'tts_hit' | 'tts_miss') {
  await incrementLanguageCoachCacheStatPg(metric)
}

function toTtsCacheKey(text: string, voiceName: VoiceName, locale: string): string {
  const textHash = createHash('sha256').update(text).digest('hex')
  const keyRaw = `${textHash}::${voiceName}::${locale || 'en-US'}`
  return createHash('sha256').update(keyRaw).digest('hex')
}

function logTtsCacheStats(requestId: string) {
  const total = ttsCacheStats.hit + ttsCacheStats.miss
  const hitRate = total > 0 ? ((ttsCacheStats.hit / total) * 100).toFixed(1) : '0.0'
  console.info(`[TTS][${requestId}] cache-stats hit=${ttsCacheStats.hit} miss=${ttsCacheStats.miss} hitRate=${hitRate}%`)
}

/** Ước lượng token tương đương cho TTS (không có usage từ API). */
function trackTtsGenerationUsage(params: {
  userId?: string | null
  model: string
  feature: 'english-coach-tts-openai' | 'english-coach-tts-gemini'
  instructionChars: number
  spokenTextChars: number
  audioBase64: string
}): void {
  const promptTok = Math.max(1, Math.ceil((params.instructionChars + params.spokenTextChars) / 4))
  const audioBytes = Math.max(0, Math.floor((params.audioBase64.length * 3) / 4))
  const outTok = Math.max(1, Math.ceil(audioBytes / 32))
  void trackApiUsage({
    userId: params.userId ?? null,
    model: params.model,
    feature: params.feature,
    promptTokenCount: promptTok,
    candidatesTokenCount: outTok,
    totalTokenCount: promptTok + outTok,
  })
}

function extractAudioFromResponse(response: unknown): TtsExtracted {
  const candidates = (response as { candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> } }> })
    ?.candidates
  if (!Array.isArray(candidates)) return null

  for (const candidate of candidates) {
    const parts = candidate?.content?.parts
    if (!Array.isArray(parts)) continue
    for (const part of parts) {
      const data = typeof part?.inlineData?.data === 'string' ? part.inlineData.data : ''
      if (!data) continue
      const mimeType = typeof part?.inlineData?.mimeType === 'string' ? part.inlineData.mimeType : 'audio/wav'
      return { audioBase64: data, mimeType }
    }
  }
  return null
}

function normalizeTextForTts(input: string): string {
  return input
    .replace(/\*\*/g, '')
    .replace(/[_`#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Normalize only for cache key; do not alter spoken text content.
function normalizeTextForTtsCacheKey(input: string): string {
  return String(input || '')
    .normalize('NFKC')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([([{])\s+/g, '$1')
    .replace(/\s+([)\]}])/g, '$1')
    .trim()
}

function clampTtsTextBySentence(input: string, maxChars = 1800, minBoundary = 220): { text: string; clipped: boolean } {
  const source = String(input || '').trim()
  if (!source) return { text: '', clipped: false }
  if (source.length <= maxChars) return { text: source, clipped: false }

  const slice = source.slice(0, maxChars + 1)
  let boundary = -1
  for (const mark of ['.', '!', '?', '。', '！', '？']) {
    boundary = Math.max(boundary, slice.lastIndexOf(mark))
  }
  if (boundary >= minBoundary) {
    return { text: slice.slice(0, boundary + 1).trim(), clipped: true }
  }

  const lineBreak = slice.lastIndexOf('\n')
  if (lineBreak >= minBoundary) {
    return { text: slice.slice(0, lineBreak).trim(), clipped: true }
  }

  const lastSpace = slice.lastIndexOf(' ')
  if (lastSpace >= minBoundary) {
    return { text: `${slice.slice(0, lastSpace).trim()}.`, clipped: true }
  }

  return { text: `${slice.slice(0, maxChars).trim()}.`, clipped: true }
}

async function generateOpenAiTts(params: {
  apiKey: string
  text: string
  requestedVoice: VoiceName
  instructions: string
}): Promise<TtsExtracted> {
  const voice = OPENAI_VOICE_BY_GEMINI[params.requestedVoice] || 'alloy'
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_TTS_MODEL,
      voice,
      input: params.text,
      instructions: params.instructions,
      format: 'mp3',
    }),
  })

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '')
    throw new Error(`openai-tts-${response.status}:${bodyText.slice(0, 220)}`)
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer())
  if (audioBuffer.length === 0) {
    throw new Error('openai-tts-empty-audio')
  }
  return {
    audioBase64: audioBuffer.toString('base64'),
    mimeType: 'audio/mpeg',
  }
}

export async function POST(request: NextRequest) {
  try {
    const requestId = `tts_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    const googleApiKey = process.env.GOOGLE_API_KEY
    const openAiApiKey = process.env.OPENAI_API_KEY
    const payload = (await request.json()) as Payload
    const user = await getUserOrBypass()
    const userId = user?.id ?? null
    const rawText = String(payload.text || '').trim()
    const normalizedText = normalizeTextForTts(rawText)
    const text = normalizedText.slice(0, 4500)
    const clippedForHardLimit = normalizedText.length > 4500
    const speechInput = clampTtsTextBySentence(text, 1800, 220)
    const voiceName = (payload.voiceName || 'Kore') as VoiceName
    const voiceStyle = String(payload.voiceStyle || '').trim()
    const locale = String(payload.locale || '').trim()
    const targetLanguage = String(payload.targetLanguage || '').trim()
    const nativeLanguage = String(payload.nativeLanguage || '').trim()
    const requestedEngine =
      payload.forceEngine === 'gemini-only' || payload.forceEngine === 'openai-only'
        ? payload.forceEngine
        : 'auto'
    const localeUi = tr(locale)
    const teacherGender = payload.teacherGender === 'male' || payload.teacherGender === 'female'
      ? payload.teacherGender
      : undefined
    if (!speechInput.text) {
      return NextResponse.json({ error: msg(localeUi, 'Thiếu văn bản cần đọc.', 'Missing text for speech synthesis.') }, { status: 400 })
    }
    const normalizedLocale = (locale || 'en-US').trim() || 'en-US'
    const skipCache = Boolean(payload.skipCache)
    const cacheKeyText = normalizeTextForTtsCacheKey(speechInput.text)
    const cacheKey = toTtsCacheKey(cacheKeyText, voiceName, normalizedLocale)
    const textHash = createHash('sha256').update(cacheKeyText).digest('hex')
    console.info(
      `[TTS][${requestId}] start locale=${locale || 'n/a'} gender=${teacherGender || 'n/a'} voice=${voiceName} textLen=${text.length} spokenLen=${speechInput.text.length} engine=${requestedEngine} skipCache=${skipCache}`
    )

    let cached: { id: string; audio_base64: string; mime_type: string; source_model: string } | null = null
    if (!skipCache && isPgConfigured()) {
      const row = await fetchTtsCacheFullPg(cacheKey)
      cached = row
        ? {
            id: row.id,
            audio_base64: row.audio_base64,
            mime_type: row.mime_type,
            source_model: row.source_model || '',
          }
        : null
    }
    const cachedSource = String(cached?.source_model || '')
    const cacheAllowed =
      !!cached && (requestedEngine !== 'gemini-only' || cachedSource.includes('gemini'))
    if (cacheAllowed && cached) {
      ttsCacheStats.hit += 1
      void recordCacheMetric('tts_hit')
      void touchTtsCachePg(cached.id, new Date().toISOString())
      console.info(`[TTS][${requestId}] cache-hit key=${cacheKey.slice(0, 12)}`)
      logTtsCacheStats(requestId)
      return NextResponse.json({
        audioBase64: String(cached.audio_base64 || ''),
        mimeType: String(cached.mime_type || 'audio/wav'),
        meta: { model: 'tts-cache', voice: voiceName },
        attempts: [],
        warnings: [],
        cached: true,
      })
    }
    ttsCacheStats.miss += 1
    void recordCacheMetric('tts_miss')
    console.info(`[TTS][${requestId}] cache-miss key=${cacheKey.slice(0, 12)}`)

    let extracted: TtsExtracted = null
    const strictReadPrompt = `${voiceStyle ? `${voiceStyle}\n` : ''}You are the selected teacher voice for this lesson.
Teacher profile:
- Selected voice: ${voiceName}
- Selected gender: ${teacherGender || 'unspecified'}
- Selected locale/accent: ${normalizedLocale}

Language pair lock (must follow exactly):
- Target learning language: ${targetLanguage || 'target language'}
- Learner native language: ${nativeLanguage || 'native language'}
- Only read text within this selected pair. Do not introduce any third language.

Reading rules (strict):
1) Read EXACTLY the provided text in original order.
2) Do not translate, explain, paraphrase, summarize, or add/remove any words.
3) Keep teacher-like pacing and natural punctuation pauses.
4) Keep pronunciation consistent with selected locale/accent ${normalizedLocale}.
5) If both target + native language appear, read both exactly as written, in sequence.

Text:
${speechInput.text}`
    /**
     * Thứ tự fallback (2 cấp):
     * 1) **OpenAI `gpt-4o-mini-tts`** — model chính (giọng tự nhiên hơn, ổn định cao). Giá $0.60 input / $12 output per 1M.
     * 2) **`gemini-2.5-flash-preview-tts`** — fallback khi OpenAI lỗi/down. Rẻ hơn ~17% nên giảm chi phí khi OpenAI gặp sự cố.
     *
     * Lý do chọn OpenAI primary: chất lượng giọng nghe được, đặc biệt với cụm tiếng Anh dài.
     * Gemini 2.5 vẫn là fallback tốt — circuit breaker tự động skip Gemini nếu nó cũng lỗi liên tục.
     *
     * Override khẩn cấp: đặt env `TTS_PRIMARY_ENGINE=gemini` trên server để swap về Gemini-first
     * khi OpenAI down dài (ít gặp). Không cần deploy lại code.
     */
    const attempts: Array<{ model: string; contents: string; voice: VoiceName }> = [
      { model: 'gemini-2.5-flash-preview-tts', contents: strictReadPrompt, voice: voiceName },
    ]
    const attemptLogs: AttemptLog[] = []
    let successMeta: { model: string; voice: VoiceName } | null = null

    const ttsPrimaryEngine = String(process.env.TTS_PRIMARY_ENGINE || '').trim().toLowerCase()
    const forceGeminiFirst = ttsPrimaryEngine === 'gemini'

    /**
     * Step 1: thử OpenAI trước (trừ khi `forceEngine === 'gemini-only'` hoặc env muốn Gemini-first).
     * Circuit breaker cũng áp cho OpenAI: nếu OpenAI fail liên tục → tự skip để không lãng phí.
     */
    if (
      openAiApiKey &&
      requestedEngine !== 'gemini-only' &&
      !forceGeminiFirst &&
      isTtsModelCircuitClosed(OPENAI_TTS_MODEL)
    ) {
      try {
        const openAiAudio = await generateOpenAiTts({
          apiKey: openAiApiKey,
          text: speechInput.text,
          requestedVoice: voiceName,
          instructions: strictReadPrompt,
        })
        extracted = openAiAudio
        if (openAiAudio) {
          trackTtsGenerationUsage({
            userId,
            model: OPENAI_TTS_MODEL,
            feature: 'english-coach-tts-openai',
            instructionChars: strictReadPrompt.length,
            spokenTextChars: speechInput.text.length,
            audioBase64: openAiAudio.audioBase64,
          })
          recordTtsModelSuccess(OPENAI_TTS_MODEL)
          attemptLogs.push({ model: OPENAI_TTS_MODEL, voice: voiceName, ok: true })
          successMeta = { model: OPENAI_TTS_MODEL, voice: voiceName }
        } else {
          recordTtsModelFailure(OPENAI_TTS_MODEL)
          attemptLogs.push({ model: OPENAI_TTS_MODEL, voice: voiceName, ok: false, reason: 'no-audio-empty' })
        }
      } catch (e) {
        recordTtsModelFailure(OPENAI_TTS_MODEL)
        const statusCode = extractStatusCodeFromError(e) || undefined
        const message = e instanceof Error ? e.message : 'request-error'
        attemptLogs.push({
          model: OPENAI_TTS_MODEL,
          voice: voiceName,
          ok: false,
          statusCode,
          reason: message.slice(0, 180),
        })
      }
    } else if (requestedEngine !== 'gemini-only' && !forceGeminiFirst) {
      attemptLogs.push({
        model: OPENAI_TTS_MODEL,
        voice: voiceName,
        ok: false,
        reason: !openAiApiKey
          ? 'missing-openai-api-key'
          : !isTtsModelCircuitClosed(OPENAI_TTS_MODEL)
            ? 'circuit-breaker-open'
            : 'openai-attempt-skipped',
      })
    }

    /**
     * Step 2: fallback sang Gemini nếu OpenAI fail (hoặc khi `forceEngine === 'gemini-only'` /
     * env `TTS_PRIMARY_ENGINE=gemini` muốn Gemini-first).
     */
    if (!extracted && googleApiKey && requestedEngine !== 'openai-only') {
      const ai = new GoogleGenAI({ apiKey: googleApiKey })
      const makeRequest = async (model: string, contents: string, voice: VoiceName) =>
        ai.models.generateContent({
          model,
          contents,
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: voice,
                },
              },
            },
          },
        })

      for (const attempt of attempts) {
        if (!isTtsModelCircuitClosed(attempt.model)) {
          attemptLogs.push({
            model: attempt.model,
            voice: attempt.voice,
            ok: false,
            reason: 'circuit-breaker-open',
          })
          continue
        }
        try {
          const response = await makeRequest(attempt.model, attempt.contents, attempt.voice)
          extracted = extractAudioFromResponse(response)
          if (extracted) {
            trackTtsGenerationUsage({
              userId,
              model: attempt.model,
              feature: 'english-coach-tts-gemini',
              instructionChars: attempt.contents.length,
              spokenTextChars: speechInput.text.length,
              audioBase64: extracted.audioBase64,
            })
            recordTtsModelSuccess(attempt.model)
            attemptLogs.push({ model: attempt.model, voice: attempt.voice, ok: true })
            successMeta = { model: attempt.model, voice: attempt.voice }
            break
          }
          recordTtsModelFailure(attempt.model)
          attemptLogs.push({ model: attempt.model, voice: attempt.voice, ok: false, reason: 'no-audio-inlineData' })
        } catch (e) {
          recordTtsModelFailure(attempt.model)
          const statusCode = extractStatusCodeFromError(e) || undefined
          const message = e instanceof Error ? e.message : 'request-error'
          attemptLogs.push({
            model: attempt.model,
            voice: attempt.voice,
            ok: false,
            statusCode,
            reason: message.slice(0, 180),
          })
        }
      }
    } else if (!extracted && requestedEngine !== 'openai-only') {
      attemptLogs.push({
        model: 'gemini-2.5-flash-preview-tts',
        voice: voiceName,
        ok: false,
        reason: !googleApiKey ? 'missing-google-api-key' : 'gemini-attempt-skipped',
      })
    }

    if (!extracted) {
      if (requestedEngine === 'gemini-only') {
        console.error(`[TTS][${requestId}] gemini-only-failed attempts=${compactAttempts(attemptLogs)}`)
        logTtsCacheStats(requestId)
        return NextResponse.json(
          {
            error: msg(
              localeUi,
              'Gemini TTS không trả về audio hợp lệ.',
              'Gemini TTS did not return valid audio.'
            ),
            attempts: attemptLogs,
          },
          { status: 502 }
        )
      }
      if (requestedEngine === 'openai-only') {
        console.error(`[TTS][${requestId}] openai-only-failed attempts=${compactAttempts(attemptLogs)}`)
        logTtsCacheStats(requestId)
        return NextResponse.json(
          {
            error: msg(
              localeUi,
              'OpenAI TTS không trả về audio hợp lệ.',
              'OpenAI TTS did not return valid audio.'
            ),
            attempts: attemptLogs,
          },
          { status: 502 }
        )
      }
      console.error(`[TTS][${requestId}] all-engines-failed attempts=${compactAttempts(attemptLogs)}`)
      logTtsCacheStats(requestId)
      return NextResponse.json(
        {
          error: msg(
            localeUi,
            'Không tạo được dữ liệu âm thanh (cả OpenAI và Gemini TTS đều lỗi).',
            'Failed to generate audio (both OpenAI and Gemini TTS failed).'
          ),
          attempts: attemptLogs,
        },
        { status: 502 }
      )
    }
    console.info(
      `[TTS][${requestId}] tts-success model=${successMeta?.model || 'unknown'} voice=${successMeta?.voice || 'unknown'} attempts=${compactAttempts(attemptLogs)}`
    )
    if (isPgConfigured()) {
      const nowIso = new Date().toISOString()
      const up = await upsertTtsCachePg({
        cacheKey,
        textHash,
        voiceName,
        locale: normalizedLocale,
        mimeType: extracted.mimeType || 'audio/wav',
        audioBase64: extracted.audioBase64,
        sourceModel: successMeta?.model || OPENAI_TTS_MODEL,
        nowIso,
      })
      if (!up.ok) {
        console.warn('[TTS] cache-upsert-failed', up.message)
      }
    }
    logTtsCacheStats(requestId)

    return NextResponse.json({
      ...extracted,
      meta: successMeta,
      attempts: attemptLogs,
      warnings: [
        ...(clippedForHardLimit ? ['source-over-4500'] : []),
        ...(speechInput.clipped ? ['tts-clamped-by-sentence'] : []),
      ],
      cached: false,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    console.error(`[TTS] unhandled-error ${msg}`)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

