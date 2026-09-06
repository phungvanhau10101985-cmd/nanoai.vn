'use server'
import { deleteTryOnHistoryRowAndStorage } from '@/lib/storage/try-on-history-cleanup'

import { getUserForCreditAction } from '@/lib/auth'
import { insertTryOnHistoryProcessingPg, updateTryOnHistoryCompletedPg } from '@/lib/db/try-on-history-pg'
import { revalidatePath } from 'next/cache'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { normalizeToEnglish } from '@/lib/ai-normalize'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import { requireGoogleApiKeyForUser } from '@/lib/ai/google-api-key-resolver'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'
import { getCreditBalanceByUserId } from '@/lib/db/credits-balance'
import { deductUserCredits } from '@/lib/music/deduct-user-credits'
import { GEMINI_3_PRO_IMAGE } from '@/lib/gemini-config'


const SEAL_COSTS = { '2K': 1.5, '4K': 3 } as const
const VALID_ASPECT_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '5:7', '7:10'] as const
const toTenths = (value: number) => Math.round(value * 10)
const formatCredits = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

const TYPE_PROMPTS: Record<string, string> = {
  'niem-phong': 'Tem niêm phong (security seal) – viền đỏ nét đứt, tamper-evident, chuyên nghiệp.',
  'bao-hanh': 'Tem bảo hành (warranty seal) – viền đỏ nét liền, ghi hạn bảo hành, chuyên nghiệp.',
  'chinh-hang': 'Tem hàng chính hãng (authentic seal) – viền xanh lá, xác nhận chính gốc, chống giả.',
}

/** Tạo tem nhãn bằng AI. 2K: 1,5 credit, 4K: 3 credit. */
export async function createSealLabelWithAI(formData: FormData) {
  if (!formData || typeof formData.get !== 'function') {
    return { error: 'Dữ liệu không hợp lệ. Vui lòng thử lại.' }
  }
  const imageQuality = (formData.get('imageQuality') as '2K' | '4K') || '2K'
  const aspectRatioRaw = (formData.get('aspectRatio') as string)?.trim() || '1:1'
  const aspectRatio = VALID_ASPECT_RATIOS.includes(aspectRatioRaw as (typeof VALID_ASPECT_RATIOS)[number])
    ? aspectRatioRaw
    : '1:1'
  const sealType = (formData.get('sealType') as string) || 'niem-phong'
  const mainText = (formData.get('mainText') as string)?.trim() || ''
  const brandName = (formData.get('brandName') as string)?.trim() || ''
  const productName = (formData.get('productName') as string)?.trim() || ''
  const sealColor = (formData.get('sealColor') as string)?.trim() || ''
  const validityDate = (formData.get('validityDate') as string)?.trim() || ''
  const logo = formData.get('logo') as File | null
  const hasLogo = logo?.size && logo.size > 0

  const typeDesc = TYPE_PROMPTS[sealType] || TYPE_PROMPTS['niem-phong']

  const parts: string[] = [
    `Tạo tem nhãn chuyên nghiệp cho in ấn. Loại: ${typeDesc}`,
    'Thiết kế phù hợp in trên giấy decal, giấy nhiệt. Bố cục rõ ràng, typography đẹp.',
  ]
  const effectiveMain = mainText || (sealType === 'chinh-hang' ? 'HÀNG CHÍNH HÃNG' : sealType === 'bao-hanh' ? 'BẢO HÀNH' : 'TEM LIÊM PHONG')
  const mainTextEn = await normalizeToEnglish(effectiveMain)
  parts.push(`NỘI DUNG CHÍNH GHI TRÊN TEM: "${mainTextEn}". Hiển thị rõ ràng, nổi bật.`)
  if (brandName) {
    const brandNameEn = await normalizeToEnglish(brandName)
    parts.push(`TÊN THƯƠNG HIỆU: "${brandNameEn}". Hiển thị tên thương hiệu trên tem.`)
  }
  if (productName) {
    const productNameEn = await normalizeToEnglish(productName)
    parts.push(`TÊN SẢN PHẨM: "${productNameEn}". Hiển thị tên sản phẩm trên tem.`)
  }
  const COLOR_MAP: Record<string, string> = {
    do: 'red',
    'xanh-la': 'green',
    'xanh-duong': 'blue',
    vang: 'yellow',
    trang: 'white',
    den: 'black',
    cam: 'orange',
  }
  if (sealColor && COLOR_MAP[sealColor]) {
    parts.push(`MÀU CƠ BẢN CỦA TEM: ${COLOR_MAP[sealColor]}. Viền, nền hoặc accent chính của tem dùng màu này.`)
  }
  if (validityDate && sealType === 'bao-hanh') {
    const validityEn = await normalizeToEnglish(`Hạn: ${validityDate}`)
    parts.push(`HẠN BẢO HÀNH: "${validityEn}".`)
  }
  if (hasLogo) {
    parts.push('Ảnh đính kèm là logo thương hiệu. Đặt logo lên tem chuyên nghiệp, nổi bật.')
  }
  parts.push('Chỉ trả về ảnh kết quả, không chèn chữ phụ.')
  const prompt = parts.join('\n')

  const COST = SEAL_COSTS[imageQuality]

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

  const historyItem = await insertTryOnHistoryProcessingPg({
    userId: user.id,
    originalImageUrl: '',
    garmentImageUrl: '',
    feature: 'tao-tem-niem-phong-bao-hanh',
  })
  if (!historyItem) return { error: 'Không thể khởi tạo phiên xử lý.' }

  const genAI = new GoogleGenerativeAI((await requireGoogleApiKeyForUser(user.id)).apiKey)
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

  const contentParts: object[] = [{ text: prompt }]
  if (hasLogo && logo) {
    contentParts.push({
      inlineData: { data: Buffer.from(await logo.arrayBuffer()).toString('base64'), mimeType: logo.type },
    })
  }

  try {
    const genResult = await model.generateContent(contentParts as never, { safetySettings } as never)
    const response = genResult.response
    trackFromUsageMetadata(response.usageMetadata, GEMINI_3_PRO_IMAGE.model, 'tao-tem-niem-phong-bao-hanh', user.id, imageQuality)
    const imagePartRes = response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
    if (!imagePartRes || !('inlineData' in imagePartRes)) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: 'AI không trả về ảnh hợp lệ.' }
    }
    const resultBuffer = Buffer.from((imagePartRes as { inlineData: { data: string } }).inlineData.data, 'base64')
    const resultPath = `results/${user.id}/seal_${Date.now()}.png`
    const { publicUrl: resultPublicUrl } = await uploadTryOnImagePublic(resultPath, resultBuffer, {
      contentType: 'image/png',
      upsert: true,
    })

    const d = await deductUserCredits(user.id, COST, 'tao-tem-niem-phong-bao-hanh')
    if (!d.ok) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: d.code === 'INSUFFICIENT_CREDITS' ? 'Không đủ credits để hoàn tất.' : d.error }
    }
    await updateTryOnHistoryCompletedPg(historyItem.id, resultPublicUrl, { aspect_ratio: aspectRatio })

    revalidatePath('/tao-tem-niem-phong-bao-hanh')
    revalidatePath('/dashboard/history')
    return { success: true, resultUrl: resultPublicUrl }
  } catch (e) {
    await deleteTryOnHistoryRowAndStorage(historyItem.id)
    const msg = e instanceof Error ? e.message : String(e)
    if (/500|Internal Server Error|Internal error/i.test(msg)) {
      return { error: 'Hệ thống quá tải. Bạn có thể chọn 2K hoặc thử lại sau ít phút.' }
    }
    return { error: `Tạo tem thất bại: ${msg}` }
  }
}
