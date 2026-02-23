import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import fs from 'fs'
import path from 'path'
import * as jose from 'jose'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

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
}

type TtsExtracted = { audioBase64: string; mimeType: string } | null
type AttemptLog = { model: string; voice: VoiceName; ok: boolean; reason?: string; statusCode?: number }
let cachedGoogleCloudToken: { token: string; exp: number } | null = null
const ttsCacheStats = { hit: 0, miss: 0 }

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

function adminClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function recordCacheMetric(
  supabase: ReturnType<typeof adminClient>,
  metric: 'tts_hit' | 'tts_miss'
) {
  try {
    await supabase.rpc('increment_language_coach_cache_stat', { p_metric: metric, p_inc: 1 })
  } catch {
    // Keep TTS response path fast and resilient even if stats logging fails.
  }
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

function escapeXml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildMultilingualSsml(text: string, baseLocale: string): string | null {
  const markerPattern = /(Giải thích\s*\(Vietnamese\)\s*:|Dịch nhanh\s*\(Vietnamese\)\s*:|Câu chuẩn\s*\(English\)\s*:|Câu tự nhiên\s*\(English\)\s*:|Natural sentence\s*\(English\)\s*:|Correct sentence\s*\(English\)\s*:)/gi
  const hasMarkers = markerPattern.test(text)
  markerPattern.lastIndex = 0
  if (!hasMarkers) return null

  const base = baseLocale || 'en-US'
  let currentLang = base
  let out = '<speak>'
  let cursor = 0

  for (const match of text.matchAll(markerPattern)) {
    const marker = match[0] || ''
    const idx = match.index ?? -1
    if (idx < 0) continue

    const before = text.slice(cursor, idx).trim()
    if (before) {
      out += `<lang xml:lang="${currentLang}">${escapeXml(before)}</lang><break time="250ms"/>`
    }

    out += `<lang xml:lang="${currentLang}">${escapeXml(marker.trim())}</lang><break time="120ms"/>`
    if (/vietnamese/i.test(marker)) currentLang = 'vi-VN'
    if (/english/i.test(marker)) currentLang = 'en-US'
    cursor = idx + marker.length
  }

  const tail = text.slice(cursor).trim()
  if (tail) {
    out += `<lang xml:lang="${currentLang}">${escapeXml(tail)}</lang>`
  }
  out += '</speak>'
  return out
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

async function getGoogleCloudAccessToken(): Promise<string> {
  if (cachedGoogleCloudToken && cachedGoogleCloudToken.exp > Date.now() + 60000) {
    return cachedGoogleCloudToken.token
  }

  const credPath =
    process.env.VISION_CREDENTIALS_PATH ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    path.join(process.cwd(), 'gcp-credentials.json')
  const resolvedPath = path.isAbsolute(credPath) ? credPath : path.resolve(process.cwd(), credPath)
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Không tìm thấy service account credentials: ${resolvedPath}`)
  }

  const raw = fs.readFileSync(resolvedPath, 'utf8').replace(/^\uFEFF/, '')
  const cred = JSON.parse(raw) as { client_email?: string; private_key?: string }
  const privateKey = String(cred.private_key || '')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .trim()
  const clientEmail = String(cred.client_email || '').trim()
  if (!privateKey || !clientEmail) {
    throw new Error('Service account credentials thiếu client_email/private_key.')
  }

  const key = await jose.importPKCS8(privateKey, 'RS256')
  const now = Math.floor(Date.now() / 1000)
  const jwt = await new jose.SignJWT({ scope: 'https://www.googleapis.com/auth/cloud-platform' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(clientEmail)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .setSubject(clientEmail)
    .sign(key)

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  if (!tokenRes.ok) {
    const err = await tokenRes.text()
    throw new Error(`Google OAuth token failed: ${tokenRes.status} ${err}`)
  }
  const tokenData = (await tokenRes.json()) as { access_token: string; expires_in: number }
  cachedGoogleCloudToken = { token: tokenData.access_token, exp: Date.now() + tokenData.expires_in * 1000 }
  return tokenData.access_token
}

async function googleCloudTtsSynthesize(
  text: string,
  locale: string,
  teacherGender?: 'male' | 'female'
): Promise<TtsExtracted> {
  const token = await getGoogleCloudAccessToken()
  const languageCode = (locale || 'en-US').trim() || 'en-US'
  const ssmlGender = teacherGender === 'male' ? 'MALE' : teacherGender === 'female' ? 'FEMALE' : 'NEUTRAL'
  const ssml = buildMultilingualSsml(text, languageCode)
  const res = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      input: ssml ? { ssml } : { text },
      voice: {
        languageCode,
        ssmlGender,
      },
      audioConfig: {
        audioEncoding: 'LINEAR16',
        speakingRate: 1.0,
      },
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Google Cloud TTS failed: ${res.status} ${err}`)
  }
  const data = (await res.json()) as { audioContent?: string }
  const b64 = typeof data.audioContent === 'string' ? data.audioContent : ''
  if (!b64) return null
  return { audioBase64: b64, mimeType: 'audio/wav' }
}

export async function POST(request: NextRequest) {
  try {
    const requestId = `tts_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    const apiKey = process.env.GOOGLE_API_KEY
    const payload = (await request.json()) as Payload
    const rawText = String(payload.text || '').trim()
    const normalizedText = normalizeTextForTts(rawText)
    const text = normalizedText.slice(0, 4500)
    const voiceName = (payload.voiceName || 'Kore') as VoiceName
    const voiceStyle = String(payload.voiceStyle || '').trim()
    const locale = String(payload.locale || '').trim()
    const teacherGender = payload.teacherGender === 'male' || payload.teacherGender === 'female'
      ? payload.teacherGender
      : undefined
    if (!text) {
      return NextResponse.json({ error: 'Thiếu văn bản cần đọc.' }, { status: 400 })
    }
    const normalizedLocale = (locale || 'en-US').trim() || 'en-US'
    const cacheKey = toTtsCacheKey(text, voiceName, normalizedLocale)
    const textHash = createHash('sha256').update(text).digest('hex')
    console.info(
      `[TTS][${requestId}] start locale=${locale || 'n/a'} gender=${teacherGender || 'n/a'} voice=${voiceName} textLen=${text.length}`
    )

    const adminSupabase = adminClient()
    const { data: cachedRows } = await adminSupabase
      .from('language_coach_tts_cache')
      .select('id, audio_base64, mime_type')
      .eq('cache_key', cacheKey)
      .limit(1)
    const cached = Array.isArray(cachedRows) && cachedRows.length > 0 ? cachedRows[0] : null
    if (cached) {
      ttsCacheStats.hit += 1
      void recordCacheMetric(adminSupabase, 'tts_hit')
      void adminSupabase
        .from('language_coach_tts_cache')
        .update({ last_used_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', cached.id)
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
    void recordCacheMetric(adminSupabase, 'tts_miss')
    console.info(`[TTS][${requestId}] cache-miss key=${cacheKey.slice(0, 12)}`)

    let extracted: TtsExtracted = null
    const shorterText = text.length > 600 ? text.slice(0, 600) : text
    const attempts: Array<{ model: string; contents: string; voice: VoiceName }> = [
      { model: 'gemini-2.5-flash-preview-tts', contents: voiceStyle ? `${voiceStyle}\n\nText:\n${text}` : text, voice: voiceName },
      { model: 'gemini-2.5-flash-preview-tts', contents: text, voice: voiceName },
      { model: 'gemini-2.5-flash-preview-tts', contents: shorterText, voice: voiceName },
      { model: 'gemini-2.5-flash-preview-tts', contents: text, voice: 'Kore' },
      { model: 'gemini-2.5-flash-preview-tts', contents: shorterText, voice: 'Kore' },
    ]
    const attemptLogs: AttemptLog[] = []
    let successMeta: { model: string; voice: VoiceName } | null = null

    if (apiKey) {
      const ai = new GoogleGenAI({ apiKey })
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
        try {
          const response = await makeRequest(attempt.model, attempt.contents, attempt.voice)
          extracted = extractAudioFromResponse(response)
          if (extracted) {
            attemptLogs.push({ model: attempt.model, voice: attempt.voice, ok: true })
            successMeta = { model: attempt.model, voice: attempt.voice }
            break
          }
          attemptLogs.push({ model: attempt.model, voice: attempt.voice, ok: false, reason: 'no-audio-inlineData' })
        } catch (e) {
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
    } else {
      attemptLogs.push({ model: 'gemini-2.5-flash-preview-tts', voice: voiceName, ok: false, reason: 'missing-google-api-key' })
    }

    if (!extracted) {
      try {
        const cloudAudio = await googleCloudTtsSynthesize(text, locale, teacherGender)
        if (cloudAudio) {
          attemptLogs.push({ model: 'google-cloud-tts', voice: 'Kore', ok: true })
          const hadGeminiFailure = attemptLogs.some((x) => x.model.includes('gemini') && !x.ok)
          const geminiFirstFailure = attemptLogs.find((x) => x.model.includes('gemini') && !x.ok)
          const geminiErrorCode = geminiFirstFailure?.statusCode || 502
          await adminSupabase.from('language_coach_tts_cache').upsert(
            {
              cache_key: cacheKey,
              text_hash: textHash,
              voice_name: voiceName,
              locale: normalizedLocale,
              mime_type: cloudAudio.mimeType || 'audio/wav',
              audio_base64: cloudAudio.audioBase64,
              source_model: 'google-cloud-tts',
              last_used_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'cache_key' }
          )
          console.warn(
            `[TTS][${requestId}] google-fallback-success hadGeminiFailure=${hadGeminiFailure} attempts=${compactAttempts(attemptLogs)}`
          )
          logTtsCacheStats(requestId)
          return NextResponse.json({
            ...cloudAudio,
            meta: { model: 'google-cloud-tts', voice: teacherGender === 'male' ? 'MALE' : teacherGender === 'female' ? 'FEMALE' : 'NEUTRAL' },
            attempts: attemptLogs,
            warnings: hadGeminiFailure ? ['Gemini TTS lỗi, đã chuyển sang Google Cloud TTS.'] : [],
            geminiErrorCode,
            geminiErrorMessage: geminiFirstFailure?.reason || '',
            cached: false,
          })
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'google-cloud-tts-error'
        attemptLogs.push({ model: 'google-cloud-tts', voice: 'Kore', ok: false, reason: msg.slice(0, 180) })
        console.error(`[TTS][${requestId}] google-fallback-failed reason=${msg}`)
      }
      console.error(`[TTS][${requestId}] all-engines-failed attempts=${compactAttempts(attemptLogs)}`)
      logTtsCacheStats(requestId)
      return NextResponse.json(
        {
          error: 'Không tạo được dữ liệu âm thanh từ cả Gemini TTS và Google Cloud TTS.',
          attempts: attemptLogs,
        },
        { status: 502 }
      )
    }
    console.info(
      `[TTS][${requestId}] gemini-success model=${successMeta?.model || 'unknown'} voice=${successMeta?.voice || 'unknown'} attempts=${compactAttempts(attemptLogs)}`
    )
    await adminSupabase.from('language_coach_tts_cache').upsert(
      {
        cache_key: cacheKey,
        text_hash: textHash,
        voice_name: voiceName,
        locale: normalizedLocale,
        mime_type: extracted.mimeType || 'audio/wav',
        audio_base64: extracted.audioBase64,
        source_model: successMeta?.model || 'gemini-2.5-flash-preview-tts',
        last_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'cache_key' }
    )
    logTtsCacheStats(requestId)

    return NextResponse.json({
      ...extracted,
      meta: successMeta,
      attempts: attemptLogs,
      warnings: [],
      cached: false,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    console.error(`[TTS] unhandled-error ${msg}`)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

