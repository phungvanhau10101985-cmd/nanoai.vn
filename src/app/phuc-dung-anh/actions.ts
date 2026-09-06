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

const RESTORE_COSTS = { '2K': 4, '4K': 8 } as const
const toTenths = (value: number) => Math.round(value * 10)
const formatCredits = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

const PROMPTS = {
  original: `Phục dựng ảnh này. Yêu cầu độ chính xác cao về gương mặt và thần thái; giữ tối đa những gì đúng với ảnh gốc. Sửa mờ, xước, hư hại và nâng chất lượng. Giữ nguyên đường nét, nội dung và bố cục gốc. Giữ nguyên tông màu gốc, không đổi màu. Mặc định: người trong ảnh là người Việt Nam nếu không có chỉ định khác. Chỉ trả về ảnh kết quả, không chèn chữ.`,
  colorize: `Phục dựng ảnh này. Yêu cầu độ chính xác cao về gương mặt và thần thái; giữ tối đa những gì đúng với ảnh gốc. Sửa mờ, xước, hư hại và nâng chất lượng. Giữ nguyên đường nét, nội dung và bố cục gốc. Tô màu tự nhiên, chân thực. Mặc định: người trong ảnh là người Việt Nam nếu không có chỉ định khác. Chỉ trả về ảnh kết quả, không chèn chữ.`,
}

const PERSON_LABELS: Record<number, string[]> = {
  1: ['người trong ảnh'],
  2: ['người bên trái', 'người bên phải'],
  3: ['người bên trái', 'người ở giữa', 'người bên phải'],
  4: ['người thứ 1 (từ trái)', 'người thứ 2', 'người thứ 3', 'người thứ 4'],
  5: ['người thứ 1 (từ trái)', 'người thứ 2', 'người thứ 3', 'người thứ 4', 'người thứ 5'],
}

/** Phục dựng ảnh: sửa ảnh cũ/mờ, tăng chất lượng. 2K: 4 credit, 4K: 8 credit. */
export async function restoreImage(formData: FormData) {
  if (!formData || typeof formData.get !== 'function') {
    return { error: 'Dữ liệu không hợp lệ. Vui lòng thử lại.' }
  }
  const image = formData.get('image') as File
  const colorMode = (formData.get('colorMode') as 'original' | 'colorize') || 'original'
  const imageQuality = (formData.get('imageQuality') as '2K' | '4K') || '2K'
  const note = (formData.get('note') as string)?.trim() || ''
  if (!image || image.size === 0) return { error: 'Cần tải lên ít nhất một ảnh.' }

  const RESTORE_COST = RESTORE_COSTS[imageQuality]

  const result = await getUserForCreditAction()
  if ('error' in result) return { error: result.error }
  const { user } = result

  let openBalance = 0
  try {
    openBalance = await getCreditBalanceByUserId(user.id)
  } catch {
    return { error: 'Không đọc được số dư credits.' }
  }
  if (toTenths(openBalance) < toTenths(RESTORE_COST)) {
    return { error: `Không đủ credits. Cần ${formatCredits(RESTORE_COST)} credits, hiện có ${formatCredits(openBalance)}.` }
  }

  const timestamp = Date.now()
  const path = `uploads/${user.id}/restore_${timestamp}.png`
  const { publicUrl: originalPublicUrl } = await uploadTryOnImagePublic(path, image, {
    contentType: image.type || 'image/png',
  })
  const historyItem = await insertTryOnHistoryProcessingPg({
    userId: user.id,
    originalImageUrl: originalPublicUrl,
    garmentImageUrl: originalPublicUrl,
    feature: 'phuc-dung-anh',
  })
  if (!historyItem) return { error: 'Không thể khởi tạo phiên xử lý.' }

  let prompt = PROMPTS[colorMode] ?? PROMPTS.original
  const personCountRaw = Math.max(1, parseInt(String(formData.get('personCount') || '1'), 10) || 1)
  const useAutoPeopleOptimization = personCountRaw >= 6
  const personCount = Math.min(5, personCountRaw)
  const labels = PERSON_LABELS[personCount] || PERSON_LABELS[1]
  const personDescriptions: string[] = []
  if (!useAutoPeopleOptimization) {
    for (let i = 0; i < personCount; i++) {
      const gender = (formData.get(`person_${i}_gender`) as string)?.trim() || ''
      const age = (formData.get(`person_${i}_age`) as string)?.trim() || ''
      const extra = (formData.get(`person_${i}_extra`) as string)?.trim() || ''
      if (gender || age || extra) {
        const parts: string[] = [labels[i]]
        if (age) parts.push(`${age} tuổi`)
        if (gender) parts.push(`giới tính ${gender}`)
        if (extra) parts.push(extra)
        personDescriptions.push(parts.join(' '))
      }
    }
  }
  const personDescEn = personDescriptions.length ? await normalizeToEnglish(personDescriptions.join('. ')) : ''
  const noteEn = note ? await normalizeToEnglish(note) : ''
  if (useAutoPeopleOptimization) {
    prompt = prompt.replace(
      'Chỉ trả về ảnh kết quả, không chèn chữ.',
      'Ảnh có từ 6 người trở lên: hãy tự tối ưu phục dựng 100% cho toàn bộ khuôn mặt và tổng thể ảnh, giữ nhận diện tự nhiên của từng người, không cần phân loại giới tính từng người. Chỉ trả về ảnh kết quả, không chèn chữ.'
    )
  } else if (personDescEn) {
    prompt = prompt.replace('Chỉ trả về ảnh kết quả, không chèn chữ.', `MÔ TẢ NHÂN VẬT: ${personDescEn}. Chỉ trả về ảnh kết quả, không chèn chữ.`)
  }
  if (noteEn) {
    prompt = prompt.replace(
      'Chỉ trả về ảnh kết quả, không chèn chữ.',
      `YÊU CẦU ẢNH (nền, chữ chèn, yêu cầu khác - KHÔNG phải mô tả người trong ảnh): "${noteEn}". Nếu người dùng muốn có chữ trên ảnh, hãy hiểu đúng ý nghĩa và viết phù hợp, không dán ký tự thô. Chỉ trả về ảnh kết quả, không chèn chữ.`
    )
  }

  const genAI = new GoogleGenerativeAI((await requireGoogleApiKeyForUser(user.id)).apiKey)
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
    trackFromUsageMetadata(response.usageMetadata, GEMINI_3_PRO_IMAGE.model, 'phuc-dung-anh', user.id, imageQuality)
    const imagePartRes = response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
    if (!imagePartRes || !('inlineData' in imagePartRes)) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: 'AI không trả về ảnh hợp lệ.' }
    }
    const resultBuffer = Buffer.from((imagePartRes as { inlineData: { data: string } }).inlineData.data, 'base64')
    const resultPath = `results/${user.id}/restore_${Date.now()}.png`
    const { publicUrl: resultPublicUrl } = await uploadTryOnImagePublic(resultPath, resultBuffer, {
      contentType: 'image/png',
      upsert: true,
    })

    const d = await deductUserCredits(user.id, RESTORE_COST, 'phuc-dung-anh')
    if (!d.ok) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: d.code === 'INSUFFICIENT_CREDITS' ? 'Không đủ credits để hoàn tất.' : d.error }
    }
    await updateTryOnHistoryCompletedPg(historyItem.id, resultPublicUrl)

    revalidatePath('/phuc-dung-anh')
    revalidatePath('/dashboard/history')
    return { success: true, resultUrl: resultPublicUrl }
  } catch (e) {
    await deleteTryOnHistoryRowAndStorage(historyItem.id)
    const msg = e instanceof Error ? e.message : String(e)
    if (/500|Internal Server Error|Internal error/i.test(msg)) {
      return { error: 'Hệ thống quá tải. Bạn có thể chọn 2K hoặc thử lại sau ít phút.' }
    }
    return { error: `Phục dựng ảnh thất bại: ${msg}` }
  }
}
