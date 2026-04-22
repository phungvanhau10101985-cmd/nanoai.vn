'use server'
import { deleteTryOnHistoryRowAndStorage } from '@/lib/storage/try-on-history-cleanup'

import { getUserForCreditAction } from '@/lib/auth'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'
import { insertTryOnHistoryProcessingPg, updateTryOnHistoryCompletedPg } from '@/lib/db/try-on-history-pg'
import { revalidatePath } from 'next/cache'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { normalizeToEnglish } from '@/lib/ai-normalize'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import { getCreditBalanceByUserId } from '@/lib/db/credits-balance'
import { deductUserCredits } from '@/lib/music/deduct-user-credits'

const SHARPEN_COSTS = { '2K': 1.5, '4K': 3 } as const
const toTenths = (value: number) => Math.round(value * 10)
const formatCredits = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

const PROMPT_BASE = `Làm nét ảnh này. Tăng độ sắc nét, giảm mờ, tăng chi tiết. Giữ nguyên nội dung, bố cục và màu sắc gốc. Chỉ trả về ảnh kết quả, không chèn chữ.`

/** Làm nét ảnh. 2K: 1,5 credit, 4K: 3 credit. */
export async function sharpenImage(formData: FormData) {
  if (!formData || typeof formData.get !== 'function') {
    return { error: 'Dữ liệu không hợp lệ. Vui lòng thử lại.' }
  }
  const image = formData.get('image') as File
  const imageQuality = (formData.get('imageQuality') as '2K' | '4K') || '2K'
  const note = (formData.get('note') as string)?.trim() || ''
  if (!image || image.size === 0) return { error: 'Cần tải lên ít nhất một ảnh.' }

  const noteEn = note ? await normalizeToEnglish(note) : ''
  let prompt = PROMPT_BASE
  if (noteEn) {
    prompt = prompt.replace('Chỉ trả về ảnh kết quả, không chèn chữ.', `YÊU CẦU BỔ SUNG CỦA NGƯỜI DÙNG: "${noteEn}". Chỉ trả về ảnh kết quả, không chèn chữ.`)
  }

  const COST = SHARPEN_COSTS[imageQuality]

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
  const path = `uploads/${user.id}/sharpen_${timestamp}.png`
  const { publicUrl: originalPublicUrl } = await uploadTryOnImagePublic(path, image, {
    contentType: image.type || 'image/png',
  })
  const historyItem = await insertTryOnHistoryProcessingPg({
    userId: user.id,
    originalImageUrl: originalPublicUrl,
    garmentImageUrl: originalPublicUrl,
    feature: 'sharpen',
  })
  if (!historyItem) return { error: 'Không thể khởi tạo phiên xử lý.' }

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)
  const model = genAI.getGenerativeModel({
    model: 'gemini-3-pro-image-preview',
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
    trackFromUsageMetadata(response.usageMetadata, 'gemini-3-pro-image-preview', 'lam-net-anh', user.id, imageQuality)
    const imagePartRes = response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
    if (!imagePartRes || !('inlineData' in imagePartRes)) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: 'AI không trả về ảnh hợp lệ.' }
    }
    const resultBuffer = Buffer.from((imagePartRes as { inlineData: { data: string } }).inlineData.data, 'base64')
    const resultPath = `results/${user.id}/sharpen_${Date.now()}.png`
    const { publicUrl: resultPublicUrl } = await uploadTryOnImagePublic(resultPath, resultBuffer, {
      contentType: 'image/png',
      upsert: true,
    })

    const deduct = await deductUserCredits(user.id, COST)
    if (!deduct.ok) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return {
        error:
          deduct.code === 'INSUFFICIENT_CREDITS'
            ? 'Không đủ credits để hoàn tất.'
            : deduct.error || 'Không thể trừ credits.',
      }
    }
    await updateTryOnHistoryCompletedPg(historyItem.id, resultPublicUrl)

    revalidatePath('/lam-net-anh')
    revalidatePath('/dashboard/history')
    return { success: true, resultUrl: resultPublicUrl }
  } catch (e) {
    await deleteTryOnHistoryRowAndStorage(historyItem.id)
    const msg = e instanceof Error ? e.message : String(e)
    if (/500|Internal Server Error|Internal error/i.test(msg)) {
      return { error: 'Hệ thống quá tải. Bạn có thể chọn 2K hoặc thử lại sau ít phút.' }
    }
    return { error: `Làm nét ảnh thất bại: ${msg}` }
  }
}
