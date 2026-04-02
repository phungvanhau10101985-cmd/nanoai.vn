/**
 * Pipeline thử đồ ảo (Gemini + Vision) — dùng Supabase service role.
 * Gọi từ server action (user đăng nhập) hoặc API partner (Bearer).
 */
import sharp from 'sharp'
import type { SupabaseClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { removeFaceFromGarmentImages } from '@/lib/remove-face-garment-server'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'

const toTenths = (value: number) => Math.round(value * 10)
const fromTenths = (value: number) => value / 10
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
  adminSupabase: SupabaseClient
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
  const { adminSupabase, billingUserId, prompt, cost, imageQuality, userImage, garmentFilesOrdered } = params

  if (!Number.isFinite(cost) || cost <= 0) {
    return { error: 'Cấu hình chi phí không hợp lệ.' }
  }
  if (!garmentFilesOrdered.length) {
    return { error: 'Cần ít nhất một ảnh trang phục.' }
  }
  if (!prompt.trim()) {
    return { error: 'Prompt thử đồ không hợp lệ.' }
  }

  const { data: creditData, error: creditError } = await adminSupabase
    .from('credits')
    .select('balance')
    .eq('user_id', billingUserId)
    .single()

  if (creditError || !creditData || toTenths(creditData.balance) < toTenths(cost)) {
    return {
      error: `Không đủ credits. Cần ${formatCredits(cost)} credits, hiện có ${formatCredits(creditData?.balance || 0)}.`,
    }
  }

  const timestamp = Date.now()
  const userImagePath = `uploads/${billingUserId}/user_${timestamp}.png`
  const userBuf = Buffer.from(await userImage.arrayBuffer())
  const { error: userImageError } = await adminSupabase.storage.from('try-on-images').upload(userImagePath, userBuf, {
    contentType: userImage.type || 'image/png',
    upsert: true,
  })
  if (userImageError) return { error: 'Failed to upload user image.' }

  let processedGarmentImages: File[]
  try {
    processedGarmentImages = await removeFaceFromGarmentImages(garmentFilesOrdered)
  } catch (visionErr) {
    const msg = visionErr instanceof Error ? visionErr.message : String(visionErr)
    return { error: `Vision API lỗi: ${msg}` }
  }

  const garmentImageUrls: string[] = []
  for (let i = 0; i < processedGarmentImages.length; i++) {
    const path = `uploads/${billingUserId}/garment_${i}_${timestamp}.png`
    const gBuf = Buffer.from(await processedGarmentImages[i].arrayBuffer())
    await adminSupabase.storage.from('try-on-images').upload(path, gBuf, {
      contentType: processedGarmentImages[i].type || 'image/png',
      upsert: true,
    })
    const { data } = adminSupabase.storage.from('try-on-images').getPublicUrl(path)
    garmentImageUrls.push(data.publicUrl)
  }
  const { data: userImageUrl } = adminSupabase.storage.from('try-on-images').getPublicUrl(userImagePath)

  const { data: historyItem, error: historyError } = await adminSupabase
    .from('try_on_history')
    .insert({
      user_id: billingUserId,
      original_image_url: userImageUrl.publicUrl,
      garment_image_url: garmentImageUrls[0] || null,
      status: 'processing',
      feature: 'try_on',
    })
    .select()
    .single()

  if (historyError || !historyItem) {
    return { error: 'Failed to initialize try-on session.' }
  }

  const aspectRatio = await getAspectRatioFromImage(userBuf)

  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) {
    await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
    return { error: 'Thiếu GOOGLE_API_KEY trên server.' }
  }

  const genAI = new GoogleGenerativeAI(apiKey)
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

  try {
    const genResult = await model.generateContent([prompt, ...imageParts], { safetySettings })
    const response = genResult.response
    trackFromUsageMetadata(
      response.usageMetadata,
      modelName,
      'thu-do-online',
      billingUserId,
      imageQuality === '4K' ? '4K' : '2K'
    )

    const imagePart = response.candidates?.[0]?.content?.parts?.find((part) => 'inlineData' in part)
    if (!imagePart || !('inlineData' in imagePart)) {
      throw new Error(`AI did not return a valid image.`)
    }

    const resultImageBase64 = (imagePart as { inlineData: { data: string } }).inlineData.data
    const resultImageBuffer = Buffer.from(resultImageBase64, 'base64')
    const resultImagePath = `results/${billingUserId}/try-on_${timestamp}.png`

    await adminSupabase.storage.from('try-on-images').upload(resultImagePath, resultImageBuffer, {
      contentType: 'image/png',
      upsert: true,
    })
    const { data: resultImageUrlData } = adminSupabase.storage.from('try-on-images').getPublicUrl(resultImagePath)
    const resultImageUrl = resultImageUrlData.publicUrl

    const { data: latestCreditData, error: latestCreditError } = await adminSupabase
      .from('credits')
      .select('balance')
      .eq('user_id', billingUserId)
      .single()

    if (latestCreditError || !latestCreditData) {
      throw new Error('Không thể đọc số dư credit hiện tại để trừ credit.')
    }
    if (toTenths(latestCreditData.balance) < toTenths(cost)) {
      throw new Error(`Không đủ credits để hoàn tất giao dịch. Cần ${formatCredits(cost)}, hiện có ${formatCredits(latestCreditData.balance)}.`)
    }

    const newBalance = fromTenths(toTenths(latestCreditData.balance) - toTenths(cost))
    const { error: deductCreditError } = await adminSupabase
      .from('credits')
      .update({ balance: newBalance })
      .eq('user_id', billingUserId)

    if (deductCreditError) {
      throw new Error('Đã tạo ảnh nhưng không thể trừ credit. Vui lòng thử lại.')
    }

    const { error: updateHistoryError } = await adminSupabase
      .from('try_on_history')
      .update({ result_image_url: resultImageUrl, status: 'completed' })
      .eq('id', historyItem.id)

    if (updateHistoryError) {
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
    await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
    const aiErrorMessage = aiError instanceof Error ? aiError.message : 'Unknown error'
    if (/500|Internal Server Error|Internal error/i.test(aiErrorMessage)) {
      return { error: 'Hệ thống quá tải. Có thể chọn 2K hoặc thử lại sau ít phút.' }
    }
    return { error: `Failed to generate AI image: ${aiErrorMessage}` }
  }
}
