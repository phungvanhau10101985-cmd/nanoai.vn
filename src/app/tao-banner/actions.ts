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

const BANNER_COSTS = { '2K': 1.5, '4K': 3 } as const
const VALID_ASPECT_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'] as const
const toTenths = (value: number) => Math.round(value * 10)
const formatCredits = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

const PROMPT_BASE = `Tạo banner quảng cáo chuyên nghiệp từ ảnh sản phẩm. Đây là sản phẩm của khách hàng. Thiết kế banner hiện đại, thu hút, bố cục rõ ràng. Chữ/slogan cần được dàn kiểu đẹp, hài hòa với thiết kế, không dán chữ thô. Chỉ trả về ảnh kết quả, không chèn chữ phụ.`

/** Tạo banner quảng cáo. 2K: 1,5 credit, 4K: 3 credit. */
export async function createBanner(formData: FormData) {
  if (!formData || typeof formData.get !== 'function') {
    return { error: 'Dữ liệu không hợp lệ. Vui lòng thử lại.' }
  }
  const imageQuality = (formData.get('imageQuality') as '2K' | '4K') || '2K'
  const aspectRatioRaw = (formData.get('aspectRatio') as string)?.trim() || '16:9'
  const aspectRatio = VALID_ASPECT_RATIOS.includes(aspectRatioRaw as (typeof VALID_ASPECT_RATIOS)[number])
    ? aspectRatioRaw
    : '16:9'
  const note = (formData.get('note') as string)?.trim() || ''
  const images: File[] = []
  const removeBgList: boolean[] = []
  const captionList: string[] = []
  let i = 0
  while (true) {
    const img = formData.get(`image_${i}`) as File | null
    if (!img || img.size === 0) break
    images.push(img)
    removeBgList.push(formData.get(`image_${i}_removeBg`) === 'true')
    captionList.push((formData.get(`image_${i}_caption`) as string)?.trim() || '')
    i++
  }
  if (images.length === 0) return { error: 'Vui lòng tải lên ít nhất 1 ảnh sản phẩm.' }

  const logo = formData.get('logo') as File | null
  const hasLogo = (logo?.size ?? 0) > 0

  let prompt = PROMPT_BASE
  const tachNenIndices = removeBgList.map((v, idx) => (v ? idx + 1 : 0)).filter((v) => v > 0)
  const khongTachIndices = removeBgList.map((v, idx) => (!v ? idx + 1 : 0)).filter((v) => v > 0)
  let bgInstruction = ''
  if (tachNenIndices.length && khongTachIndices.length) {
    bgInstruction = `Images ${tachNenIndices.join(', ')}: remove background, product only. Images ${khongTachIndices.join(', ')}: keep as-is. `
  } else if (tachNenIndices.length) {
    bgInstruction = 'Remove background from all product images before designing banner, product only. '
  } else if (khongTachIndices.length) {
    bgInstruction = 'Do not remove background, use images as-is. '
  }
  if (bgInstruction) {
    prompt = prompt.replace('These are customer products.', `These are customer products. ${bgInstruction.trim()}`)
  }
  if (hasLogo) {
    prompt = prompt.replace('Chỉ trả về ảnh kết quả, không chèn chữ phụ.', 'Ảnh cuối là logo thương hiệu. Hãy đặt logo lên banner chuyên nghiệp, nổi bật. Chỉ trả về ảnh kết quả, không chèn chữ phụ.')
  }
  const captionListEn = await Promise.all(captionList.map((c) => (c ? normalizeToEnglish(c) : '')))
  const captionParts = captionListEn
    .map((c, idx) => (c ? `Image ${idx + 1}: add text "${c}" to that image` : null))
    .filter(Boolean)
  if (captionParts.length) {
    prompt = prompt.replace('Chỉ trả về ảnh kết quả, không chèn chữ phụ.', `NỘI DUNG CHỮ CHO TỪNG ẢNH: ${captionParts.join('. ')}. Dùng typography đẹp. Chỉ trả về ảnh kết quả, không chèn chữ phụ.`)
  }
  const noteEn = note ? await normalizeToEnglish(note) : ''
  if (noteEn) {
    prompt = prompt.replace(
      'Chỉ trả về ảnh kết quả, không chèn chữ phụ.',
      `BRIEF THIẾT KẾ (slogan, màu sắc, bố cục): "${noteEn}". Đây là ý tưởng/ghi chú thiết kế, không phải văn bản thô để dán nguyên. Hãy dàn kiểu chữ chuyên nghiệp, hài hòa với banner. Chỉ trả về ảnh kết quả, không chèn chữ phụ.`
    )
  }

  const COST = BANNER_COSTS[imageQuality]

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
  const path = `uploads/${user.id}/banner_${timestamp}_0.png`
  const { publicUrl: originalPublicUrl } = await uploadTryOnImagePublic(path, images[0], {
    contentType: images[0].type || 'image/png',
  })
  const historyItem = await insertTryOnHistoryProcessingPg({
    userId: user.id,
    originalImageUrl: originalPublicUrl,
    garmentImageUrl: originalPublicUrl,
    feature: 'tao-banner',
  })
  if (!historyItem) return { error: 'Không thể khởi tạo phiên xử lý.' }

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

  const productImageParts = await Promise.all(
    images.map(async (img) => ({
      inlineData: { data: Buffer.from(await img.arrayBuffer()).toString('base64'), mimeType: img.type },
    }))
  )
  const logoPart = hasLogo
    ? { inlineData: { data: Buffer.from(await logo!.arrayBuffer()).toString('base64'), mimeType: logo!.type } }
    : null
  const contentParts: object[] = [{ text: prompt }, ...productImageParts]
  if (logoPart) contentParts.push(logoPart)

  try {
    const result = await model.generateContent(contentParts as never, { safetySettings } as never)
    const response = result.response
    trackFromUsageMetadata(response.usageMetadata, GEMINI_3_PRO_IMAGE.model, 'tao-banner', user.id, imageQuality)
    const imagePartRes = response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
    if (!imagePartRes || !('inlineData' in imagePartRes)) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: 'AI không trả về ảnh hợp lệ.' }
    }
    const resultBuffer = Buffer.from((imagePartRes as { inlineData: { data: string } }).inlineData.data, 'base64')
    const resultPath = `results/${user.id}/banner_${Date.now()}.png`
    const { publicUrl: resultPublicUrl } = await uploadTryOnImagePublic(resultPath, resultBuffer, {
      contentType: 'image/png',
      upsert: true,
    })

    const d = await deductUserCredits(user.id, COST, 'tao-banner')
    if (!d.ok) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: d.code === 'INSUFFICIENT_CREDITS' ? 'Không đủ credits để hoàn tất.' : d.error }
    }
    await updateTryOnHistoryCompletedPg(historyItem.id, resultPublicUrl, {
      feature: 'tao-banner',
      aspect_ratio: aspectRatio,
    })

    revalidatePath('/tao-banner')
    revalidatePath('/dashboard/history')
    return { success: true, resultUrl: resultPublicUrl }
  } catch (e) {
    await deleteTryOnHistoryRowAndStorage(historyItem.id)
    const msg = e instanceof Error ? e.message : String(e)
    if (/500|Internal Server Error|Internal error/i.test(msg)) {
      return { error: 'Hệ thống quá tải. Bạn có thể chọn 2K hoặc thử lại sau ít phút.' }
    }
    return { error: `Tạo banner thất bại: ${msg}` }
  }
}
