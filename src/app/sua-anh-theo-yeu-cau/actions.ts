'use server'

import { deleteTryOnHistoryRowAndStorage } from '@/lib/storage/try-on-history-cleanup'
import { getUserForCreditAction } from '@/lib/auth'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'
import { insertTryOnHistoryProcessingPg, updateTryOnHistoryCompletedPg } from '@/lib/db/try-on-history-pg'
import { getCreditBalanceByUserId } from '@/lib/db/credits-balance'
import { deductUserCredits } from '@/lib/music/deduct-user-credits'
import { revalidatePath } from 'next/cache'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { normalizeToEnglish } from '@/lib/ai-normalize'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import { requireGoogleApiKeyForUser } from '@/lib/ai/google-api-key-resolver'
import { GEMINI_3_PRO_IMAGE } from '@/lib/gemini-config'

const COSTS = { '2K': 1.5, '4K': 3 } as const
const toTenths = (value: number) => Math.round(value * 10)
const formatCredits = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

const PROMPT_BASE = `Bạn là chuyên gia chỉnh sửa ảnh thương mại. Nhiệm vụ: chỉnh sửa ảnh đầu vào theo đúng yêu cầu người dùng, giữ bố cục tự nhiên, ánh sáng hợp lý, không chèn chữ/watermark. Chỉ trả về ảnh kết quả cuối cùng.`

/** Sửa ảnh theo yêu cầu bằng prompt tự do. */
export async function editImageByPrompt(formData: FormData) {
  if (!formData || typeof formData.get !== 'function') {
    return { error: 'Dữ liệu không hợp lệ. Vui lòng thử lại.' }
  }
  const image = formData.get('image') as File
  const imageQuality = (formData.get('imageQuality') as '2K' | '4K') || '2K'
  const requestText = (formData.get('requestText') as string)?.trim() || ''
  if (!image || image.size === 0) return { error: 'Cần tải lên một ảnh để chỉnh sửa.' }
  if (!requestText) return { error: 'Vui lòng nhập yêu cầu chỉnh sửa.' }

  const requestEn = await normalizeToEnglish(requestText)
  const prompt = `${PROMPT_BASE}\n\nYÊU CẦU CHỈNH SỬA CỤ THỂ: "${requestEn || requestText}"\n\nKhông được thay đổi nội dung ngoài phạm vi yêu cầu. Chỉ trả về ảnh kết quả, không chèn chữ.`

  const COST = COSTS[imageQuality]
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

  const timestamp = Date.now()
  const path = `uploads/${user.id}/edit_${timestamp}.png`
  const { publicUrl: originalPublicUrl } = await uploadTryOnImagePublic(path, image, {
    contentType: image.type || 'image/png',
  })
  const historyItem = await insertTryOnHistoryProcessingPg({
    userId: user.id,
    originalImageUrl: originalPublicUrl,
    garmentImageUrl: originalPublicUrl,
    feature: 'sua-anh-theo-yeu-cau',
  })
  if (!historyItem) return { error: 'Không thể khởi tạo phiên xử lý.' }

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
    trackFromUsageMetadata(response.usageMetadata, GEMINI_3_PRO_IMAGE.model, 'sua-anh-theo-yeu-cau', user.id, imageQuality)
    const imagePartRes = response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
    if (!imagePartRes || !('inlineData' in imagePartRes)) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: 'AI không trả về ảnh hợp lệ.' }
    }
    const resultBuffer = Buffer.from((imagePartRes as { inlineData: { data: string } }).inlineData.data, 'base64')
    const resultPath = `results/${user.id}/edit_${Date.now()}.png`
    const { publicUrl: resultPublicUrl } = await uploadTryOnImagePublic(resultPath, resultBuffer, {
      contentType: 'image/png',
      upsert: true,
    })

    const d = await deductUserCredits(user.id, COST)
    if (!d.ok) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: d.code === 'INSUFFICIENT_CREDITS' ? 'Không đủ credits để hoàn tất.' : d.error }
    }
    await updateTryOnHistoryCompletedPg(historyItem.id, resultPublicUrl)

    revalidatePath('/sua-anh-theo-yeu-cau')
    revalidatePath('/dashboard/history')
    return { success: true, resultUrl: resultPublicUrl }
  } catch (e) {
    await deleteTryOnHistoryRowAndStorage(historyItem.id)
    const msg = e instanceof Error ? e.message : String(e)
    if (/500|Internal Server Error|Internal error/i.test(msg)) {
      return { error: 'Hệ thống quá tải. Bạn có thể chọn 2K hoặc thử lại sau ít phút.' }
    }
    return { error: `Sửa ảnh thất bại: ${msg}` }
  }
}

