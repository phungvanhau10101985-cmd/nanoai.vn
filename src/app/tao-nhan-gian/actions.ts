'use server'
import { deleteTryOnHistoryRowAndStorage } from '@/lib/storage/try-on-history-cleanup'

import { getUserForAction } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { GEMINI_25_FLASH_TEXT_NO_THINKING } from '@/lib/gemini-config'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import { stripBackground } from '@/lib/remove-background'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'
import { insertTryOnHistoryProcessingPg, updateTryOnHistoryCompletedPg } from '@/lib/db/try-on-history-pg'
import { getCreditBalanceByUserId } from '@/lib/db/credits-balance'
import { deductUserCredits } from '@/lib/music/deduct-user-credits'


const STICKER_COSTS = { '2K': 2, '4K': 4 } as const
const VALID_ASPECT_RATIOS = ['1:1', '4:3', '3:4', '16:9', '9:16'] as const
const toTenths = (value: number) => Math.round(value * 10)
const formatCredits = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

const STICKER_EXPANSION_PROMPT = `Bạn là nhà thiết kế nhãn dán/sticker. Người dùng đưa ra ý tưởng ngắn gọn về nhãn dán cần tạo. Nhiệm vụ của bạn là mở rộng thành mô tả CHI TIẾT bằng TIẾNG VIỆT để AI vẽ chính xác.

Quy tắc:
- Viết mô tả bằng TIẾNG VIỆT.
- Mô tả đầy đủ: nhân vật/đối tượng chính, phong cách (kawaii, minimalist, cartoon, dễ thương...), màu sắc, chi tiết (mũ, áo, biểu cảm, phụ kiện...), bố cục.
- BỐ CỤC: Nhấn mạnh thiết kế SÁT MÉP KHUNG – chủ thể hoặc chi tiết phụ (lá, bong bóng, viền trang trí...) chạm sát mép ảnh, không để khoảng trống quanh. Ví dụ: "chủ thể chạm sát mép khung", "thiết kế tràn viền", "các chi tiết chạm 2–3 cạnh ảnh".
- Ví dụ mô tả: "Nhãn dán phong cách kawaii: gấu trúc đỏ dễ thương đội mũ tre nhỏ, đang ăn lá trúc xanh. Gấu trúc và lá trúc chạm sát mép khung. Đường nét đậm rõ, tô màu cel-shading đơn giản, màu sắc tươi sáng."
- Độ dài: 2–4 câu, đủ chi tiết để vẽ.
- Chỉ xuất mô tả, không thêm lời bình hay giải thích.`

const PROMPT_BASE = `Tạo thiết kế nhãn dán theo mô tả sau.

YÊU CẦU BẮT BUỘC:
1. Nền PHẢI LÀ NỀN TRẮNG TINH (pure white #FFFFFF). Thiết kế nhãn dán trên nền trắng, không nền trong suốt, không nền màu khác.
2. SÁT MÉP KHUNG: Thiết kế phải chạm sát hoặc gần sát mép ảnh. Không để khoảng trống quanh. Chủ thể hoặc chi tiết phụ phải chạm ít nhất 2–3 cạnh khung. Thiết kế tràn viền (full-bleed).

Phong cách: đường nét đậm rõ, tô màu cel-shading đơn giản, bảng màu tươi sáng. Phù hợp in sticker/nhãn dán. Chỉ xuất ảnh kết quả.`

/** Tạo nhãn gián: Gemini nền trắng → rembg tách nền. 2K: 2 credit, 4K: 4 credit. */
export async function createStickerLabel(formData: FormData) {
  if (!formData || typeof formData.get !== 'function') {
    return { error: 'Dữ liệu không hợp lệ. Vui lòng thử lại.' }
  }
  const prompt = (formData.get('prompt') as string)?.trim() || ''
  const imageQuality = (formData.get('imageQuality') as '2K' | '4K') || '2K'
  const aspectRatioRaw = (formData.get('aspectRatio') as string)?.trim() || '1:1'
  const aspectRatio = VALID_ASPECT_RATIOS.includes(aspectRatioRaw as (typeof VALID_ASPECT_RATIOS)[number])
    ? aspectRatioRaw
    : '1:1'

  if (!prompt) {
    return { error: 'Vui lòng nhập ý tưởng nhãn gián cần tạo.' }
  }

  const COST = STICKER_COSTS[imageQuality]

  const authResult = await getUserForAction()
  if ('error' in authResult) return { error: authResult.error }
  const { user } = authResult

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
    feature: 'sticker',
  })
  if (!historyItem) return { error: 'Không thể khởi tạo phiên xử lý.' }

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)

  // Bước 1: Gemini Flash 2.5 mở rộng ý tưởng thành mô tả chi tiết
  const flashModel = genAI.getGenerativeModel(GEMINI_25_FLASH_TEXT_NO_THINKING)
  const expansionResult = await flashModel.generateContent(
    `${STICKER_EXPANSION_PROMPT}\n\nÝ TƯỞNG CỦA NGƯỜI DÙNG: "${prompt}"`
  )
  const expandedDesc =
    (expansionResult.response.text?.() || '').trim() ||
    expansionResult.response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
    prompt

  // Bước 2: Gemini tạo ảnh nhãn gián nền trắng
  const fullPrompt = `${PROMPT_BASE}\n\nMÔ TẢ CẦN VẼ:\n"${expandedDesc}"`

  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  ]

  const model = genAI.getGenerativeModel({
    model: 'gemini-3-pro-image-preview',
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { imageSize: imageQuality, aspectRatio },
    },
  })

  const genResult = await model.generateContent(fullPrompt, { safetySettings })
  const response = genResult.response
  trackFromUsageMetadata(response.usageMetadata, 'gemini-3-pro-image-preview', 'tao-nhan-gian', user.id, imageQuality)

  const imagePartRes = response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
  if (!imagePartRes || !('inlineData' in imagePartRes)) {
    await deleteTryOnHistoryRowAndStorage(historyItem.id)
    return { error: 'AI không trả về ảnh hợp lệ. Vui lòng thử lại.' }
  }

  let resultBuffer = Buffer.from((imagePartRes as { inlineData: { data: string } }).inlineData.data, 'base64')

  // Tách nền bằng rembg (fallback ảnh gốc nếu lỗi)
  const stripBg = process.env.STICKER_STRIP_BACKGROUND !== 'false'
  if (stripBg) {
    resultBuffer = Buffer.from(await stripBackground(resultBuffer))
  }

  try {
    const resultPath = `results/${user.id}/sticker_${Date.now()}.png`
    const { publicUrl: resultPublicUrl } = await uploadTryOnImagePublic(resultPath, resultBuffer, {
      contentType: 'image/png',
      upsert: true,
    })

    const d = await deductUserCredits(user.id, COST)
    if (!d.ok) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: d.code === 'INSUFFICIENT_CREDITS' ? 'Không đủ credits để hoàn tất.' : d.error }
    }
    await updateTryOnHistoryCompletedPg(historyItem.id, resultPublicUrl, {
      feature: 'tao-nhan-gian',
      aspect_ratio: aspectRatio,
    })

    revalidatePath('/tao-nhan-gian')
    revalidatePath('/dashboard/history')
    return { success: true, resultUrl: resultPublicUrl }
  } catch (e) {
    await deleteTryOnHistoryRowAndStorage(historyItem.id)
    const msg = e instanceof Error ? e.message : String(e)
    return { error: msg }
  }
}
