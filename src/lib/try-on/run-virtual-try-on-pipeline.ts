/**
 * Pipeline thử đồ ảo (Gemini + Vision) — lưu storage Bunny + bản ghi try_on_history qua Postgres.
 */
import sharp from 'sharp'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { removeFaceFromGarmentImages } from '@/lib/remove-face-garment-server'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import {
  uploadTryOnImagePublic,
  getTryOnPublicUrlFromPath,
  removeTryOnStorageObjects,
} from '@/lib/storage/try-on-public-upload'
import { getCreditBalanceByUserId } from '@/lib/db/credits-balance'
import { deductUserCredits } from '@/lib/music/deduct-user-credits'
import {
  deleteTryOnHistoryPg,
  insertTryOnHistoryProcessingPg,
  updateTryOnHistoryCompletedPg,
} from '@/lib/db/try-on-history-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { resolveGoogleApiKeyForUser } from '@/lib/ai/google-api-key-resolver'

const toTenths = (value: number) => Math.round(value * 10)
const formatCredits = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

async function getAspectRatioFromImage(buffer: Buffer): Promise<string> {
  const { width, height } = await sharp(buffer).metadata()
  if (!width || !height) return '1:1'
  const ratio = width / height
  const targets: [string, number][] = [
    ['1:1', 1],
    ['2:3', 2 / 3],
    ['3:2', 3 / 2],
    ['3:4', 3 / 4],
    ['4:3', 4 / 3],
    ['9:16', 9 / 16],
    ['16:9', 16 / 9],
    ['21:9', 21 / 9],
  ]
  let best = '1:1'
  let bestDiff = Infinity
  for (const [label, target] of targets) {
    const diff = Math.abs(ratio - target)
    if (diff < bestDiff) {
      bestDiff = diff
      best = label
    }
  }
  return best
}

export type RunVirtualTryOnPipelineParams = {
  billingUserId: string
  prompt: string
  cost: number
  imageQuality: '2K' | '4K'
  userImage: File
  garmentFilesOrdered: File[]
}

export type RunVirtualTryOnPipelineResult =
  | { success: true; resultUrl: string; historyId: string; creditsRemaining: number }
  | { error: string }

export async function runVirtualTryOnPipeline(params: RunVirtualTryOnPipelineParams): Promise<RunVirtualTryOnPipelineResult> {
  const { billingUserId, prompt, cost, imageQuality, userImage, garmentFilesOrdered } = params

  if (!isPgConfigured()) {
    return { error: 'Thiếu cấu hình cơ sở dữ liệu (DATABASE_URL).' }
  }

  if (!Number.isFinite(cost) || cost <= 0) {
    return { error: 'Cấu hình chi phí không hợp lệ.' }
  }
  if (!garmentFilesOrdered.length) {
    return { error: 'Cần ít nhất một ảnh trang phục.' }
  }
  if (!prompt.trim()) {
    return { error: 'Prompt thử đồ không hợp lệ.' }
  }

  let balanceBefore: number
  try {
    balanceBefore = await getCreditBalanceByUserId(billingUserId)
  } catch {
    return { error: 'Không đọc được số dư credits.' }
  }
  if (toTenths(balanceBefore) < toTenths(cost)) {
    return {
      error: `Không đủ credits. Cần ${formatCredits(cost)} credits, hiện có ${formatCredits(balanceBefore)}.`,
    }
  }

  const timestamp = Date.now()
  const userImagePath = `uploads/${billingUserId}/user_${timestamp}.png`
  const stagedPaths: string[] = []
  const userBuf = Buffer.from(await userImage.arrayBuffer())
  try {
    await uploadTryOnImagePublic(userImagePath, userBuf, {
      contentType: userImage.type || 'image/png',
      upsert: true,
    })
    stagedPaths.push(userImagePath)
  } catch {
    return { error: 'Failed to upload user image.' }
  }

  let processedGarmentImages: File[]
  try {
    processedGarmentImages = await removeFaceFromGarmentImages(garmentFilesOrdered)
  } catch (visionErr) {
    await removeTryOnStorageObjects(stagedPaths)
    const msg = visionErr instanceof Error ? visionErr.message : String(visionErr)
    return { error: `Vision API lỗi: ${msg}` }
  }

  const garmentImageUrls: string[] = []
  try {
    for (let i = 0; i < processedGarmentImages.length; i++) {
      const path = `uploads/${billingUserId}/garment_${i}_${timestamp}.png`
      const gBuf = Buffer.from(await processedGarmentImages[i].arrayBuffer())
      await uploadTryOnImagePublic(path, gBuf, {
        contentType: processedGarmentImages[i].type || 'image/png',
        upsert: true,
      })
      stagedPaths.push(path)
      garmentImageUrls.push(getTryOnPublicUrlFromPath(path))
    }
  } catch {
    await removeTryOnStorageObjects(stagedPaths)
    return { error: 'Failed to upload garment images.' }
  }
  const userImagePublicUrl = getTryOnPublicUrlFromPath(userImagePath)
  const garmentUrlForHistory = garmentImageUrls[0] ?? userImagePublicUrl

  const historyItem = await insertTryOnHistoryProcessingPg({
    userId: billingUserId,
    originalImageUrl: userImagePublicUrl,
    garmentImageUrl: garmentUrlForHistory,
    feature: 'try_on',
  })

  if (!historyItem) {
    await removeTryOnStorageObjects(stagedPaths)
    return { error: 'Failed to initialize try-on session.' }
  }

  const aspectRatio = await getAspectRatioFromImage(userBuf)

  const resolvedGoogleKey = await resolveGoogleApiKeyForUser(billingUserId)
  if (!resolvedGoogleKey) {
    await removeTryOnStorageObjects(stagedPaths)
    await deleteTryOnHistoryPg(historyItem.id)
    return { error: 'Thiếu GOOGLE_API_KEY trên server hoặc Gemini API key riêng hợp lệ.' }
  }

  const genAI = new GoogleGenerativeAI(resolvedGoogleKey.apiKey)
  const modelName = 'gemini-3-pro-image-preview'
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: {
        imageSize: imageQuality === '4K' ? '4K' : '2K',
        aspectRatio,
      },
    },
  })

  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  ]

  const imageParts = [
    { inlineData: { data: userBuf.toString('base64'), mimeType: userImage.type || 'image/png' } },
    ...(await Promise.all(
      processedGarmentImages.map(async (img) => ({
        inlineData: {
          data: Buffer.from(await img.arrayBuffer()).toString('base64'),
          mimeType: img.type || 'image/png',
        },
      }))
    )),
  ]

  const extractImageBase64FromResponse = (response: unknown): string | null => {
    const candidates = (response as { candidates?: Array<{ content?: { parts?: Array<unknown> } }> })?.candidates
    if (!Array.isArray(candidates)) return null
    for (const candidate of candidates) {
      const parts = candidate?.content?.parts
      if (!Array.isArray(parts)) continue
      for (const part of parts) {
        const inline = (part as { inlineData?: { data?: string } })?.inlineData
        const data = inline?.data
        if (typeof data === 'string' && data.length > 0) return data
      }
    }
    return null
  }

  try {
    let resultImageBase64: string | null = null
    let lastResponse: unknown = null
    for (let attempt = 1; attempt <= 2; attempt++) {
      const genResult = await model.generateContent([prompt, ...imageParts], { safetySettings })
      const response = genResult.response
      lastResponse = response
      trackFromUsageMetadata(
        response.usageMetadata,
        modelName,
        'thu-do-online',
        billingUserId,
        imageQuality === '4K' ? '4K' : '2K'
      )
      resultImageBase64 = extractImageBase64FromResponse(response)
      if (resultImageBase64) break
      if (attempt === 1) {
        // Gemini thỉnh thoảng trả text-only candidate; retry nhanh 1 lần để giảm fail ngẫu nhiên.
        continue
      }
    }
    if (!resultImageBase64) {
      const finishReasons = (
        (lastResponse as { candidates?: Array<{ finishReason?: string }> })?.candidates ?? []
      )
        .map((c) => c?.finishReason)
        .filter(Boolean)
      const reason = finishReasons.length ? ` finishReason=${finishReasons.join(',')}` : ''
      throw new Error(`AI did not return a valid image.${reason}`)
    }

    const resultImageBuffer = Buffer.from(resultImageBase64, 'base64')
    const resultImagePath = `results/${billingUserId}/try-on_${timestamp}.png`

    const { publicUrl: resultImageUrl } = await uploadTryOnImagePublic(resultImagePath, resultImageBuffer, {
      contentType: 'image/png',
      upsert: true,
    })
    stagedPaths.push(resultImagePath)

    const deduct = await deductUserCredits(billingUserId, cost)
    if (!deduct.ok) {
      throw new Error(
        deduct.code === 'INSUFFICIENT_CREDITS'
          ? `Không đủ credits để hoàn tất giao dịch. Cần ${formatCredits(cost)}.`
          : deduct.error || 'Đã tạo ảnh nhưng không thể trừ credit. Vui lòng thử lại.'
      )
    }
    const newBalance = deduct.balance

    const updated = await updateTryOnHistoryCompletedPg(historyItem.id, resultImageUrl)
    if (!updated) {
      throw new Error('Đã tạo ảnh và trừ credit, nhưng không thể cập nhật lịch sử thử đồ.')
    }

    return {
      success: true,
      resultUrl: resultImageUrl,
      historyId: historyItem.id,
      creditsRemaining: newBalance,
    }
  } catch (aiError: unknown) {
    console.error('[runVirtualTryOnPipeline]', aiError)
    await removeTryOnStorageObjects(stagedPaths)
    await deleteTryOnHistoryPg(historyItem.id)
    const aiErrorMessage = aiError instanceof Error ? aiError.message : 'Unknown error'
    if (/500|Internal Server Error|Internal error/i.test(aiErrorMessage)) {
      return { error: 'Hệ thống quá tải. Có thể chọn 2K hoặc thử lại sau ít phút.' }
    }
    return { error: `Failed to generate AI image: ${aiErrorMessage}` }
  }
}
