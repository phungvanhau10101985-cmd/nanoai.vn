import { insertMusicGenerationPg } from '@/lib/db/music-generations-pg'
import { getCreditBalanceByUserId } from '@/lib/db/credits-balance'
import { deductUserCredits, refundUserCredits } from '@/lib/music/deduct-user-credits'
import { LYRIA35_MODEL, generateLyria35Audio } from '@/lib/music/lyria35-generate'
import { trackApiUsage } from '@/lib/track-ai-usage'
import { bunnyStorageConfigured, uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'

const LYRIA3_TARGET_SEC = 180 as const
const LYRIA3_CHARGE = 3

const LYRIA3_DURATION_PROMPT =
  '\n\nSong length: about three minutes, with a verse, a chorus, and an outro.'

const INSTRUMENTAL_SUFFIX =
  '\n\nImportant: Instrumental only, no vocals, no singing, no voice. Pure instrumental track.'

export type RunLyriaPipelineInput = {
  userId: string
  prompt: string
}

export type RunLyriaPipelineResult =
  | { ok: true; resultUrl: string; charged: number }
  | { ok: false; error: string }

export async function runLyriaPipeline(input: RunLyriaPipelineInput): Promise<RunLyriaPipelineResult> {
  const promptRaw = input.prompt.trim()
  if (promptRaw.length < 4) return { ok: false, error: 'Prompt quá ngắn (tối thiểu 4 ký tự).' }

  const apiKey = process.env.GOOGLE_API_KEY?.trim()
  if (!apiKey) return { ok: false, error: 'Thiếu GOOGLE_API_KEY.' }
  if (!bunnyStorageConfigured()) return { ok: false, error: 'Thiếu cấu hình Bunny Storage.' }

  let balance = 0
  try {
    balance = await getCreditBalanceByUserId(input.userId)
  } catch {
    return { ok: false, error: 'Không đọc được số dư credits.' }
  }
  if (balance < LYRIA3_CHARGE) {
    return { ok: false, error: `Không đủ credits (cần ${LYRIA3_CHARGE}).` }
  }

  const charged = await deductUserCredits(input.userId, LYRIA3_CHARGE, 'music-lyria3-generate')
  if (!charged.ok) return { ok: false, error: charged.error || 'Không thể trừ credits.' }

  const fullPrompt = `Creative direction from the user:\n${promptRaw}${LYRIA3_DURATION_PROMPT}${INSTRUMENTAL_SUFFIX}`

  try {
    const generated = await generateLyria35Audio({ apiKey, prompt: fullPrompt })
    if (!generated.ok) {
      await refundUserCredits(input.userId, LYRIA3_CHARGE, 'music-lyria3-generate')
      console.error('[hub-lyria]', generated.detail)
      return { ok: false, error: generated.error }
    }

    void trackApiUsage({
      userId: input.userId,
      model: LYRIA35_MODEL,
      feature: 'hub-agent-lyria',
      promptTokenCount: 0,
      candidatesTokenCount: 0,
      totalTokenCount: 1,
    })

    const buffer = Buffer.from(generated.audioBase64, 'base64')
    const ext = generated.mimeType.includes('wav') ? 'wav' : 'mp3'
    const uploadPath = `music-history/${input.userId}/lyria3_pro_180s_instrumental_txt_${Date.now()}.${ext}`
    const { publicUrl } = await uploadTryOnImagePublic(uploadPath, buffer, {
      contentType: generated.mimeType,
      upsert: true,
    })

    await insertMusicGenerationPg({
      userId: input.userId,
      mode: 'lyria3',
      title: 'Lyria 3.5 — ~3 phút (hub agent)',
      style: promptRaw.slice(0, 120),
      durationSeconds: LYRIA3_TARGET_SEC,
      audioUrl: publicUrl,
      chargedCredits: LYRIA3_CHARGE,
    })

    return { ok: true, resultUrl: publicUrl, charged: LYRIA3_CHARGE }
  } catch (e) {
    await refundUserCredits(input.userId, LYRIA3_CHARGE, 'music-lyria3-generate')
    const msg = e instanceof Error ? e.message : 'Lỗi gọi Lyria 3.'
    return { ok: false, error: msg }
  }
}
