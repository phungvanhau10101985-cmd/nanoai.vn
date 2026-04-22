'use server'
import { deleteTryOnHistoryRowAndStorage } from '@/lib/storage/try-on-history-cleanup'

import { getUserForCreditAction } from '@/lib/auth'
import { insertTryOnHistoryProcessingPg, updateTryOnHistoryCompletedPg } from '@/lib/db/try-on-history-pg'
import { revalidatePath } from 'next/cache'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import sharp from 'sharp'
import { normalizeToEnglish } from '@/lib/ai-normalize'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'
import { getCreditBalanceByUserId } from '@/lib/db/credits-balance'
import { deductUserCredits } from '@/lib/music/deduct-user-credits'


const COSTS = { '2K': 1.5, '4K': 3 } as const
const VALID_ASPECT_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'] as const
const SKETCH_MODES = ['2d', 'color', '3d'] as const
type SketchMode = (typeof SKETCH_MODES)[number]

const MAX_OPTIONAL_PROMPT = 4000
const MAX_FILE_BYTES = 8 * 1024 * 1024
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

const toTenths = (value: number) => Math.round(value * 10)
const formatCredits = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

const MODE_DIRECTIVES: Record<SketchMode, string> = {
  '2d': `OUTPUT STYLE (mandatory): Rebuild the sketch into a polished **2D flat illustration** — clear linework or clean vector-like shapes, flat or light cel shading, readable silhouette, **no** photorealistic 3D or heavy depth cues. Preserve composition and subjects from the sketch. One single image, no watermark, no UI frames.`,
  color: `OUTPUT STYLE (mandatory): Rebuild the sketch into a **full-color finished illustration** — harmonious palette, shading, and material suggestion (digital paint or refined illustration OK). Stay faithful to the sketch layout and subjects. One single image, no watermark.`,
  '3d': `OUTPUT STYLE (mandatory): Rebuild the sketch as a **3D-style render** — believable volume, perspective, materials, and lighting (stylized or realistic CGI). Keep the same idea and layout as the sketch. One single image, no watermark.`,
}

const BASE_INSTRUCTION = `You are an image assistant. The user attached a **sketch** (hand-drawn lines, doodle, or rough draft). Reconstruct it into ONE finished image that follows the style mode instructions below. The sketch is the primary guide for composition, subjects, and poses. Optional user text may add detail. Do not add unrelated objects. Return only the generated image.`

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
] as const

async function shrinkSketchForModel(input: Buffer, mimeHint: string): Promise<{ mimeType: string; data: string }> {
  const MAX_EDGE = 1536
  try {
    let pipeline = sharp(input).rotate()
    const meta = await pipeline.metadata()
    const w = meta.width ?? 0
    const h = meta.height ?? 0
    if (w > MAX_EDGE || h > MAX_EDGE) {
      pipeline = pipeline.resize({
        width: w >= h ? MAX_EDGE : undefined,
        height: h > w ? MAX_EDGE : undefined,
        fit: 'inside',
        withoutEnlargement: true,
      })
    }
    const buf = await pipeline.jpeg({ quality: 85, mozjpeg: true }).toBuffer()
    return { mimeType: 'image/jpeg', data: buf.toString('base64') }
  } catch {
    const mt = ALLOWED_MIME.has(mimeHint) ? mimeHint : 'image/jpeg'
    return { mimeType: mt, data: input.toString('base64') }
  }
}

/** Dựng ảnh hoàn chỉnh từ ảnh phác thảo; 3 kiểu: 2d | color | 3d. 2K/4K credits giống text-to-image. */
export async function createImageFromSketch(formData: FormData) {
  if (!formData || typeof formData.get !== 'function') {
    return { error: 'Dữ liệu không hợp lệ. Vui lòng thử lại.' }
  }

  const sketch = formData.get('sketchImage') as File | null
  if (!sketch || !(sketch instanceof File) || sketch.size < 1) {
    return { error: 'Vui lòng tải lên một ảnh phác thảo.' }
  }
  if (!sketch.type.startsWith('image/') || !ALLOWED_MIME.has(sketch.type)) {
    return { error: 'Ảnh phác thảo phải là JPEG, PNG, WebP hoặc GIF.' }
  }
  if (sketch.size > MAX_FILE_BYTES) {
    return { error: `Ảnh quá lớn (tối đa ${Math.round(MAX_FILE_BYTES / (1024 * 1024))}MB).` }
  }

  const modeRaw = ((formData.get('sketchMode') as string) || 'color').trim().toLowerCase()
  const sketchMode: SketchMode = SKETCH_MODES.includes(modeRaw as SketchMode) ? (modeRaw as SketchMode) : 'color'

  const rawOptional = ((formData.get('optionalPrompt') as string) || '').trim().slice(0, MAX_OPTIONAL_PROMPT)

  const imageQuality = (formData.get('imageQuality') as '2K' | '4K') || '2K'
  const aspectRatioRaw = (formData.get('aspectRatio') as string)?.trim() || '1:1'
  const aspectRatio = VALID_ASPECT_RATIOS.includes(aspectRatioRaw as (typeof VALID_ASPECT_RATIOS)[number])
    ? aspectRatioRaw
    : '1:1'

  const COST = COSTS[imageQuality]

  const apiKey = process.env.GOOGLE_API_KEY?.trim()
  if (!apiKey) {
    return { error: 'Thiếu cấu hình GOOGLE_API_KEY.' }
  }

  const result = await getUserForCreditAction()
  if ('error' in result) return { error: result.error }
  const { user } = result

  let openBalance = 0
  try {
    openBalance = await getCreditBalanceByUserId(user.id)
  } catch {
    return { error: 'Không đọc được số dư credits.' }
  }
  if (toTenths(openBalance) < toTenths(COST)) {
    return { error: `Không đủ credits. Cần ${formatCredits(COST)} credits, hiện có ${formatCredits(openBalance)}.` }
  }

  let sketchBuffer: Buffer
  try {
    sketchBuffer = Buffer.from(await sketch.arrayBuffer())
  } catch {
    return { error: 'Không đọc được file ảnh phác thảo.' }
  }

  const timestamp = Date.now()
  const uploadPath = `uploads/${user.id}/sketch_rebuild_${timestamp}.jpg`
  let sketchOriginalPublicUrl: string
  try {
    const jpegBuf = await sharp(sketchBuffer).rotate().jpeg({ quality: 88, mozjpeg: true }).toBuffer()
    ;({ publicUrl: sketchOriginalPublicUrl } = await uploadTryOnImagePublic(uploadPath, jpegBuf, {
      contentType: 'image/jpeg',
      upsert: true,
    }))
  } catch {
    try {
      ;({ publicUrl: sketchOriginalPublicUrl } = await uploadTryOnImagePublic(uploadPath, sketchBuffer, {
        contentType: sketch.type || 'image/jpeg',
        upsert: true,
      }))
    } catch {
      return { error: 'Không tải được ảnh phác thảo lên máy chủ.' }
    }
  }

  const historyItem = await insertTryOnHistoryProcessingPg({
    userId: user.id,
    originalImageUrl: sketchOriginalPublicUrl,
    garmentImageUrl: sketchOriginalPublicUrl,
    feature: 'du-anh-tu-phac-thao',
  })
  if (!historyItem) return { error: 'Không thể khởi tạo phiên xử lý.' }

  let inline: { mimeType: string; data: string }
  try {
    inline = await shrinkSketchForModel(sketchBuffer, sketch.type || 'image/jpeg')
  } catch {
    await deleteTryOnHistoryRowAndStorage(historyItem.id)
    return { error: 'Không xử lý được ảnh phác thảo.' }
  }

  const optionalEn =
    rawOptional.length > 0 ? (await normalizeToEnglish(rawOptional).catch(() => rawOptional)) || rawOptional : ''
  const notesBlock =
    optionalEn.length > 0
      ? `\n\nUSER OPTIONAL NOTES (may refine colors, subject, or style details):\n${optionalEn}`
      : ''

  const instruction = `${BASE_INSTRUCTION}\n\n${MODE_DIRECTIVES[sketchMode]}${notesBlock}`

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-3-pro-image-preview',
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { imageSize: imageQuality, aspectRatio },
    },
  })

  try {
    const genResult = await model.generateContent(
      [{ text: instruction }, { inlineData: { mimeType: inline.mimeType, data: inline.data } }] as never,
      { safetySettings: [...safetySettings] } as never
    )
    const response = genResult.response
    void trackFromUsageMetadata(response.usageMetadata, 'gemini-3-pro-image-preview', 'du-anh-tu-phac-thao', user.id, imageQuality)

    const cand = response.candidates?.[0]
    if (!cand) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: 'AI không trả về kết quả. Thử lại sau.' }
    }
    if (cand.finishReason === 'SAFETY') {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: 'Phản hồi bị chặn bộ lọc an toàn. Thử ảnh hoặc ghi chú khác.' }
    }

    const imagePartRes = cand.content?.parts?.find((p) => 'inlineData' in p)
    if (!imagePartRes || !('inlineData' in imagePartRes)) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: 'AI không trả về ảnh hợp lệ.' }
    }
    const resultBuffer = Buffer.from((imagePartRes as { inlineData: { data: string } }).inlineData.data, 'base64')
    const resultPath = `results/${user.id}/sketch_rebuild_${Date.now()}.png`
    const { publicUrl: sketchResultPublicUrl } = await uploadTryOnImagePublic(resultPath, resultBuffer, {
      contentType: 'image/png',
      upsert: true,
    })

    const d = await deductUserCredits(user.id, COST)
    if (!d.ok) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: d.code === 'INSUFFICIENT_CREDITS' ? 'Không đủ credits để hoàn tất.' : d.error }
    }
    await updateTryOnHistoryCompletedPg(historyItem.id, sketchResultPublicUrl, {
      feature: 'du-anh-tu-phac-thao',
      aspect_ratio: aspectRatio,
    })

    revalidatePath('/du-anh-tu-phac-thao')
    revalidatePath('/dashboard/history')
    return { success: true, resultUrl: sketchResultPublicUrl }
  } catch (e) {
    await deleteTryOnHistoryRowAndStorage(historyItem.id)
    const msg = e instanceof Error ? e.message : String(e)
    if (/500|Internal Server Error|Internal error/i.test(msg)) {
      return { error: 'Hệ thống quá tải. Thử chọn 2K hoặc thử lại sau ít phút.' }
    }
    if (/429|resource_exhausted|quota/i.test(msg)) {
      return { error: 'API tạm quá tải hoặc hết hạn mức. Thử lại sau vài phút.' }
    }
    return { error: `Dựng ảnh thất bại: ${msg}` }
  }
}
