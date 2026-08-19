'use server'
import { deleteTryOnHistoryRowAndStorage } from '@/lib/storage/try-on-history-cleanup'
import { getCreditBalanceByUserId } from '@/lib/db/credits-balance'
import { deductUserCredits } from '@/lib/music/deduct-user-credits'


import { getUserForCreditAction } from '@/lib/auth'
import { insertTryOnHistoryProcessingPg, updateTryOnHistoryCompletedPg } from '@/lib/db/try-on-history-pg'
import { revalidatePath } from 'next/cache'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { normalizeToEnglish } from '@/lib/ai-normalize'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import { uploadTryOnImagePublic, getTryOnPublicUrlFromPath } from '@/lib/storage/try-on-public-upload'
import { requireGoogleApiKeyForUser } from '@/lib/ai/google-api-key-resolver'
import { GEMINI_3_PRO_IMAGE } from '@/lib/gemini-config'
import { normalizeLogoAspectRatioForGemini } from '@/lib/partner-website/visual-editor/gemini-working-aspect'

const LOGO_COSTS = { '2K': 1.5, '4K': 3 } as const
const toTenths = (value: number) => Math.round(value * 10)
const formatCredits = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

const PROMPT_BASE = `Thiết kế logo thương hiệu chuyên nghiệp, độc đáo, dễ nhận diện. Phong cách hiện đại, tối giản, dễ mở rộng kích thước. Chỉ trả về ảnh kết quả, không chèn chữ.`

/** Thiết kế logo thương hiệu. 2K: 1,5 credit, 4K: 3 credit. */
export async function createLogo(formData: FormData) {
  if (!formData || typeof formData.get !== 'function') {
    return { error: 'Dữ liệu không hợp lệ. Vui lòng thử lại.' }
  }
  const imageQuality = (formData.get('imageQuality') as '2K' | '4K') || '2K'
  const aspectRatioRaw = (formData.get('aspectRatio') as string)?.trim() || '1:1'
  const aspectRatio = normalizeLogoAspectRatioForGemini(aspectRatioRaw)
  const note = (formData.get('note') as string)?.trim() || ''
  const image = formData.get('image') as File | null

  if (!note && (!image || image.size === 0)) {
    return { error: 'Vui lòng mô tả thương hiệu/logo hoặc tải ảnh tham khảo.' }
  }

  const COST = LOGO_COSTS[imageQuality]

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
  const uploadPath = image?.size ? `uploads/${user.id}/logo_ref_${timestamp}.png` : null
  const placeholderPath = `uploads/${user.id}/placeholder.png`
  let logoOriginalPublicUrl: string
  if (image?.size && uploadPath) {
    const { publicUrl } = await uploadTryOnImagePublic(uploadPath, image, { contentType: image.type || 'image/png' })
    logoOriginalPublicUrl = publicUrl
  } else {
    logoOriginalPublicUrl = getTryOnPublicUrlFromPath(placeholderPath)
  }
  const historyItem = await insertTryOnHistoryProcessingPg({
    userId: user.id,
    originalImageUrl: logoOriginalPublicUrl,
    garmentImageUrl: logoOriginalPublicUrl,
    feature: 'thiet-ke-logo',
  })
  if (!historyItem) return { error: 'Không thể khởi tạo phiên xử lý.' }

  const noteEn = note ? await normalizeToEnglish(note) : ''
  let prompt = PROMPT_BASE
  if (noteEn) {
    prompt = prompt.replace('Chỉ trả về ảnh kết quả, không chèn chữ.', `YÊU CẦU BỔ SUNG CỦA NGƯỜI DÙNG: "${noteEn}". Chỉ trả về ảnh kết quả, không chèn chữ.`)
  }

  const { apiKey } = await requireGoogleApiKeyForUser(user.id)
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: GEMINI_3_PRO_IMAGE.model,
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { imageSize: imageQuality, aspectRatio },
    },
  })
  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  ]

  const contentParts: (string | object)[] = [prompt]
  if (image?.size) {
    const buffer = Buffer.from(await image.arrayBuffer())
    contentParts.push({ inlineData: { data: buffer.toString('base64'), mimeType: image.type } })
  }

  try {
    const result = await model.generateContent(contentParts as never, { safetySettings } as never)
    const response = result.response
    trackFromUsageMetadata(response.usageMetadata, GEMINI_3_PRO_IMAGE.model, 'thiet-ke-logo', user.id, imageQuality)
    const imagePartRes = response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
    if (!imagePartRes || !('inlineData' in imagePartRes)) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: 'AI không trả về ảnh hợp lệ.' }
    }
    const resultBuffer = Buffer.from((imagePartRes as { inlineData: { data: string } }).inlineData.data, 'base64')
    const resultPath = `results/${user.id}/logo_${Date.now()}.png`
    const { publicUrl: logoResultPublicUrl } = await uploadTryOnImagePublic(resultPath, resultBuffer, {
      contentType: 'image/png',
      upsert: true,
    })

    const d = await deductUserCredits(user.id, COST)
    if (!d.ok) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: d.code === 'INSUFFICIENT_CREDITS' ? 'Không đủ credits để hoàn tất.' : d.error }
    }
    await updateTryOnHistoryCompletedPg(historyItem.id, logoResultPublicUrl, {
      feature: 'thiet-ke-logo',
      aspect_ratio: aspectRatio,
    })

    revalidatePath('/thiet-ke-logo')
    revalidatePath('/dashboard/history')
    return { success: true, resultUrl: logoResultPublicUrl }
  } catch (e) {
    await deleteTryOnHistoryRowAndStorage(historyItem.id)
    const msg = e instanceof Error ? e.message : String(e)
    if (/500|Internal Server Error|Internal error/i.test(msg)) {
      return { error: 'Hệ thống quá tải. Bạn có thể chọn 2K hoặc thử lại sau ít phút.' }
    }
    return { error: `Thiết kế logo thất bại: ${msg}` }
  }
}
