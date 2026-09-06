'use server'
import { deleteTryOnHistoryRowAndStorage } from '@/lib/storage/try-on-history-cleanup'

import { getUserForCreditAction } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import sharp from 'sharp'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { GEMINI_25_FLASH_TEXT_NO_THINKING, GEMINI_3_PRO_IMAGE } from '@/lib/gemini-config'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import { stripBackground } from '@/lib/remove-background'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'
import { insertTryOnHistoryProcessingPg, updateTryOnHistoryCompletedPg } from '@/lib/db/try-on-history-pg'
import { getCreditBalanceByUserId } from '@/lib/db/credits-balance'
import { deductUserCredits } from '@/lib/music/deduct-user-credits'
import { requireGoogleApiKeyForUser } from '@/lib/ai/google-api-key-resolver'
import {
  STICKER_PHOTO_EXPRESSION_IDS,
  type StickerPhotoExpressionId,
} from './sticker-photo-presets'

const STICKER_COSTS = { '2K': 2, '4K': 4 } as const
const VALID_ASPECT_RATIOS = ['1:1', '4:3', '3:4', '16:9', '9:16'] as const

const MAX_PHOTO_BYTES = 8 * 1024 * 1024
const ALLOWED_PHOTO_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_STICKER_CAPTION_LEN = 120

/** Hướng dẫn biểu cảm (tiếng Anh) — gửi model ảnh. */
const PHOTO_EXPRESSION_DIRECTIVES: Record<StickerPhotoExpressionId, string> = {
  happy: 'Warm joyful smile, bright awake eyes.',
  love: 'Affectionate lovestruck look: sparkly eyes / soft blush.',
  cool: 'Relaxed confident half-smirk, subtle cool attitude.',
  lol: 'Big laugh: eyes squinting, wide open happy mouth.',
  sad: 'Cute exaggerated sad eyes; single tear drop comic style (non-graphic).',
  angry: 'Playful comic anger: puff cheeks, furrowed brows.',
  surprised: 'Comic shock: rounded eyes and open mouth.',
  sleepy: 'Drowsy half-lids, tiny yawn, cozy mood.',
  wink: 'One-eye wink with friendly grin.',
  thumbs: 'Upbeat grin; thumbs-up gesture if hands show naturally.',
  custom: 'Interpret mood from caption text alone; neutral-friendly face if unclear.',
}

const PHOTO_STICKER_PROMPT = `TASK: Transform the PERSON in the REFERENCE PHOTO into ONE sticker-style portrait illustration.

RULES — Identity & likeness:
- The output must depict the SAME person as in the reference photo (preserve recognizable facial identity; do not substitute a random fictional character).

RULES — Art style:
- Sticker/portrait vibe: readable bold outlines, cel-shading, bright harmonious colors, glossy cute finish (still clearly based on the real face proportions).
- Full-bleed design: artwork should reach or hug the edges; avoid large empty margins.
- Background must be SOLID PURE WHITE #FFFFFF ONLY (opaque; not transparency yet).

Expression layer (combine with likeness):
- Apply this facial/emotion directive: <<<EXPRESSION_LAYER>>>

Typography (mandatory):
- Render a concise speech bubble, ribbon banner, or rounded sticker label that displays EXACTLY this caption text, character-for-character (same language/script as provided):
<<<CAPTION>>>
Use high-contrast text; keep it legible; no typo substitution.

Do not include watermarks, QR codes, or UI overlays. Output a single raster image only.`

async function shrinkPhotoForStickerModel(input: Buffer, mimeHint: string): Promise<{ mimeType: string; data: string }> {
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
    const mt = ALLOWED_PHOTO_MIME.has(mimeHint) ? mimeHint : 'image/jpeg'
    return { mimeType: mt, data: input.toString('base64') }
  }
}

function sanitizeStickerCaption(raw: string): string {
  const s = raw.replace(/\r|\n/g, ' ').replace(/[<>]/g, '').trim().slice(0, MAX_STICKER_CAPTION_LEN)
  return s
}
const toTenths = (value: number) => Math.round(value * 10)
const formatCredits = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

const STICKER_EXPANSION_PROMPT = `Bạn là nhà thiết kế nhãn dán/sticker. Người dùng đưa ra ý tưởng ngắn gọn về nhãn dán cần tạo. Nhiệm vụ của bạn là mở rộng thành mô tả CHI TIẾT bằng TIẾNG VIỆT để AI vẽ chính xác.

Quy tắc:
- Viết mô tả bằng TIẾNG VIỆT.
- Mô tả đầy đủ: nhân vật/đối tượng chính, phong cách (kawaii, minimalist, cartoon, dễ thương...), màu sắc, chi tiết (mũ, áo, biểu cảm, phụ kiện...), bố cục.
- BỐ CỤC: Nhấn mạnh thiết kế SÁT MÉP KHUNG – chủ thể hoặc chi tiết phụ (lá, bong bóng, viền trang trí...) chạm sát mép ảnh, không để khoảng trống quanh. Ví dụ: "chủ thể chạm sát mép khung", "thiết kế tràn viền", "các chi tiết chạm 2–3 cạnh ảnh".
- Ví dụ mô tả: "Nhãn dán phong cách kawaii: gấu trúc đỏ dễ thương đội mũ tre nhỏ, đang ăn lá trúc xanh. Gấu trúc và lá trúc chạm sát mép khung. Đường nét đậm rõ, tô màu cel-shading đơn giản, màu sắc tươi sáng."
- Độ dài: 2–4 câu, đủ chi tiết để vẽ.
- Chỉ xuất mô tả, không thêm lời bình hay giải thích.`

const PROMPT_BASE = `Tạo thiết kế nhãn dán theo mô tả sau.

YÊU CẦU BẮT BUỘC:
1. Nền PHẢI LÀ NỀN TRẮNG TINH (pure white #FFFFFF). Thiết kế nhãn dán trên nền trắng, không nền trong suốt, không nền màu khác.
2. SÁT MÉP KHUNG: Thiết kế phải chạm sát hoặc gần sát mép ảnh. Không để khoảng trống quanh. Chủ thể hoặc chi tiết phụ phải chạm ít nhất 2–3 cạnh khung. Thiết kế tràn viền (full-bleed).

Phong cách: đường nét đậm rõ, tô màu cel-shading đơn giản, bảng màu tươi sáng. Phù hợp in sticker/nhãn dán. Chỉ xuất ảnh kết quả.`

/** Tạo nhãn gián: Gemini nền trắng → rembg tách nền. 2K: 2 credit, 4K: 4 credit. */
export async function createStickerLabel(formData: FormData) {
  if (!formData || typeof formData.get !== 'function') {
    return { error: 'Dữ liệu không hợp lệ. Vui lòng thử lại.' }
  }
  const prompt = (formData.get('prompt') as string)?.trim() || ''
  const imageQuality = (formData.get('imageQuality') as '2K' | '4K') || '2K'
  const aspectRatioRaw = (formData.get('aspectRatio') as string)?.trim() || '1:1'
  const aspectRatio = VALID_ASPECT_RATIOS.includes(aspectRatioRaw as (typeof VALID_ASPECT_RATIOS)[number])
    ? aspectRatioRaw
    : '1:1'

  if (!prompt) {
    return { error: 'Vui lòng nhập ý tưởng nhãn gián cần tạo.' }
  }

  const COST = STICKER_COSTS[imageQuality]

  const authResult = await getUserForCreditAction()
  if ('error' in authResult) return { error: authResult.error }
  const { user } = authResult

  let openBalance = 0
  try {
    openBalance = await getCreditBalanceByUserId(user.id)
  } catch {
    return { error: 'Không đọc được số dư credits.' }
  }
  if (toTenths(openBalance) < toTenths(COST)) {
    return { error: `Không đủ credits. Cần ${formatCredits(COST)} credits, hiện có ${formatCredits(openBalance)}.` }
  }

  const historyItem = await insertTryOnHistoryProcessingPg({
    userId: user.id,
    originalImageUrl: '',
    garmentImageUrl: '',
    feature: 'sticker',
  })
  if (!historyItem) return { error: 'Không thể khởi tạo phiên xử lý.' }

  const genAI = new GoogleGenerativeAI((await requireGoogleApiKeyForUser(user.id)).apiKey)

  // Bước 1: Gemini Flash 2.5 mở rộng ý tưởng thành mô tả chi tiết
  const flashModel = genAI.getGenerativeModel(GEMINI_25_FLASH_TEXT_NO_THINKING)
  const expansionResult = await flashModel.generateContent(
    `${STICKER_EXPANSION_PROMPT}\n\nÝ TƯỞNG CỦA NGƯỜI DÙNG: "${prompt}"`
  )
  const expandedDesc =
    (expansionResult.response.text?.() || '').trim() ||
    expansionResult.response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
    prompt

  // Bước 2: Gemini tạo ảnh nhãn gián nền trắng
  const fullPrompt = `${PROMPT_BASE}\n\nMÔ TẢ CẦN VẼ:\n"${expandedDesc}"`

  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  ]

  const model = genAI.getGenerativeModel({
    model: GEMINI_3_PRO_IMAGE.model,
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { imageSize: imageQuality, aspectRatio },
    },
  })

  const genResult = await model.generateContent(fullPrompt, { safetySettings })
  const response = genResult.response
  trackFromUsageMetadata(response.usageMetadata, GEMINI_3_PRO_IMAGE.model, 'tao-nhan-gian', user.id, imageQuality)

  const imagePartRes = response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
  if (!imagePartRes || !('inlineData' in imagePartRes)) {
    await deleteTryOnHistoryRowAndStorage(historyItem.id)
    return { error: 'AI không trả về ảnh hợp lệ. Vui lòng thử lại.' }
  }

  let resultBuffer = Buffer.from((imagePartRes as { inlineData: { data: string } }).inlineData.data, 'base64')

  // Tách nền bằng rembg (fallback ảnh gốc nếu lỗi)
  const stripBg = process.env.STICKER_STRIP_BACKGROUND !== 'false'
  if (stripBg) {
    resultBuffer = Buffer.from(await stripBackground(resultBuffer))
  }

  try {
    const resultPath = `results/${user.id}/sticker_${Date.now()}.png`
    const { publicUrl: resultPublicUrl } = await uploadTryOnImagePublic(resultPath, resultBuffer, {
      contentType: 'image/png',
      upsert: true,
    })

    const d = await deductUserCredits(user.id, COST, 'tao-nhan-gian')
    if (!d.ok) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: d.code === 'INSUFFICIENT_CREDITS' ? 'Không đủ credits để hoàn tất.' : d.error }
    }
    await updateTryOnHistoryCompletedPg(historyItem.id, resultPublicUrl, {
      feature: 'tao-nhan-gian',
      aspect_ratio: aspectRatio,
    })

    revalidatePath('/tao-nhan-gian')
    revalidatePath('/dashboard/history')
    return { success: true, resultUrl: resultPublicUrl }
  } catch (e) {
    await deleteTryOnHistoryRowAndStorage(historyItem.id)
    const msg = e instanceof Error ? e.message : String(e)
    return { error: msg }
  }
}

const photoStickerSafetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
] as const

/** Sticker từ ảnh chân dung + biểu cảm + chữ bubble. Cùng mức credit và pipeline tách nền như createStickerLabel. */
export async function createStickerFromPhoto(formData: FormData) {
  if (!formData || typeof formData.get !== 'function') {
    return { error: 'Dữ liệu không hợp lệ. Vui lòng thử lại.' }
  }

  const photo = formData.get('portraitImage') as File | null
  if (!photo || !(photo instanceof File) || photo.size < 1) {
    return { error: 'Vui lòng tải lên một ảnh chân dung rõ khuôn mặt.' }
  }
  if (!photo.type.startsWith('image/') || !ALLOWED_PHOTO_MIME.has(photo.type)) {
    return { error: 'Ảnh phải là JPEG, PNG, WebP hoặc GIF.' }
  }
  if (photo.size > MAX_PHOTO_BYTES) {
    return { error: `Ảnh quá lớn (tối đa ${Math.round(MAX_PHOTO_BYTES / (1024 * 1024))}MB).` }
  }

  const expressionRaw = ((formData.get('expressionId') as string) || '').trim().toLowerCase()
  const expressionId = (STICKER_PHOTO_EXPRESSION_IDS as readonly string[]).includes(expressionRaw)
    ? (expressionRaw as StickerPhotoExpressionId)
    : ('happy' as StickerPhotoExpressionId)

  const caption = sanitizeStickerCaption((formData.get('stickerCaption') as string) || '')
  if (!caption.length) {
    return { error: 'Vui lòng nhập chữ hiển thị trên sticker (hoặc chọn biểu cảm có sẵn chữ mẫu).' }
  }

  const imageQuality = (formData.get('imageQuality') as '2K' | '4K') || '2K'
  const aspectRatioRaw = (formData.get('aspectRatio') as string)?.trim() || '1:1'
  const aspectRatio = VALID_ASPECT_RATIOS.includes(aspectRatioRaw as (typeof VALID_ASPECT_RATIOS)[number])
    ? aspectRatioRaw
    : '1:1'

  const COST = STICKER_COSTS[imageQuality]

  const authResult = await getUserForCreditAction()
  if ('error' in authResult) return { error: authResult.error }
  const { user } = authResult

  let openBalance = 0
  try {
    openBalance = await getCreditBalanceByUserId(user.id)
  } catch {
    return { error: 'Không đọc được số dư credits.' }
  }
  if (toTenths(openBalance) < toTenths(COST)) {
    return { error: `Không đủ credits. Cần ${formatCredits(COST)} credits, hiện có ${formatCredits(openBalance)}.` }
  }

  let photoBuffer: Buffer
  try {
    photoBuffer = Buffer.from(await photo.arrayBuffer())
  } catch {
    return { error: 'Không đọc được file ảnh.' }
  }

  const timestamp = Date.now()
  const uploadPath = `uploads/${user.id}/sticker_portrait_${timestamp}.jpg`
  let originalPublicUrl: string
  try {
    const jpegBuf = await sharp(photoBuffer).rotate().jpeg({ quality: 88, mozjpeg: true }).toBuffer()
    ;({ publicUrl: originalPublicUrl } = await uploadTryOnImagePublic(uploadPath, jpegBuf, {
      contentType: 'image/jpeg',
      upsert: true,
    }))
  } catch {
    try {
      ;({ publicUrl: originalPublicUrl } = await uploadTryOnImagePublic(uploadPath, photoBuffer, {
        contentType: photo.type || 'image/jpeg',
        upsert: true,
      }))
    } catch {
      return { error: 'Không tải được ảnh lên máy chủ.' }
    }
  }

  const historyItem = await insertTryOnHistoryProcessingPg({
    userId: user.id,
    originalImageUrl: originalPublicUrl,
    garmentImageUrl: originalPublicUrl,
    feature: 'sticker',
  })
  if (!historyItem) return { error: 'Không thể khởi tạo phiên xử lý.' }

  let inline: { mimeType: string; data: string }
  try {
    inline = await shrinkPhotoForStickerModel(photoBuffer, photo.type || 'image/jpeg')
  } catch {
    await deleteTryOnHistoryRowAndStorage(historyItem.id)
    return { error: 'Không xử lý được ảnh đầu vào.' }
  }

  const expressionLayer = PHOTO_EXPRESSION_DIRECTIVES[expressionId]
  const fullPrompt = PHOTO_STICKER_PROMPT.replace('<<<EXPRESSION_LAYER>>>', expressionLayer).replace(
    '<<<CAPTION>>>',
    caption.replace(/<<<|>>>/g, '')
  )

  const genAI = new GoogleGenerativeAI((await requireGoogleApiKeyForUser(user.id)).apiKey)
  const model = genAI.getGenerativeModel({
    model: GEMINI_3_PRO_IMAGE.model,
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { imageSize: imageQuality, aspectRatio },
    },
  })

  try {
    const genResult = await model.generateContent(
      [{ text: fullPrompt }, { inlineData: { mimeType: inline.mimeType, data: inline.data } }] as never,
      { safetySettings: [...photoStickerSafetySettings] } as never
    )
    const response = genResult.response
    trackFromUsageMetadata(
      response.usageMetadata,
      GEMINI_3_PRO_IMAGE.model,
      'tao-nhan-gian-photo',
      user.id,
      imageQuality
    )

    const cand = response.candidates?.[0]
    if (!cand) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: 'AI không trả về kết quả. Thử lại sau.' }
    }
    if (cand.finishReason === 'SAFETY') {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: 'Phản hồi bị chặn bộ lọc an toàn. Thử ảnh hoặc chữ khác.' }
    }

    const imagePartRes = cand.content?.parts?.find((p) => 'inlineData' in p)
    if (!imagePartRes || !('inlineData' in imagePartRes)) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: 'AI không trả về ảnh hợp lệ. Vui lòng thử lại.' }
    }

    let resultBuffer = Buffer.from((imagePartRes as { inlineData: { data: string } }).inlineData.data, 'base64')

    const stripBg = process.env.STICKER_STRIP_BACKGROUND !== 'false'
    if (stripBg) {
      resultBuffer = Buffer.from(await stripBackground(resultBuffer))
    }

    const resultPath = `results/${user.id}/sticker_photo_${Date.now()}.png`
    const { publicUrl: resultPublicUrl } = await uploadTryOnImagePublic(resultPath, resultBuffer, {
      contentType: 'image/png',
      upsert: true,
    })

    const d = await deductUserCredits(user.id, COST, 'tao-nhan-gian')
    if (!d.ok) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: d.code === 'INSUFFICIENT_CREDITS' ? 'Không đủ credits để hoàn tất.' : d.error }
    }
    await updateTryOnHistoryCompletedPg(historyItem.id, resultPublicUrl, {
      feature: 'tao-nhan-gian',
      aspect_ratio: aspectRatio,
    })

    revalidatePath('/tao-nhan-gian')
    revalidatePath('/dashboard/history')
    return { success: true, resultUrl: resultPublicUrl }
  } catch (e) {
    await deleteTryOnHistoryRowAndStorage(historyItem.id)
    const msg = e instanceof Error ? e.message : String(e)
    if (/500|Internal Server Error|Internal error/i.test(msg)) {
      return { error: 'Hệ thống quá tải. Bạn có thể thử lại sau ít phút.' }
    }
    if (/429|resource_exhausted|quota/i.test(msg)) {
      return { error: 'API tạm quá tải hoặc hết hạn mức. Thử lại sau vài phút.' }
    }
    return { error: `Tạo sticker thất bại: ${msg}` }
  }
}
