import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { normalizeToEnglish } from '@/lib/ai-normalize'
import { requireGoogleApiKeyForUser } from '@/lib/ai/google-api-key-resolver'
import { getCreditBalanceByUserId } from '@/lib/db/credits-balance'
import { insertTryOnHistoryProcessingPg, updateTryOnHistoryCompletedPg } from '@/lib/db/try-on-history-pg'
import { deductUserCredits } from '@/lib/music/deduct-user-credits'
import { deleteTryOnHistoryRowAndStorage } from '@/lib/storage/try-on-history-cleanup'
import { GEMINI_3_PRO_IMAGE } from '@/lib/gemini-config'
import {
  downloadTryOnObject,
  tryOnPublicUrlToStoragePath,
  uploadTryOnImagePublic,
} from '@/lib/storage/try-on-public-upload'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import type { HubAutoRunImageQuality } from '@/lib/hub-agent/auto-run-support'

const SHARPEN_COSTS = { '2K': 1.5, '4K': 3 } as const
const PROMPT_BASE = `Làm nét ảnh này. Tăng độ sắc nét, giảm mờ, tăng chi tiết. Giữ nguyên nội dung, bố cục và màu sắc gốc. Chỉ trả về ảnh kết quả, không chèn chữ.`

const toTenths = (value: number) => Math.round(value * 10)

export type RunSharpenPipelineInput = {
  userId: string
  imageBuffer: Buffer
  mimeType?: string
  note?: string
  imageQuality?: HubAutoRunImageQuality
}

export type RunSharpenPipelineResult =
  | { ok: true; resultUrl: string; historyId: string; charged: number }
  | { ok: false; error: string }

export async function loadImageBufferFromUrl(url: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const storagePath = tryOnPublicUrlToStoragePath(url)
  if (storagePath) {
    const buf = await downloadTryOnObject(storagePath)
    if (buf) return { buffer: buf, mimeType: 'image/png' }
  }
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const mimeType = res.headers.get('content-type') || 'image/png'
    return { buffer: Buffer.from(await res.arrayBuffer()), mimeType }
  } catch {
    return null
  }
}

export async function runSharpenPipeline(input: RunSharpenPipelineInput): Promise<RunSharpenPipelineResult> {
  const imageQuality = input.imageQuality ?? '2K'
  const note = input.note?.trim() ?? ''
  let prompt = PROMPT_BASE
  const noteEn = note ? await normalizeToEnglish(note) : ''
  if (noteEn) {
    prompt = prompt.replace(
      'Chỉ trả về ảnh kết quả, không chèn chữ.',
      `YÊU CẦU BỔ SUNG CỦA NGƯỜI DÙNG: "${noteEn}". Chỉ trả về ảnh kết quả, không chèn chữ.`
    )
  }

  const COST = SHARPEN_COSTS[imageQuality]
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
  const path = `uploads/${input.userId}/sharpen_${timestamp}.png`
  const { publicUrl: originalPublicUrl } = await uploadTryOnImagePublic(path, input.imageBuffer, {
    contentType: input.mimeType || 'image/png',
  })
  const historyItem = await insertTryOnHistoryProcessingPg({
    userId: input.userId,
    originalImageUrl: originalPublicUrl,
    garmentImageUrl: originalPublicUrl,
    feature: 'sharpen',
  })
  if (!historyItem) return { ok: false, error: 'Không thể khởi tạo phiên xử lý.' }

  const { apiKey } = await requireGoogleApiKeyForUser(input.userId)
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: GEMINI_3_PRO_IMAGE.model,
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { imageSize: imageQuality },
    },
  })
  const imagePart = {
    inlineData: {
      data: input.imageBuffer.toString('base64'),
      mimeType: input.mimeType || 'image/png',
    },
  }
  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  ]

  try {
    const result = await model.generateContent([prompt, imagePart], { safetySettings })
    const response = result.response
    trackFromUsageMetadata(response.usageMetadata, GEMINI_3_PRO_IMAGE.model, 'lam-net-anh', input.userId, imageQuality)
    const imagePartRes = response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
    if (!imagePartRes || !('inlineData' in imagePartRes)) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { ok: false, error: 'AI không trả về ảnh hợp lệ.' }
    }
    const resultBuffer = Buffer.from((imagePartRes as { inlineData: { data: string } }).inlineData.data, 'base64')
    const resultPath = `results/${input.userId}/sharpen_${Date.now()}.png`
    const { publicUrl: resultPublicUrl } = await uploadTryOnImagePublic(resultPath, resultBuffer, {
      contentType: 'image/png',
      upsert: true,
    })

    const deduct = await deductUserCredits(input.userId, COST, 'lam-net-anh')
    if (!deduct.ok) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { ok: false, error: deduct.error || 'Không thể trừ credits.' }
    }
    await updateTryOnHistoryCompletedPg(historyItem.id, resultPublicUrl)
    return { ok: true, resultUrl: resultPublicUrl, historyId: historyItem.id, charged: COST }
  } catch (e) {
    await deleteTryOnHistoryRowAndStorage(historyItem.id)
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `Làm nét thất bại: ${msg}` }
  }
}
