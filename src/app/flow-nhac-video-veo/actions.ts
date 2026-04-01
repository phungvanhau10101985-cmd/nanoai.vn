'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { GoogleGenAI, VideoGenerationReferenceType } from '@google/genai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'
import { downloadVeoVideoToBuffer } from '@/lib/gemini/download-veo-video-buffer'
import {
  formatGoogleGenAiCaughtErrorForLyrics,
  formatGoogleGenAiCaughtErrorForVeoCreate,
} from '@/lib/gemini/google-genai-error-message'
import { TRY_ON_HISTORY_INPUT_PLACEHOLDER_SRC } from '@/lib/try-on-history-placeholder'
import { trackApiUsage, trackFromUsageMetadata } from '@/lib/track-ai-usage'
import {
  buildMusicVideoVeoStandaloneClipPrompt,
  buildMusicVideoVeoUserPrompt,
  defaultOpeningFromFullLyrics,
  describeMusicStyleForVeoEn,
  type BpmPreset,
  type DensityPreset,
  type LyriaGenreId,
  type StructurePreset,
  type VoiceGenderId,
  type VoiceLangId,
  type VoiceTimbreId,
} from '@/lib/music/music-video-veo-prompt'
import { writeFile, readFile, mkdtemp, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { concatMp4AbsolutePathsToFile } from '@/lib/video/concat-mp4-with-ffmpeg'

const toTenths = (v: number) => Math.round(v * 10)
const fromTenths = (v: number) => v / 10
const formatCredits = (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

const LYRICS_CREDITS = 1
const CLIP_CREDITS = 8
const LOCALE_OUTPUT: Record<string, string> = {
  vi: 'Vietnamese',
  en: 'English',
  zh: 'Chinese (Simplified)',
  ja: 'Japanese',
  ko: 'Korean',
}

const MAX_LYRICS_BLOCKS = 20

function cleanMusicLyricsJsonResponse(raw: string): string {
  let t = raw.trim()
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  }
  return t.trim()
}

type LyricsSegmentsJson = { segments?: unknown }
type LyricsOneJson = { lyrics?: unknown }

function parseStyleFromForm(formData: FormData) {
  return {
    genre: String(formData.get('genre') ?? 'pop') as LyriaGenreId,
    voiceGender: String(formData.get('voiceGender') ?? 'auto') as VoiceGenderId,
    voiceTimbre: String(formData.get('voiceTimbre') ?? 'auto') as VoiceTimbreId,
    voiceLanguage: String(formData.get('voiceLanguage') ?? 'auto') as VoiceLangId,
    bpmPreset: String(formData.get('bpmPreset') ?? 'auto') as BpmPreset,
    structurePreset: String(formData.get('structurePreset') ?? 'auto') as StructurePreset,
    densityPreset: String(formData.get('densityPreset') ?? 'auto') as DensityPreset,
  }
}

/** Gemini 2.5 Flash: lời theo từng block (~8s), trả JSON segments liên kết cùng một bài. */
export async function generateMusicVideoLyrics(formData: FormData) {
  const hint = String(formData.get('hint') ?? '').trim()
  const locale = String(formData.get('locale') ?? 'vi').toLowerCase()
  const langOut = LOCALE_OUTPUT[locale] ?? LOCALE_OUTPUT.vi
  const image = formData.get('lyricsImage') as File | null
  const blockCount = Math.min(
    MAX_LYRICS_BLOCKS,
    Math.max(1, Math.floor(Number(formData.get('blockCount') ?? 2)))
  )

  if (hint.length < 4 && (!image || image.size === 0)) {
    return { error: 'Nhập gợi ý ít nhất 4 ký tự hoặc tải ảnh tham chiếu.' }
  }

  const supabase = createClient()
  const adminSupabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const result = await getUserForAction(() => supabase.auth.getUser())
  if ('error' in result) return { error: result.error }
  const { user } = result

  const { data: creditData, error: creditError } = await supabase
    .from('credits')
    .select('balance')
    .eq('user_id', user.id)
    .single()
  if (creditError || !creditData || toTenths(creditData.balance) < toTenths(LYRICS_CREDITS)) {
    return {
      error: `Không đủ credits. Cần ${formatCredits(LYRICS_CREDITS)} credits để sinh lời.`,
    }
  }

  const apiKey = process.env.GOOGLE_API_KEY?.trim()
  if (!apiKey) return { error: 'Thiếu cấu hình GOOGLE_API_KEY.' }

  const sys = `You are a professional songwriter. Reply with ONLY valid JSON (no markdown code fences, no commentary).
Schema exactly:
{"segments":[{"lyrics":"..."},...]}

Rules:
- The array "segments" MUST have exactly ${blockCount} items, in performance order (block 1 first, then 2, …).
- Each "lyrics" is ONE block meant for ~8 seconds of singing in a music video: short lines, lip-sync friendly (about 2–6 short lines per block, not one huge paragraph).
- All blocks are ONE continuous song: same narrative/mood, logical progression (e.g. verse → pre-chorus → chorus across blocks as fits). Each next block naturally follows the previous; no random topic jumps.
- Target language for every "lyrics" string: ${langOut}.
- No chord symbols. Escape double quotes inside strings for valid JSON.`

  const styleContextEn = String(formData.get('styleContextEn') ?? '').trim()
  const styleBlock = styleContextEn
    ? `\n\nOptional musical direction (keep lyrics matching this vibe; do not put chord symbols in lyrics):\n${styleContextEn}\n`
    : ''

  const userText =
    (hint.length >= 4
      ? `Theme / instructions for the whole song:\n${hint}\n\nRemember: ${blockCount} segments in JSON only.`
      : `Write a cohesive ${blockCount}-block song inspired by the attached image (mood, scene, colors). JSON only as specified.`) + styleBlock

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      ...GEMINI_25_FLASH_NO_THINKING,
      generationConfig: {
        temperature: 0.85,
        maxOutputTokens: Math.min(8192, 800 + blockCount * 400),
        responseMimeType: 'application/json',
      },
    })

    let resText = ''
    if (image && image.size > 0) {
      const buf = Buffer.from(await image.arrayBuffer())
      const b64 = buf.toString('base64')
      const r = await model.generateContent([
        `${sys}\n\n${userText}`,
        {
          inlineData: {
            mimeType: image.type || 'image/jpeg',
            data: b64,
          },
        },
      ])
      await trackFromUsageMetadata(
        r.response.usageMetadata,
        GEMINI_25_FLASH_NO_THINKING.model,
        'music-video-lyrics-flash',
        user.id
      )
      resText = r.response.text()?.trim() ?? ''
    } else {
      const r = await model.generateContent([{ text: `${sys}\n\n${userText}` }])
      await trackFromUsageMetadata(
        r.response.usageMetadata,
        GEMINI_25_FLASH_NO_THINKING.model,
        'music-video-lyrics-flash',
        user.id
      )
      resText = r.response.text()?.trim() ?? ''
    }

    if (!resText || resText.length < 10) {
      return { error: 'Model không trả lời đủ dữ liệu. Thử gợi ý khác.' }
    }

    let parsed: LyricsSegmentsJson
    try {
      parsed = JSON.parse(cleanMusicLyricsJsonResponse(resText)) as LyricsSegmentsJson
    } catch {
      return { error: 'Model trả JSON không hợp lệ. Thử lại.' }
    }

    const rawSegs = Array.isArray(parsed.segments) ? parsed.segments : []
    const segments: string[] = []
    for (let i = 0; i < blockCount; i++) {
      const item = rawSegs[i]
      const text =
        item && typeof item === 'object' && item !== null && 'lyrics' in item
          ? String((item as { lyrics?: unknown }).lyrics ?? '').trim()
          : typeof item === 'string'
            ? item.trim()
            : ''
      segments.push(text)
    }

    if (segments.some((s) => s.length < 4)) {
      return { error: 'Một số đoạn lời quá ngắn hoặc thiếu. Thử lại với gợi ý rõ hơn.' }
    }

    const lyrics = segments.join('\n\n')

    const newBalance = fromTenths(toTenths(creditData.balance) - toTenths(LYRICS_CREDITS))
    await adminSupabase.from('credits').update({ balance: newBalance }).eq('user_id', user.id)

    revalidatePath('/flow-nhac-video-veo')
    return { success: true as const, lyrics, segments }
  } catch (e) {
    return { error: formatGoogleGenAiCaughtErrorForLyrics(e) }
  }
}

const MIN_LYRICS_BLOCK_CHARS = 8

/** Chuẩn hóa phản hồi model: văn bản thuần; vẫn thử đọc JSON {"lyrics"} nếu model cũ trả kiểu đó. */
function normalizeSegmentLyricsFromModelResponse(raw: string): string {
  let t = raw.trim()
  if (!t) return ''
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:\w*)?\s*/i, '').replace(/\s*```$/i, '').trim()
  }
  if (t.startsWith('{') && /"lyrics"\s*:/.test(t)) {
    try {
      const parsed = JSON.parse(cleanMusicLyricsJsonResponse(t)) as LyricsOneJson
      const inner = String(parsed.lyrics ?? '').trim()
      if (inner.length >= MIN_LYRICS_BLOCK_CHARS) return inner
    } catch {
      /* dùng văn bản thuần */
    }
  }
  return t.replace(/^(lyrics|lời)\s*:\s*/i, '').trim()
}

/**
 * Sinh đúng MỘT đoạn (block k / N) — mỗi lần gửi đủ ngữ cảnh: gợi ý, ảnh (nếu có), toàn bộ đoạn trước nguyên văn, hướng âm nhạc.
 */
export async function generateMusicVideoLyricsNextSegment(formData: FormData) {
  const hint = String(formData.get('hint') ?? '').trim()
  const locale = String(formData.get('locale') ?? 'vi').toLowerCase()
  const langOut = LOCALE_OUTPUT[locale] ?? LOCALE_OUTPUT.vi
  const image = formData.get('lyricsImage') as File | null
  const blockCount = Math.min(
    MAX_LYRICS_BLOCKS,
    Math.max(1, Math.floor(Number(formData.get('blockCount') ?? 2)))
  )
  const segmentOneBased = Math.min(
    blockCount,
    Math.max(1, Math.floor(Number(formData.get('segmentOneBased') ?? 1)))
  )
  const styleContextEn = String(formData.get('styleContextEn') ?? '').trim()

  let prior: string[] = []
  try {
    const raw = String(formData.get('priorSegmentsJson') ?? '').trim()
    const p = JSON.parse(raw) as unknown
    if (!Array.isArray(p)) return { error: 'Danh sách đoạn trước (JSON) không hợp lệ.' }
    prior = p.map((x) => String(x).trim())
  } catch {
    return { error: 'Không đọc được đoạn trước (JSON).' }
  }

  if (prior.length !== segmentOneBased - 1) {
    return {
      error: `Cần đúng ${segmentOneBased - 1} đoạn lời trước (đã có) để sinh đoạn ${segmentOneBased}.`,
    }
  }

  for (let i = 0; i < prior.length; i++) {
    if (prior[i]!.length < MIN_LYRICS_BLOCK_CHARS) {
      return { error: `Đoạn ${i + 1} quá ngắn — hoàn thiện (≥${MIN_LYRICS_BLOCK_CHARS} ký tự) trước khi sinh tiếp.` }
    }
  }

  if (hint.length < 4 && (!image || image.size === 0)) {
    return { error: 'Nhập gợi ý ít nhất 4 ký tự hoặc tải ảnh tham chiếu.' }
  }

  const supabase = createClient()
  const adminSupabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const result = await getUserForAction(() => supabase.auth.getUser())
  if ('error' in result) return { error: result.error }
  const { user } = result

  const { data: creditData, error: creditError } = await supabase
    .from('credits')
    .select('balance')
    .eq('user_id', user.id)
    .single()
  if (creditError || !creditData || toTenths(creditData.balance) < toTenths(LYRICS_CREDITS)) {
    return {
      error: `Không đủ credits. Cần ${formatCredits(LYRICS_CREDITS)} credits mỗi lần sinh một đoạn.`,
    }
  }

  const apiKey = process.env.GOOGLE_API_KEY?.trim()
  if (!apiKey) return { error: 'Thiếu cấu hình GOOGLE_API_KEY.' }

  const priorBlock =
    prior.length === 0
      ? '(No prior segments yet — this is the opening block of the song.)'
      : prior
          .map((text, idx) => `--- Previously written segment ${idx + 1} of ${blockCount} (verbatim, do not repeat; continue naturally) ---\n${text}`)
          .join('\n\n')

  const sys = `You are a professional songwriter. Reply with ONLY the lyrics text for this one segment — plain text, not JSON.

Hard rules:
- No JSON, no markdown code fences, no headings, no preamble or postscript (do not write "Here are the lyrics" or similar).
- You may use normal line breaks between short lines of the song.
- You are writing segment ${segmentOneBased} of ${blockCount} for ONE continuous song (same narrative, mood, rhyme feel, and language as the prior segments).
- This block is for ~8 seconds of singing: short lines, lip-sync friendly (about 2–6 short lines, not one huge paragraph).
- Naturally follow the prior segments; no random topic jump; do not repeat large chunks of prior text.
- Target language: ${langOut}.
- No chord symbols.`

  const userParts: string[] = []
  if (hint.length >= 4) {
    userParts.push(`Global theme / instructions for the ENTIRE song (always apply):\n${hint}`)
  } else {
    userParts.push('The attached image sets mood and theme for the entire song; stay consistent with prior segments.')
  }
  userParts.push(`\nFull context — prior lyrics so far:\n${priorBlock}`)
  userParts.push(
    `\nNow write ONLY segment ${segmentOneBased} of ${blockCount} as plain lyrics text. Do not include other segments.`
  )
  if (styleContextEn) {
    userParts.push(
      `\nOptional musical direction (match this vibe in word choice and rhythm; no chord symbols in lyrics):\n${styleContextEn}`
    )
  }
  const userText = userParts.join('\n')

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      ...GEMINI_25_FLASH_NO_THINKING,
      generationConfig: {
        temperature: 0.85,
        maxOutputTokens: 1024,
      },
    })

    let resText = ''
    if (image && image.size > 0) {
      const buf = Buffer.from(await image.arrayBuffer())
      const b64 = buf.toString('base64')
      const r = await model.generateContent([
        `${sys}\n\n${userText}`,
        {
          inlineData: {
            mimeType: image.type || 'image/jpeg',
            data: b64,
          },
        },
      ])
      await trackFromUsageMetadata(
        r.response.usageMetadata,
        GEMINI_25_FLASH_NO_THINKING.model,
        'music-video-lyrics-flash-segment',
        user.id
      )
      resText = r.response.text()?.trim() ?? ''
    } else {
      const r = await model.generateContent([{ text: `${sys}\n\n${userText}` }])
      await trackFromUsageMetadata(
        r.response.usageMetadata,
        GEMINI_25_FLASH_NO_THINKING.model,
        'music-video-lyrics-flash-segment',
        user.id
      )
      resText = r.response.text()?.trim() ?? ''
    }

    if (!resText || resText.length < 8) {
      return { error: 'Model không trả lời đủ dữ liệu. Thử gợi ý khác.' }
    }

    const lyrics = normalizeSegmentLyricsFromModelResponse(resText)
    if (lyrics.length < MIN_LYRICS_BLOCK_CHARS) {
      return { error: 'Đoạn lời trả về quá ngắn hoặc không đọc được. Thử lại.' }
    }

    const newBalance = fromTenths(toTenths(creditData.balance) - toTenths(LYRICS_CREDITS))
    await adminSupabase.from('credits').update({ balance: newBalance }).eq('user_id', user.id)

    revalidatePath('/flow-nhac-video-veo')
    return {
      success: true as const,
      lyrics,
      segmentOneBased,
      blockCount,
    }
  } catch (e) {
    return { error: formatGoogleGenAiCaughtErrorForLyrics(e) }
  }
}

/**
 * Clip 8s 720p — 1 ảnh khung đầu HOẶC 2–3 ảnh tham chiếu (API không cho trùng hai chế độ).
 */
export async function createMusicVideoVeo8s(formData: FormData) {
  const aspectRatio = String(formData.get('aspectRatio') ?? '16:9') === '9:16' ? '9:16' : '16:9'
  const fullLyrics = String(formData.get('fullLyrics') ?? '').trim()
  let openingLyrics = String(formData.get('openingLyrics') ?? '').trim()
  const visualExtra = String(formData.get('visualExtra') ?? '').trim()
  const style = parseStyleFromForm(formData)
  const styleEn = describeMusicStyleForVeoEn(style)

  if (fullLyrics.length < 12) {
    return { error: 'Cần lời bài hát (hoặc sinh lời trước).' }
  }
  if (!openingLyrics) {
    openingLyrics = defaultOpeningFromFullLyrics(fullLyrics)
  }
  if (openingLyrics.length < 8) {
    return { error: 'Đoạn lời đầu quá ngắn — hãy thêm vài dòng cho clip 8 giây.' }
  }

  const segTotalRaw = formData.get('segmentTotal')
  const segIdxRaw = formData.get('segmentIndex')
  const segmentTotal =
    segTotalRaw != null && String(segTotalRaw).trim() !== ''
      ? Math.min(20, Math.max(1, Math.floor(Number(segTotalRaw))))
      : 1
  const segmentIndex =
    segIdxRaw != null && String(segIdxRaw).trim() !== ''
      ? Math.max(0, Math.floor(Number(segIdxRaw)))
      : 0

  const frames = (formData.getAll('frames') as File[]).filter((f) => f && f.size > 0)
  if (frames.length === 0) {
    return { error: 'Cần ít nhất một ảnh.' }
  }
  if (frames.length > 3) {
    return { error: 'Tối đa 3 ảnh.' }
  }

  const userPrompt =
    segmentTotal > 1
      ? buildMusicVideoVeoStandaloneClipPrompt(openingLyrics, styleEn, visualExtra, segmentIndex, segmentTotal)
      : buildMusicVideoVeoUserPrompt(openingLyrics, styleEn, visualExtra)

  const supabase = createClient()
  const adminSupabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const result = await getUserForAction(() => supabase.auth.getUser())
  if ('error' in result) return { error: result.error }
  const { user } = result

  const { data: creditData, error: creditError } = await supabase
    .from('credits')
    .select('balance')
    .eq('user_id', user.id)
    .single()
  if (creditError || !creditData || toTenths(creditData.balance) < toTenths(CLIP_CREDITS)) {
    return {
      error: `Không đủ credits. Cần ${formatCredits(CLIP_CREDITS)} credits.`,
    }
  }

  const ts = Date.now()
  const uploadedUrls: string[] = []
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i]
    const path = `uploads/${user.id}/mv_frame_${ts}_${i}.png`
    await supabase.storage.from('try-on-images').upload(path, f)
    const { data: u } = supabase.storage.from('try-on-images').getPublicUrl(path)
    uploadedUrls.push(u.publicUrl)
  }

  const { data: historyItem, error: historyError } = await supabase
    .from('try_on_history')
    .insert({
      user_id: user.id,
      original_image_url: uploadedUrls[0] ?? TRY_ON_HISTORY_INPUT_PLACEHOLDER_SRC,
      garment_image_url: uploadedUrls[1] ?? uploadedUrls[0] ?? TRY_ON_HISTORY_INPUT_PLACEHOLDER_SRC,
      status: 'processing',
      feature: 'veo-music-video-8s',
      aspect_ratio: aspectRatio,
    })
    .select()
    .single()

  if (historyError || !historyItem) return { error: 'Không thể khởi tạo phiên xử lý.' }

  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) {
    await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
    return { error: 'Thiếu cấu hình GOOGLE_API_KEY.' }
  }

  try {
    const ai = new GoogleGenAI({ apiKey })

    const baseConfig = {
      resolution: '720p' as const,
      durationSeconds: 8,
      aspectRatio,
      personGeneration: 'allow_adult' as const,
    }

    let operation
    if (frames.length === 1) {
      const f = frames[0]
      operation = await ai.models.generateVideos({
        model: 'veo-3.1-generate-preview',
        prompt: userPrompt,
        image: {
          imageBytes: Buffer.from(await f.arrayBuffer()).toString('base64'),
          mimeType: f.type || 'image/png',
        },
        config: baseConfig,
      })
    } else {
      const referenceImages = await Promise.all(
        frames.slice(0, 3).map(async (f) => ({
          image: {
            imageBytes: Buffer.from(await f.arrayBuffer()).toString('base64'),
            mimeType: f.type || 'image/png',
          },
          referenceType: VideoGenerationReferenceType.ASSET,
        }))
      )
      operation = await ai.models.generateVideos({
        model: 'veo-3.1-generate-preview',
        prompt: userPrompt,
        config: {
          ...baseConfig,
          referenceImages,
        },
      })
    }

    let op = operation
    const maxAttempts = 60
    for (let i = 0; i < maxAttempts; i++) {
      if (op.done) break
      await new Promise((r) => setTimeout(r, 10000))
      op = await ai.operations.getVideosOperation({ operation: op })
    }

    if (!op.done || !op.response?.generatedVideos?.[0]?.video) {
      await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
      return { error: 'AI không tạo được video. Vui lòng thử lại.' }
    }

    const genVideo = op.response.generatedVideos[0].video
    if (!genVideo) {
      await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
      return { error: 'Không lấy được dữ liệu video.' }
    }
    const videoBuffer = await downloadVeoVideoToBuffer(ai, genVideo, apiKey)

    const resultPath = `results/${user.id}/veo_mv_${Date.now()}.mp4`
    await adminSupabase.storage
      .from('try-on-images')
      .upload(resultPath, videoBuffer, { contentType: 'video/mp4', upsert: true })
    const { data: urlData } = adminSupabase.storage.from('try-on-images').getPublicUrl(resultPath)

    const newBalance = fromTenths(toTenths(creditData.balance) - toTenths(CLIP_CREDITS))
    await adminSupabase.from('credits').update({ balance: newBalance }).eq('user_id', user.id)

    const geminiUri = typeof genVideo?.uri === 'string' && genVideo.uri.length > 0 ? genVideo.uri : null
    await adminSupabase
      .from('try_on_history')
      .update({
        result_image_url: urlData.publicUrl,
        status: 'completed',
        ...(geminiUri ? { veo_gemini_video_uri: geminiUri } : {}),
      })
      .eq('id', historyItem.id)

    trackApiUsage({
      userId: user.id,
      model: 'veo-3.1-generate-preview',
      feature: 'tao-video-veo-music-8s',
      promptTokenCount: 0,
      candidatesTokenCount: 0,
      totalTokenCount: 1,
    })

    revalidatePath('/flow-nhac-video-veo')
    revalidatePath('/dashboard/history')
    return { success: true, resultUrl: urlData.publicUrl, historyId: historyItem.id }
  } catch (e) {
    await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
    return { error: formatGoogleGenAiCaughtErrorForVeoCreate(e) }
  }
}

function isUserTryOnResultMp4Url(url: string, userId: string): boolean {
  try {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
    if (!base || !url.startsWith(base)) return false
    const u = new URL(url)
    const path = u.pathname
    const needle = `/storage/v1/object/public/try-on-images/results/${userId}/`
    return path.includes(needle) && /\.mp4($|\?)/i.test(path)
  } catch {
    return false
  }
}

/**
 * Ghép các MP4 đã tạo (cùng user, URL Supabase public) thành một file — không trừ credits.
 * Cần ffmpeg (gói `ffmpeg-static` trên server).
 */
export async function mergeFlowMusicVeoClips(formData: FormData) {
  const raw = String(formData.get('clipUrlsJson') ?? '').trim()
  const aspectRatio = String(formData.get('aspectRatio') ?? '16:9') === '9:16' ? '9:16' : '16:9'

  let clipUrls: unknown
  try {
    clipUrls = JSON.parse(raw)
  } catch {
    return { error: 'Danh sách URL clip không hợp lệ.' }
  }
  if (!Array.isArray(clipUrls) || clipUrls.length < 2) {
    return { error: 'Cần ít nhất 2 clip MP4 để ghép.' }
  }
  const urls = clipUrls.map((u) => String(u ?? '').trim()).filter(Boolean)
  if (urls.length < 2) {
    return { error: 'Cần ít nhất 2 URL hợp lệ.' }
  }
  if (urls.length > 20) {
    return { error: 'Tối đa 20 clip mỗi lần ghép.' }
  }

  const supabase = createClient()
  const adminSupabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const result = await getUserForAction(() => supabase.auth.getUser())
  if ('error' in result) return { error: result.error }
  const { user } = result

  for (const u of urls) {
    if (!isUserTryOnResultMp4Url(u, user.id)) {
      return { error: 'Chỉ được ghép video kết quả của chính tài khoản bạn.' }
    }
  }

  const workDir = await mkdtemp(join(tmpdir(), 'veo-merge-'))
  const inputPaths: string[] = []
  try {
    for (let i = 0; i < urls.length; i++) {
      const r = await fetch(urls[i]!)
      if (!r.ok) {
        return { error: `Không tải được clip ${i + 1} (HTTP ${r.status}).` }
      }
      const buf = Buffer.from(await r.arrayBuffer())
      if (buf.length < 1000) {
        return { error: `Dữ liệu clip ${i + 1} không hợp lệ.` }
      }
      const p = join(workDir, `seg_${i}.mp4`)
      await writeFile(p, buf)
      inputPaths.push(p)
    }

    const outPath = join(workDir, 'merged.mp4')
    try {
      await concatMp4AbsolutePathsToFile(inputPaths, outPath)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (/FFMPEG_NOT_AVAILABLE/i.test(msg)) {
        return { error: 'Máy chủ chưa có ffmpeg để ghép video. Liên hệ quản trị.' }
      }
      return { error: `Ghép video thất bại: ${msg.slice(0, 400)}` }
    }

    const mergedBuf = await readFile(outPath)
    const resultPath = `results/${user.id}/veo_mv_merged_${Date.now()}.mp4`
    await adminSupabase.storage
      .from('try-on-images')
      .upload(resultPath, mergedBuf, { contentType: 'video/mp4', upsert: true })
    const { data: urlData } = adminSupabase.storage.from('try-on-images').getPublicUrl(resultPath)

    await adminSupabase.from('try_on_history').insert({
      user_id: user.id,
      original_image_url: TRY_ON_HISTORY_INPUT_PLACEHOLDER_SRC,
      garment_image_url: TRY_ON_HISTORY_INPUT_PLACEHOLDER_SRC,
      result_image_url: urlData.publicUrl,
      status: 'completed',
      feature: 'veo-music-video-merged',
      aspect_ratio: aspectRatio,
    })

    revalidatePath('/flow-nhac-video-veo')
    revalidatePath('/dashboard/history')
    return { success: true as const, resultUrl: urlData.publicUrl }
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {})
  }
}
