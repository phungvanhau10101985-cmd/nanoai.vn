'use server'
import { deleteTryOnHistoryRowAndStorage } from '@/lib/storage/try-on-history-cleanup'

import { getUserForCreditAction } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { normalizeToEnglish } from '@/lib/ai-normalize'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import { isPgConfigured } from '@/lib/db/pool'
import { insertTryOnHistoryProcessingPg, updateTryOnHistoryCompletedPg } from '@/lib/db/try-on-history-pg'
import { bunnyStorageConfigured, uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'
import { getCreditBalanceByUserId } from '@/lib/db/credits-balance'
import { deductUserCredits } from '@/lib/music/deduct-user-credits'

const HEADSHOT_COSTS = { '2K': 2, '4K': 4 } as const
const toTenths = (value: number) => Math.round(value * 10)
const formatCredits = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

const PROMPT_BASE = `Ảnh chân dung chuyên nghiệp: biến selfie đời thường thành ảnh profile chuyên nghiệp (LinkedIn, CV). Thêm trang phục phù hợp (vest/blazer), tóc gọn, ánh sáng studio. Giữ đúng khuôn mặt và các đặc điểm nhận diện. Phong cách trang trọng, phù hợp hồ sơ xin việc. Chỉ trả về ảnh kết quả, không chèn chữ.`

/** Tạo ảnh chân dung chuyên nghiệp. 2K: 2 credit, 4K: 4 credit. */
export async function createHeadshot(formData: FormData) {
  if (!formData || typeof formData.get !== 'function') {
    return { error: 'Dữ liệu không hợp lệ. Vui lòng thử lại.' }
  }
  const image = formData.get('image') as File
  const imageQuality = (formData.get('imageQuality') as '2K' | '4K') || '2K'
  const note = (formData.get('note') as string)?.trim() || ''
  if (!image || image.size === 0) return { error: 'Cần tải lên ảnh selfie.' }

  if (!bunnyStorageConfigured()) {
    return { error: 'Thiếu cấu hình lưu ảnh (Bunny Storage).' }
  }
  if (!isPgConfigured()) {
    return { error: 'Thiếu cấu hình cơ sở dữ liệu (DATABASE_URL).' }
  }

  const noteEn = note ? await normalizeToEnglish(note) : ''
  let prompt = PROMPT_BASE
  if (noteEn) {
    prompt = prompt.replace('Chỉ trả về ảnh kết quả, không chèn chữ.', `YÊU CẦU BỔ SUNG: "${noteEn}". Chỉ trả về ảnh kết quả, không chèn chữ.`)
  }

  const COST = HEADSHOT_COSTS[imageQuality]
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
  const path = `uploads/${user.id}/headshot_${timestamp}.png`
  const { publicUrl: originalPublicUrl } = await uploadTryOnImagePublic(path, image, {
    contentType: image.type || 'image/png',
  })

  const inserted = await insertTryOnHistoryProcessingPg({
    userId: user.id,
    originalImageUrl: originalPublicUrl,
    garmentImageUrl: originalPublicUrl,
    feature: 'headshot',
  })
  if (!inserted) return { error: 'Không thể khởi tạo phiên xử lý.' }
  const historyItem = { id: inserted.id }

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
    trackFromUsageMetadata(response.usageMetadata, 'gemini-3-pro-image-preview', 'tao-anh-chain-dung', user.id, imageQuality)
    const imagePartRes = response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
    if (!imagePartRes || !('inlineData' in imagePartRes)) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: 'AI không trả về ảnh hợp lệ.' }
    }
    const resultBuffer = Buffer.from((imagePartRes as { inlineData: { data: string } }).inlineData.data, 'base64')
    const resultPath = `results/${user.id}/headshot_${Date.now()}.png`
    const { publicUrl: resultPublicUrl } = await uploadTryOnImagePublic(resultPath, resultBuffer, {
      contentType: 'image/png',
      upsert: true,
    })

    const d = await deductUserCredits(user.id, COST)
    if (!d.ok) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: d.code === 'INSUFFICIENT_CREDITS' ? 'Không đủ credits để hoàn tất.' : d.error }
    }
    const saved = await updateTryOnHistoryCompletedPg(historyItem.id, resultPublicUrl)
    if (!saved) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: 'Không lưu được kết quả phiên.' }
    }

    revalidatePath('/tao-anh-chain-dung')
    revalidatePath('/dashboard/history')
    return { success: true, resultUrl: resultPublicUrl }
  } catch (e) {
    await deleteTryOnHistoryRowAndStorage(historyItem.id)
    const msg = e instanceof Error ? e.message : String(e)
    if (/500|Internal Server Error|Internal error/i.test(msg)) {
      return { error: 'Hệ thống quá tải. Bạn có thể chọn 2K hoặc thử lại sau ít phút.' }
    }
    return { error: `Tạo ảnh chân dung thất bại: ${msg}` }
  }
}
