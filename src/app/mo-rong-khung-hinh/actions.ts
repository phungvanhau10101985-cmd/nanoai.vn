'use server'
import { deleteTryOnHistoryRowAndStorage } from '@/lib/storage/try-on-history-cleanup'

import { getUserForCreditAction } from '@/lib/auth'
import { bunnyStorageConfigured, uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'
import { revalidatePath } from 'next/cache'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { normalizeToEnglish } from '@/lib/ai-normalize'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import { getCreditBalanceByUserId } from '@/lib/db/credits-balance'
import { deductUserCredits } from '@/lib/music/deduct-user-credits'
import { isPgConfigured } from '@/lib/db/pool'
import { insertTryOnHistoryProcessingPg, updateTryOnHistoryCompletedPg } from '@/lib/db/try-on-history-pg'
import { requireGoogleApiKeyForUser } from '@/lib/ai/google-api-key-resolver'
import { GEMINI_3_PRO_IMAGE } from '@/lib/gemini-config'

const OUTPAINT_COSTS = { '2K': 1.5, '4K': 3 } as const
const toTenths = (value: number) => Math.round(value * 10)
const formatCredits = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

const PROMPT_BASE = `Mở rộng khung hình bằng AI: mở rộng vùng ảnh ra hai bên (hoặc trên/dưới) để đạt tỷ lệ mới. Không làm méo người hoặc chủ thể chính. Phần nền mở rộng phải hòa trộn tự nhiên với ảnh gốc. Chỉ trả về ảnh kết quả, không chèn chữ.`

/** Mở rộng khung hình. 2K: 1,5 credit, 4K: 3 credit. */
export async function outpaintImage(formData: FormData) {
  if (!formData || typeof formData.get !== 'function') {
    return { error: 'Dữ liệu không hợp lệ. Vui lòng thử lại.' }
  }
  const image = formData.get('image') as File
  const imageQuality = (formData.get('imageQuality') as '2K' | '4K') || '2K'
  const aspectRatio = (formData.get('aspectRatio') as string) || '16:9'
  const note = (formData.get('note') as string)?.trim() || ''
  if (!image || image.size === 0) return { error: 'Cần tải lên ít nhất một ảnh.' }

  if (!bunnyStorageConfigured()) {
    return { error: 'Thiếu cấu hình lưu ảnh (Bunny Storage).' }
  }
  if (!isPgConfigured()) {
    return { error: 'Thiếu cấu hình cơ sở dữ liệu (DATABASE_URL).' }
  }

  const noteEn = note ? await normalizeToEnglish(note) : ''
  let prompt = PROMPT_BASE
  prompt = prompt.replace(
    'Chỉ trả về ảnh kết quả, không chèn chữ.',
    `TỶ LỆ KHUNG HÌNH MỤC TIÊU: ${aspectRatio}. ${noteEn ? `YÊU CẦU: "${noteEn}". ` : ''}Chỉ trả về ảnh kết quả, không chèn chữ.`
  )

  const COST = OUTPAINT_COSTS[imageQuality]
  const result = await getUserForCreditAction()
  if ('error' in result) return { error: result.error }
  const { user } = result

  let balanceBefore: number
  try {
    balanceBefore = await getCreditBalanceByUserId(user.id)
  } catch {
    return { error: 'Không đọc được số dư credits.' }
  }
  if (toTenths(balanceBefore) < toTenths(COST)) {
    return { error: `Không đủ credits. Cần ${formatCredits(COST)} credits, hiện có ${formatCredits(balanceBefore)}.` }
  }

  const timestamp = Date.now()
  const path = `uploads/${user.id}/outpaint_${timestamp}.png`
  const { publicUrl: originalPublicUrl } = await uploadTryOnImagePublic(path, image, {
    contentType: image.type || 'image/png',
  })

  const inserted = await insertTryOnHistoryProcessingPg({
    userId: user.id,
    originalImageUrl: originalPublicUrl,
    garmentImageUrl: originalPublicUrl,
    feature: 'outpaint',
  })
  if (!inserted) return { error: 'Không thể khởi tạo phiên xử lý.' }
  const historyItem = { id: inserted.id }

  const { apiKey } = await requireGoogleApiKeyForUser(user.id)
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: GEMINI_3_PRO_IMAGE.model,
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { imageSize: imageQuality },
    },
  })
  const buffer = Buffer.from(await image.arrayBuffer())
  const imagePart = { inlineData: { data: buffer.toString('base64'), mimeType: image.type } }
  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  ]

  try {
    const result = await model.generateContent([prompt, imagePart], { safetySettings })
    const response = result.response
    trackFromUsageMetadata(response.usageMetadata, GEMINI_3_PRO_IMAGE.model, 'mo-rong-khung-hinh', user.id, imageQuality)
    const imagePartRes = response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
    if (!imagePartRes || !('inlineData' in imagePartRes)) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: 'AI không trả về ảnh hợp lệ.' }
    }
    const resultBuffer = Buffer.from((imagePartRes as { inlineData: { data: string } }).inlineData.data, 'base64')
    const resultPath = `results/${user.id}/outpaint_${Date.now()}.png`
    const { publicUrl: resultPublicUrl } = await uploadTryOnImagePublic(resultPath, resultBuffer, {
      contentType: 'image/png',
      upsert: true,
    })

    const deduct = await deductUserCredits(user.id, COST, 'mo-rong-khung-hinh')
    if (!deduct.ok) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return {
        error:
          deduct.code === 'INSUFFICIENT_CREDITS'
            ? 'Không đủ credits để hoàn tất.'
            : deduct.error || 'Không thể trừ credits.',
      }
    }
    const saved = await updateTryOnHistoryCompletedPg(historyItem.id, resultPublicUrl)
    if (!saved) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: 'Không lưu được kết quả phiên.' }
    }

    revalidatePath('/mo-rong-khung-hinh')
    revalidatePath('/dashboard/history')
    return { success: true, resultUrl: resultPublicUrl }
  } catch (e) {
    await deleteTryOnHistoryRowAndStorage(historyItem.id)
    const msg = e instanceof Error ? e.message : String(e)
    if (/500|Internal Server Error|Internal error/i.test(msg)) {
      return { error: 'Hệ thống quá tải. Bạn có thể chọn 2K hoặc thử lại sau ít phút.' }
    }
    return { error: `Mở rộng khung hình thất bại: ${msg}` }
  }
}
