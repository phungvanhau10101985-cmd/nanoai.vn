'use server'
import { deleteTryOnHistoryRowAndStorage } from '@/lib/storage/try-on-history-cleanup'

import { getUserForCreditAction } from '@/lib/auth'
import { bunnyStorageConfigured, uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'
import { getCreditBalanceByUserId } from '@/lib/db/credits-balance'
import { deductUserCredits } from '@/lib/music/deduct-user-credits'
import { isPgConfigured } from '@/lib/db/pool'
import { insertTryOnHistoryProcessingPg, updateTryOnHistoryCompletedPg } from '@/lib/db/try-on-history-pg'

import { revalidatePath } from 'next/cache'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { normalizeToEnglish } from '@/lib/ai-normalize'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import { requireGoogleApiKeyForUser } from '@/lib/ai/google-api-key-resolver'
import { GEMINI_3_PRO_IMAGE } from '@/lib/gemini-config'

const MERGE_COSTS = { '2K': 1.5, '4K': 3 } as const
const toTenths = (value: number) => Math.round(value * 10)
const formatCredits = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

const PROMPT_BASE = `Ghép các ảnh này thành một ảnh tổng hợp tự nhiên và thống nhất. Kết hợp nội dung từ tất cả ảnh một cách hài hòa, hợp lý. Giữ các chi tiết quan trọng. Chỉ trả về ảnh kết quả, không chèn chữ.`

/** Ghép ảnh: kết hợp nhiều ảnh thành một. 2K: 1,5 credit, 4K: 3 credit. */
export async function mergeImages(formData: FormData) {
  if (!formData || typeof formData.get !== 'function') {
    return { error: 'Dữ liệu không hợp lệ. Vui lòng thử lại.' }
  }
  const imageQuality = (formData.get('imageQuality') as '2K' | '4K') || '2K'
  const note = (formData.get('note') as string)?.trim() || ''
  const noteEn = note ? await normalizeToEnglish(note) : ''
  let prompt = PROMPT_BASE
  if (noteEn) {
    prompt = prompt.replace('Chỉ trả về ảnh kết quả, không chèn chữ.', `YÊU CẦU BỔ SUNG CỦA NGƯỜI DÙNG: "${noteEn}". Chỉ trả về ảnh kết quả, không chèn chữ.`)
  }
  const images: File[] = []
  let i = 0
  while (true) {
    const img = formData.get(`image_${i}`) as File | null
    if (!img || img.size === 0) break
    images.push(img)
    i++
  }
  if (images.length < 2) return { error: 'Cần tải lên ít nhất 2 ảnh để ghép.' }

  if (!bunnyStorageConfigured()) {
    return { error: 'Thiếu cấu hình lưu ảnh (Bunny Storage).' }
  }
  if (!isPgConfigured()) {
    return { error: 'Thiếu cấu hình cơ sở dữ liệu (DATABASE_URL).' }
  }

  const COST = MERGE_COSTS[imageQuality]

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
  const path = `uploads/${user.id}/merge_${timestamp}_0.png`
  const { publicUrl: originalPublicUrl } = await uploadTryOnImagePublic(path, images[0], {
    contentType: images[0].type || 'image/png',
  })

  const inserted = await insertTryOnHistoryProcessingPg({
    userId: user.id,
    originalImageUrl: originalPublicUrl,
    garmentImageUrl: originalPublicUrl,
    feature: 'merge',
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
  } as Parameters<GoogleGenerativeAI['getGenerativeModel']>[0])
  const imageParts = await Promise.all([
    { text: prompt },
    ...images.map(async (img) => ({
      inlineData: { data: Buffer.from(await img.arrayBuffer()).toString('base64'), mimeType: img.type },
    })),
  ])
  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  ]

  try {
    const result = await model.generateContent(imageParts, { safetySettings } as never)
    const response = result.response
    trackFromUsageMetadata(response.usageMetadata, GEMINI_3_PRO_IMAGE.model, 'ghep-anh', user.id, imageQuality)
    const imagePartRes = response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
    if (!imagePartRes || !('inlineData' in imagePartRes)) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: 'AI không trả về ảnh hợp lệ.' }
    }
    const inlineData = imagePartRes.inlineData
    if (!inlineData?.data) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: 'AI không trả về ảnh hợp lệ.' }
    }
    const resultBuffer = Buffer.from(inlineData.data, 'base64')
    const resultPath = `results/${user.id}/merge_${Date.now()}.png`
    const { publicUrl: resultPublicUrl } = await uploadTryOnImagePublic(resultPath, resultBuffer, {
      contentType: 'image/png',
      upsert: true,
    })

    const d = await deductUserCredits(user.id, COST, 'ghep-anh')
    if (!d.ok) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: d.code === 'INSUFFICIENT_CREDITS' ? 'Không đủ credits để hoàn tất.' : d.error }
    }
    const saved = await updateTryOnHistoryCompletedPg(historyItem.id, resultPublicUrl)
    if (!saved) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: 'Không lưu được kết quả phiên.' }
    }

    revalidatePath('/ghep-anh')
    revalidatePath('/dashboard/history')
    return { success: true, resultUrl: resultPublicUrl }
  } catch (e) {
    await deleteTryOnHistoryRowAndStorage(historyItem.id)
    const msg = e instanceof Error ? e.message : String(e)
    if (/500|Internal Server Error|Internal error/i.test(msg)) {
      return { error: 'Hệ thống quá tải. Bạn có thể chọn 2K hoặc thử lại sau ít phút.' }
    }
    return { error: `Ghép ảnh thất bại: ${msg}` }
  }
}
