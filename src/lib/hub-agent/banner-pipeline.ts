import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { normalizeToEnglish } from '@/lib/ai-normalize'
import { requireGoogleApiKeyForUser } from '@/lib/ai/google-api-key-resolver'
import { getCreditBalanceByUserId } from '@/lib/db/credits-balance'
import { insertTryOnHistoryProcessingPg, updateTryOnHistoryCompletedPg } from '@/lib/db/try-on-history-pg'
import { deductUserCredits } from '@/lib/music/deduct-user-credits'
import { deleteTryOnHistoryRowAndStorage } from '@/lib/storage/try-on-history-cleanup'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import type { HubAutoRunImageQuality } from '@/lib/hub-agent/auto-run-support'
import { GEMINI_3_PRO_IMAGE } from '@/lib/gemini-config'

const BANNER_COSTS = { '2K': 1.5, '4K': 3 } as const
const VALID_ASPECT_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'] as const

const PROMPT_BASE = `Tạo banner quảng cáo chuyên nghiệp từ ảnh sản phẩm. Đây là sản phẩm của khách hàng. Thiết kế banner hiện đại, thu hút, bố cục rõ ràng. Chữ/slogan cần được dàn kiểu đẹp, hài hòa với thiết kế, không dán chữ thô. Chỉ trả về ảnh kết quả, không chèn chữ phụ.`

const toTenths = (value: number) => Math.round(value * 10)

export type RunBannerPipelineInput = {
  userId: string
  imageBuffers: { buffer: Buffer; mimeType: string }[]
  note?: string
  imageQuality?: HubAutoRunImageQuality
  aspectRatio?: string
}

export type RunBannerPipelineResult =
  | { ok: true; resultUrl: string; historyId: string; charged: number }
  | { ok: false; error: string }

export async function runBannerPipeline(input: RunBannerPipelineInput): Promise<RunBannerPipelineResult> {
  const imageQuality = input.imageQuality ?? '2K'
  const aspectRatioRaw = input.aspectRatio?.trim() || '16:9'
  const aspectRatio = VALID_ASPECT_RATIOS.includes(aspectRatioRaw as (typeof VALID_ASPECT_RATIOS)[number])
    ? aspectRatioRaw
    : '16:9'
  const note = input.note?.trim() ?? ''
  const images = input.imageBuffers
  if (!images.length) return { ok: false, error: 'Thiếu ảnh sản phẩm.' }

  let prompt = PROMPT_BASE
  const noteEn = note ? await normalizeToEnglish(note) : ''
  if (noteEn) {
    prompt = prompt.replace(
      'Chỉ trả về ảnh kết quả, không chèn chữ phụ.',
      `BRIEF THIẾT KẾ (slogan, màu sắc, bố cục): "${noteEn}". Đây là ý tưởng/ghi chú thiết kế, không phải văn bản thô để dán nguyên. Hãy dàn kiểu chữ chuyên nghiệp, hài hòa với banner. Chỉ trả về ảnh kết quả, không chèn chữ phụ.`
    )
  }

  const COST = BANNER_COSTS[imageQuality]
  let balance = 0
  try {
    balance = await getCreditBalanceByUserId(input.userId)
  } catch {
    return { ok: false, error: 'Không đọc được số dư credits.' }
  }
  if (toTenths(balance) < toTenths(COST)) {
    return { ok: false, error: `Không đủ credits (cần ${COST}).` }
  }

  const timestamp = Date.now()
  const first = images[0]!
  const path = `uploads/${input.userId}/banner_${timestamp}_0.png`
  const { publicUrl: originalPublicUrl } = await uploadTryOnImagePublic(path, first.buffer, {
    contentType: first.mimeType || 'image/png',
  })
  const historyItem = await insertTryOnHistoryProcessingPg({
    userId: input.userId,
    originalImageUrl: originalPublicUrl,
    garmentImageUrl: originalPublicUrl,
    feature: 'tao-banner',
  })
  if (!historyItem) return { ok: false, error: 'Không thể khởi tạo phiên xử lý.' }

  const { apiKey } = await requireGoogleApiKeyForUser(input.userId)
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

  const productImageParts = images.map((img) => ({
    inlineData: { data: img.buffer.toString('base64'), mimeType: img.mimeType || 'image/png' },
  }))
  const contentParts: object[] = [{ text: prompt }, ...productImageParts]

  try {
    const result = await model.generateContent(contentParts as never, { safetySettings } as never)
    const response = result.response
    trackFromUsageMetadata(response.usageMetadata, GEMINI_3_PRO_IMAGE.model, 'tao-banner', input.userId, imageQuality)
    const imagePartRes = response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
    if (!imagePartRes || !('inlineData' in imagePartRes)) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { ok: false, error: 'AI không trả về ảnh hợp lệ.' }
    }
    const resultBuffer = Buffer.from((imagePartRes as { inlineData: { data: string } }).inlineData.data, 'base64')
    const resultPath = `results/${input.userId}/banner_${Date.now()}.png`
    const { publicUrl: resultPublicUrl } = await uploadTryOnImagePublic(resultPath, resultBuffer, {
      contentType: 'image/png',
      upsert: true,
    })

    const d = await deductUserCredits(input.userId, COST)
    if (!d.ok) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { ok: false, error: d.error || 'Không thể trừ credits.' }
    }
    await updateTryOnHistoryCompletedPg(historyItem.id, resultPublicUrl, {
      feature: 'tao-banner',
      aspect_ratio: aspectRatio,
    })
    return { ok: true, resultUrl: resultPublicUrl, historyId: historyItem.id, charged: COST }
  } catch (e) {
    await deleteTryOnHistoryRowAndStorage(historyItem.id)
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `Tạo banner thất bại: ${msg}` }
  }
}
