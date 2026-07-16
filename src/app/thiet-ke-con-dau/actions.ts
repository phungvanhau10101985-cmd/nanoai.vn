'use server'
import { deleteTryOnHistoryRowAndStorage } from '@/lib/storage/try-on-history-cleanup'

import { getUserForCreditAction } from '@/lib/auth'
import { insertTryOnHistoryProcessingPg, updateTryOnHistoryCompletedPg } from '@/lib/db/try-on-history-pg'
import { revalidatePath } from 'next/cache'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { normalizeToEnglish } from '@/lib/ai-normalize'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import { requireGoogleApiKeyForUser } from '@/lib/ai/google-api-key-resolver'
import { closestAspectRatioFromMmSize, type StampType, VALID_STAMP_ASPECT_RATIOS } from './lib/stamp-types'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'
import { getCreditBalanceByUserId } from '@/lib/db/credits-balance'
import { deductUserCredits } from '@/lib/music/deduct-user-credits'
import { GEMINI_3_PRO_IMAGE } from '@/lib/gemini-config'


const SEAL_COSTS = { '2K': 1.5, '4K': 3 } as const
const SHAPE_TO_ASPECT_RATIO: Record<string, string> = {
  tron: '1:1',
  vuong: '1:1',
  elip: '3:2',
}
const toTenths = (value: number) => Math.round(value * 10)
const formatCredits = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

const TYPE_PROMPTS: Record<string, string> = {
  'doanh-nghiep': 'Con dấu doanh nghiệp (company stamp) – tên công ty, mã số thuế, hình tròn/vuông/elip/chữ nhật, chuyên nghiệp.',
  'chi-nhanh': 'Con dấu chi nhánh (branch stamp) – tên công ty, mã số thuế, tên chi nhánh, chuyên nghiệp.',
  'chuc-danh': 'Con dấu chức danh (title stamp) – tên công ty, mã số thuế, chức danh (Giám đốc, Kế toán trưởng...) và họ tên người giữ chức danh, chuyên nghiệp.',
  'dia-chi': 'Con dấu địa chỉ (address stamp) – địa chỉ là nội dung chính, hình chữ nhật hoặc elip phù hợp, chuyên nghiệp.',
  'da-thu-tien': 'Dấu đã thu tiền (paid/received stamp) – ĐÃ THU TIỀN hoặc tương tự, xác nhận đã thu, chuyên nghiệp.',
  'trang-tri': 'Con dấu trang trí (decorative stamp) – nội dung tùy ý, phong cách craft, đẹp mắt.',
}

const SHAPE_MAP: Record<string, string> = {
  tron: 'circle',
  vuong: 'square',
  elip: 'ellipse',
  'chu-nhat': 'rectangle',
}

const COLOR_MAP: Record<string, string> = {
  do: 'red',
  'xanh-la': 'green',
  'xanh-duong': 'blue',
  den: 'black',
  vang: 'yellow',
  cam: 'orange',
}

/** Tạo con dấu bằng AI. 2K: 1,5 credit, 4K: 3 credit. */
export async function createStampWithAI(formData: FormData) {
  if (!formData || typeof formData.get !== 'function') {
    return { error: 'Dữ liệu không hợp lệ. Vui lòng thử lại.' }
  }
  const stampType = (formData.get('stampType') as StampType) || 'doanh-nghiep'
  const imageQuality = (formData.get('imageQuality') as '2K' | '4K') || '2K'
  const shape = (formData.get('shape') as string) || 'tron'
  const sizeWidthRaw = Math.max(0, parseInt(String(formData.get('sizeWidthMm') || '0'), 10) || 0)
  const sizeHeightRaw = Math.max(0, parseInt(String(formData.get('sizeHeightMm') || '0'), 10) || 0)
  const sizeMm = parseInt(String(formData.get('sizeMm') || '25'), 10) || 25
  const rectW = sizeWidthRaw > 0 ? sizeWidthRaw : 30
  const rectH = sizeHeightRaw > 0 ? sizeHeightRaw : 25
  const aspectRatio =
    shape === 'chu-nhat'
      ? closestAspectRatioFromMmSize(rectW, rectH)
      : (() => {
          const r = SHAPE_TO_ASPECT_RATIO[shape] || '1:1'
          return VALID_STAMP_ASPECT_RATIOS.includes(r as (typeof VALID_STAMP_ASPECT_RATIOS)[number]) ? r : '1:1'
        })()
  const color = (formData.get('color') as string) || 'do'
  const logo = formData.get('logo') as File | null
  const hasLogo = logo?.size && logo.size > 0

  const companyName = (formData.get('companyName') as string)?.trim() || ''
  const taxCode = (formData.get('taxCode') as string)?.trim() || ''
  const branchName = (formData.get('branchName') as string)?.trim() || ''
  const position = (formData.get('position') as string)?.trim() || ''
  const holderName = (formData.get('holderName') as string)?.trim() || ''
  const address = (formData.get('address') as string)?.trim() || ''
  const mainText = (formData.get('mainText') as string)?.trim() || ''
  const subText = (formData.get('subText') as string)?.trim() || ''

  const typeDesc = TYPE_PROMPTS[stampType] || TYPE_PROMPTS['doanh-nghiep']
  const shapeEn = SHAPE_MAP[shape] || 'circle'
  const colorEn = COLOR_MAP[color] || 'red'

  const sizeLine =
    shape === 'chu-nhat'
      ? `HÌNH DẠNG: ${shapeEn}. Kích thước tham chiếu: ${rectW}mm (chiều rộng) × ${rectH}mm (chiều cao), hình chữ nhật.`
      : `HÌNH DẠNG: ${shapeEn}. Kích thước tham chiếu: ${sizeMm}mm.`
  const parts: string[] = [
    `Tạo con dấu/tem chuyên nghiệp cho in ấn. Loại: ${typeDesc}`,
    sizeLine,
    `MÀU SẮC CHÍNH: ${colorEn}. Viền, nền hoặc accent chính dùng màu này.`,
    'Thiết kế phù hợp in trên cao su, nhựa (con dấu) hoặc giấy decal, giấy nhiệt (tem). Bố cục rõ ràng, typography đẹp.',
  ]

  if (['doanh-nghiep', 'chi-nhanh', 'chuc-danh'].includes(stampType)) {
    if (companyName) {
      const en = await normalizeToEnglish(companyName)
      parts.push(`TÊN DOANH NGHIỆP: "${en}". Hiển thị rõ ràng, nổi bật.`)
    }
    if (taxCode) {
      parts.push(`MÃ SỐ THUẾ: "${taxCode}". Hiển thị rõ ràng.`)
    }
    if (branchName && stampType === 'chi-nhanh') {
      const en = await normalizeToEnglish(branchName)
      parts.push(`TÊN CHI NHÁNH: "${en}".`)
    }
    if (position && stampType === 'chuc-danh') {
      const en = await normalizeToEnglish(position)
      parts.push(`CHỨC DANH: "${en}".`)
    }
    if (holderName && stampType === 'chuc-danh') {
      const en = await normalizeToEnglish(holderName)
      parts.push(`HỌ TÊN NGƯỜI GIỮ CHỨC DANH: "${en}". Hiển thị bên dưới chức danh, rõ ràng, nổi bật.`)
    }
    if (address) {
      const en = await normalizeToEnglish(address)
      parts.push(`ĐỊA CHỈ: "${en}".`)
    }
  } else if (stampType === 'dia-chi') {
    if (address) {
      const en = await normalizeToEnglish(address)
      parts.push(`ĐỊA CHỈ (NỘI DUNG CHÍNH): "${en}". Hiển thị rõ ràng, nổi bật.`)
    }
    if (companyName) {
      const en = await normalizeToEnglish(companyName)
      parts.push(`TÊN CÔNG TY (TÙY CHỌN): "${en}".`)
    }
  } else if (stampType === 'da-thu-tien') {
    const effectiveMain = mainText || 'ĐÃ THU TIỀN'
    const mainEn = await normalizeToEnglish(effectiveMain)
    parts.push(`NỘI DUNG CHÍNH: "${mainEn}". Hiển thị rõ ràng, nổi bật.`)
    if (subText) {
      const en = await normalizeToEnglish(subText)
      parts.push(`NỘI DUNG PHỤ (ngày, số tiền): "${en}".`)
    }
  } else if (stampType === 'trang-tri') {
    const mainEn = await normalizeToEnglish(mainText || 'Nội dung tùy ý')
    parts.push(`NỘI DUNG CHÍNH: "${mainEn}".`)
    if (subText) {
      const en = await normalizeToEnglish(subText)
      parts.push(`NỘI DUNG PHỤ: "${en}".`)
    }
  }

  if (hasLogo) {
    parts.push('Ảnh đính kèm là logo. Đặt logo lên con dấu/tem chuyên nghiệp, nổi bật.')
  }

  parts.push('Chỉ trả về ảnh kết quả, không chèn chữ phụ. KHÔNG sử dụng quốc huy, quốc kỳ, đảng kỳ, biểu tượng cơ quan nhà nước.')

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
    feature: 'thiet-ke-con-dau',
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
    trackFromUsageMetadata(response.usageMetadata, GEMINI_3_PRO_IMAGE.model, 'thiet-ke-con-dau', user.id, imageQuality)
    const imagePartRes = response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
    if (!imagePartRes || !('inlineData' in imagePartRes)) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: 'AI không trả về ảnh hợp lệ.' }
    }
    const resultBuffer = Buffer.from((imagePartRes as { inlineData: { data: string } }).inlineData.data, 'base64')
    const resultPath = `results/${user.id}/stamp_${Date.now()}.png`
    const { publicUrl: resultPublicUrl } = await uploadTryOnImagePublic(resultPath, resultBuffer, {
      contentType: 'image/png',
      upsert: true,
    })

    const d = await deductUserCredits(user.id, COST)
    if (!d.ok) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: d.code === 'INSUFFICIENT_CREDITS' ? 'Không đủ credits để hoàn tất.' : d.error }
    }
    await updateTryOnHistoryCompletedPg(historyItem.id, resultPublicUrl, { aspect_ratio: aspectRatio })

    revalidatePath('/thiet-ke-con-dau')
    revalidatePath('/dashboard/history')
    return { success: true, resultUrl: resultPublicUrl }
  } catch (e) {
    await deleteTryOnHistoryRowAndStorage(historyItem.id)
    const msg = e instanceof Error ? e.message : String(e)
    if (/500|Internal Server Error|Internal error/i.test(msg)) {
      return { error: 'Hệ thống quá tải. Bạn có thể chọn 2K hoặc thử lại sau ít phút.' }
    }
    return { error: `Tạo con dấu thất bại: ${msg}` }
  }
}
