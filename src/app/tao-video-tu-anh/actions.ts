'use server'
import { deleteTryOnHistoryRowAndStorage } from '@/lib/storage/try-on-history-cleanup'

import { getUserForAction } from '@/lib/auth'
import {
  getTryOnHistoryRowByIdPg,
  insertTryOnHistoryProcessingPg,
  updateTryOnHistoryCompletedPg,
} from '@/lib/db/try-on-history-pg'
import { revalidatePath } from 'next/cache'
import { GoogleGenAI } from '@google/genai'
import { downloadVeoVideoToBuffer } from '@/lib/gemini/download-veo-video-buffer'
import {
  formatGoogleGenAiCaughtErrorForVeoCreate,
  formatGoogleGenAiCaughtErrorForVeoExtend,
} from '@/lib/gemini/google-genai-error-message'
import { trackApiUsage } from '@/lib/track-ai-usage'
import { TRY_ON_HISTORY_INPUT_PLACEHOLDER_SRC } from '@/lib/try-on-history-placeholder'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'
import { getCreditBalanceByUserId } from '@/lib/db/credits-balance'
import { deductUserCredits } from '@/lib/music/deduct-user-credits'

export type VeoVideoMode = 'text' | 'image'
export type VeoAspectRatio = '16:9' | '9:16'
export type VeoResolution = '720p' | '1080p' | '4k'
export type VeoDuration = 4 | 6 | 8

const toTenths = (v: number) => Math.round(v * 10)
const formatCredits = (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

const DEFAULT_IMAGE_PROMPT =
  'Animate this image with subtle, natural motion. Add gentle movement, ambient effects, or bring the scene to life. Cinematic, photorealistic.'

const DEFAULT_VEO_EXTEND_PROMPT =
  'Continue the scene smoothly with natural motion and consistent lighting. Maintain visual continuity from the ending frames.'

function computeCredits(resolution: VeoResolution, durationSeconds: VeoDuration): number {
  if (resolution === '4k') return 28
  if (resolution === '1080p') return 16
  if (durationSeconds === 4) return 6
  if (durationSeconds === 6) return 7
  return 8
}

function parseForm(formData: FormData): {
  mode: VeoVideoMode
  prompt: string
  aspectRatio: VeoAspectRatio
  resolution: VeoResolution
  durationSeconds: VeoDuration
  image: File | null
} | { error: string } {
  const modeRaw = String(formData.get('mode') ?? 'image').toLowerCase()
  const mode: VeoVideoMode = modeRaw === 'text' ? 'text' : 'image'
  const prompt = String(formData.get('prompt') ?? '').trim()
  const ar = String(formData.get('aspectRatio') ?? '16:9')
  const aspectRatio: VeoAspectRatio = ar === '9:16' ? '9:16' : '16:9'
  const res = String(formData.get('resolution') ?? '720p').toLowerCase()
  const resolution: VeoResolution =
    res === '1080p' ? '1080p' : res === '4k' ? '4k' : '720p'
  const dur = Number(formData.get('durationSeconds'))
  const durationSeconds: VeoDuration = dur === 4 || dur === 6 || dur === 8 ? dur : 8
  const image = formData.get('image') as File | null

  if (mode === 'text' && prompt.length < 8) {
    return { error: 'Vui lòng nhập mô tả video (ít nhất 8 ký tự).' }
  }
  if (mode === 'image' && (!image || image.size === 0)) {
    return { error: 'Cần tải lên ít nhất một ảnh làm khung đầu.' }
  }
  if (resolution === '1080p' && durationSeconds !== 8) {
    return { error: 'Độ phân giải 1080p chỉ hỗ trợ video 8 giây.' }
  }
  if (resolution === '4k') {
    if (durationSeconds !== 8) return { error: '4K chỉ hỗ trợ video 8 giây.' }
    if (aspectRatio !== '16:9') return { error: '4K hiện chỉ hỗ trợ tỷ lệ 16:9.' }
  }

  return { mode, prompt, aspectRatio, resolution, durationSeconds, image }
}

/**
 * Tạo video Veo 3.1: từ văn bản hoặc từ ảnh (khung đầu), có âm thanh.
 */
export async function createVeoVideo(formData: FormData) {
  const parsed = parseForm(formData)
  if ('error' in parsed) return { error: parsed.error }

  const { mode, prompt, aspectRatio, resolution, durationSeconds, image } = parsed
  const COST = computeCredits(resolution, durationSeconds)
  const effectivePrompt =
    mode === 'text'
      ? prompt
      : prompt.length > 0
        ? prompt
        : DEFAULT_IMAGE_PROMPT

  const result = await getUserForAction()
  if ('error' in result) return { error: result.error }
  const { user } = result

  let openBalance = 0
  try {
    openBalance = await getCreditBalanceByUserId(user.id)
  } catch {
    return { error: 'Không đọc được số dư credits.' }
  }
  if (toTenths(openBalance) < toTenths(COST)) {
    return {
      error: `Không đủ credits. Cần ${formatCredits(COST)} credits, hiện có ${formatCredits(openBalance)}.`,
    }
  }

  let originalUrl = TRY_ON_HISTORY_INPUT_PLACEHOLDER_SRC
  let garmentUrl = TRY_ON_HISTORY_INPUT_PLACEHOLDER_SRC

  if (mode === 'image' && image) {
    const timestamp = Date.now()
    const uploadPath = `uploads/${user.id}/video_input_${timestamp}.png`
    const { publicUrl: videoInputPublicUrl } = await uploadTryOnImagePublic(uploadPath, image, {
      contentType: image.type || 'image/png',
    })
    originalUrl = videoInputPublicUrl
    garmentUrl = videoInputPublicUrl
  }

  const historyItem = await insertTryOnHistoryProcessingPg({
    userId: user.id,
    originalImageUrl: originalUrl,
    garmentImageUrl: garmentUrl,
    feature: mode === 'text' ? 'veo-video-text' : 'veo-video-image',
    aspectRatio: aspectRatio,
  })
  if (!historyItem) return { error: 'Không thể khởi tạo phiên xử lý.' }

  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) return { error: 'Thiếu cấu hình GOOGLE_API_KEY.' }

  const trackFeature = mode === 'text' ? 'tao-video-veo-text' : 'tao-video-veo-image'

  try {
    const ai = new GoogleGenAI({ apiKey })

    const imagePayload =
      mode === 'image' && image
        ? {
            imageBytes: Buffer.from(await image.arrayBuffer()).toString('base64'),
            mimeType: image.type || 'image/png',
          }
        : undefined

    const operation = await ai.models.generateVideos({
      model: 'veo-3.1-generate-preview',
      prompt: effectivePrompt,
      ...(imagePayload ? { image: imagePayload } : {}),
      config: {
        resolution,
        durationSeconds,
        aspectRatio,
        personGeneration: mode === 'text' ? 'allow_all' : 'allow_adult',
      },
    })

    let op = operation
    const maxAttempts = 60
    for (let i = 0; i < maxAttempts; i++) {
      if (op.done) break
      await new Promise((r) => setTimeout(r, 10000))
      op = await ai.operations.getVideosOperation({ operation: op })
    }

    if (!op.done || !op.response?.generatedVideos?.[0]?.video) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: 'AI không tạo được video. Vui lòng thử lại.' }
    }

    const genVideo = op.response.generatedVideos[0].video
    if (!genVideo) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: 'Không lấy được dữ liệu video.' }
    }
    const videoBuffer = await downloadVeoVideoToBuffer(ai, genVideo, apiKey)

    const resultPath = `results/${user.id}/veo_${Date.now()}.mp4`
    const { publicUrl: veoResultPublicUrl } = await uploadTryOnImagePublic(resultPath, videoBuffer, {
      contentType: 'video/mp4',
      upsert: true,
    })

    const d = await deductUserCredits(user.id, COST)
    if (!d.ok) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: d.code === 'INSUFFICIENT_CREDITS' ? 'Không đủ credits để hoàn tất.' : d.error }
    }
    const geminiUri = typeof genVideo?.uri === 'string' && genVideo.uri.length > 0 ? genVideo.uri : null
    await updateTryOnHistoryCompletedPg(historyItem.id, veoResultPublicUrl, {
      veo_gemini_video_uri: geminiUri,
    })

    trackApiUsage({
      userId: user.id,
      model: 'veo-3.1-generate-preview',
      feature: trackFeature,
      promptTokenCount: 0,
      candidatesTokenCount: 0,
      totalTokenCount: 1,
    })

    revalidatePath('/tao-video-tu-anh')
    revalidatePath('/flow-nhac-video-veo')
    revalidatePath('/dashboard/history')
    return { success: true, resultUrl: veoResultPublicUrl, historyId: historyItem.id }
  } catch (e) {
    await deleteTryOnHistoryRowAndStorage(historyItem.id)
    return { error: formatGoogleGenAiCaughtErrorForVeoCreate(e) }
  }
}

const VEO_EXTENDABLE_FEATURES = new Set([
  'veo-video-image',
  'veo-video-text',
  'veo-video-extended',
  'veo-music-video-8s',
])
const EXTEND_CREDITS = 8

function aspectRatioFromHistory(ar: string | null | undefined): VeoAspectRatio {
  return ar === '9:16' ? '9:16' : '16:9'
}

/**
 * Kéo dài video Veo (chỉ video do Veo tạo trước đó, URI lưu trong DB).
 * Luôn 720p + 8s theo giới hạn API extension. Không nhận file nhạc tùy chỉnh — âm thanh do Veo sinh.
 */
export async function extendVeoVideo(formData: FormData) {
  const parentId = String(formData.get('parentHistoryId') ?? '').trim()
  const promptRaw = String(formData.get('prompt') ?? '').trim()
  const effectivePrompt = promptRaw.length >= 4 ? promptRaw : DEFAULT_VEO_EXTEND_PROMPT

  if (!parentId) {
    return { error: 'Thiếu mã phiên video gốc.' }
  }

  const result = await getUserForAction()
  if ('error' in result) return { error: result.error }
  const { user } = result

  const parentRow = await getTryOnHistoryRowByIdPg(parentId)

  if (!parentRow || parentRow.user_id !== user.id) {
    return { error: 'Không tìm thấy video gốc hoặc không thuộc tài khoản của bạn.' }
  }
  if (parentRow.status !== 'completed') {
    return { error: 'Video gốc chưa hoàn tất.' }
  }
  if (!parentRow.feature || !VEO_EXTENDABLE_FEATURES.has(parentRow.feature)) {
    return { error: 'Chỉ có thể kéo dài video do Veo tạo (ảnh hoặc văn bản).' }
  }
  const sourceUri = parentRow.veo_gemini_video_uri
  if (!sourceUri) {
    return {
      error:
        'Video này không còn liên kết mở rộng trên Google (quá hạn ~2 ngày hoặc tạo trước khi bật tính năng). Hãy tạo clip 8s 720p mới rồi kéo dài ngay sau đó.',
    }
  }

  let openBalExt = 0
  try {
    openBalExt = await getCreditBalanceByUserId(user.id)
  } catch {
    return { error: 'Không đọc được số dư credits.' }
  }
  if (toTenths(openBalExt) < toTenths(EXTEND_CREDITS)) {
    return {
      error: `Không đủ credits. Cần ${formatCredits(EXTEND_CREDITS)} credits, hiện có ${formatCredits(openBalExt)}.`,
    }
  }

  const veoAspect = aspectRatioFromHistory(parentRow.aspect_ratio)
  const historyItem = await insertTryOnHistoryProcessingPg({
    userId: user.id,
    originalImageUrl: TRY_ON_HISTORY_INPUT_PLACEHOLDER_SRC,
    garmentImageUrl: TRY_ON_HISTORY_INPUT_PLACEHOLDER_SRC,
    feature: 'veo-video-extended',
    aspectRatio: veoAspect,
    veoExtendParentId: parentId,
  })

  if (!historyItem) return { error: 'Không thể khởi tạo phiên kéo dài.' }

  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) return { error: 'Thiếu cấu hình GOOGLE_API_KEY.' }

  try {
    const ai = new GoogleGenAI({ apiKey })

    const operation = await ai.models.generateVideos({
      model: 'veo-3.1-generate-preview',
      prompt: effectivePrompt,
      video: { uri: sourceUri },
      config: {
        resolution: '720p',
        durationSeconds: 8,
        aspectRatio: veoAspect,
        personGeneration: 'allow_all',
      },
    })

    let op = operation
    const maxAttempts = 60
    for (let i = 0; i < maxAttempts; i++) {
      if (op.done) break
      await new Promise((r) => setTimeout(r, 10000))
      op = await ai.operations.getVideosOperation({ operation: op })
    }

    if (!op.done || !op.response?.generatedVideos?.[0]?.video) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: 'AI không kéo dài được video. Vui lòng thử lại.' }
    }

    const genVideo = op.response.generatedVideos[0].video
    if (!genVideo) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: 'Không lấy được dữ liệu video.' }
    }
    const videoBuffer = await downloadVeoVideoToBuffer(ai, genVideo, apiKey)

    const resultPath = `results/${user.id}/veo_extend_${Date.now()}.mp4`
    const { publicUrl: veoExtendResultPublicUrl } = await uploadTryOnImagePublic(resultPath, videoBuffer, {
      contentType: 'video/mp4',
      upsert: true,
    })

    const dExt = await deductUserCredits(user.id, EXTEND_CREDITS)
    if (!dExt.ok) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: dExt.code === 'INSUFFICIENT_CREDITS' ? 'Không đủ credits để hoàn tất.' : dExt.error }
    }

    const geminiUri = typeof genVideo?.uri === 'string' && genVideo.uri.length > 0 ? genVideo.uri : null
    await updateTryOnHistoryCompletedPg(historyItem.id, veoExtendResultPublicUrl, {
      veo_gemini_video_uri: geminiUri,
    })

    trackApiUsage({
      userId: user.id,
      model: 'veo-3.1-generate-preview',
      feature: 'tao-video-veo-extend',
      promptTokenCount: 0,
      candidatesTokenCount: 0,
      totalTokenCount: 1,
    })

    revalidatePath('/tao-video-tu-anh')
    revalidatePath('/flow-nhac-video-veo')
    revalidatePath('/dashboard/history')
    return { success: true, resultUrl: veoExtendResultPublicUrl, historyId: historyItem.id }
  } catch (e) {
    await deleteTryOnHistoryRowAndStorage(historyItem.id)
    return { error: formatGoogleGenAiCaughtErrorForVeoExtend(e) }
  }
}

/** @deprecated Dùng createVeoVideo — giữ tương thích nếu có chỗ cũ gọi. */
export async function createVideoFromImage(formData: FormData) {
  formData.set('mode', 'image')
  return createVeoVideo(formData)
}
