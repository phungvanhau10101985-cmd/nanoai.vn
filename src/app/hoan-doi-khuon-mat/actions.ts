'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { normalizeToEnglish } from '@/lib/ai-normalize'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import { detectFaceInTargetImage, extractFaceFromSourceImage } from '@/lib/face-swap-vision'
import sharp from 'sharp'

const FACESWAP_COSTS = { '2K': 2, '4K': 4 } as const
const toTenths = (value: number) => Math.round(value * 10)
const fromTenths = (value: number) => value / 10
const formatCredits = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

const NO_TEXT = `Output ONLY a clean image. NO text, NO watermark, NO logo, NO branding, NO overlay of any kind on the image.`

const PROMPT_BASE = `Face Swap: Transfer face from image 1 onto the body in image 2. Face must look natural, blend with lighting and angle. Match skin tone and color temperature between swapped face and target neck/body. Seamlessly blend jawline and neck transition, no visible color mismatch or hard edge. Preserve expression and pose of target image. ${NO_TEXT}`

/** Suy ra tỷ lệ khung hình gần nhất trong tập ratio Gemini hỗ trợ */
async function getAspectRatioFromImage(buffer: Buffer): Promise<string> {
  const { width, height } = await sharp(buffer).metadata()
  if (!width || !height) return '1:1'
  const ratio = width / height
  const targets: [string, number][] = [
    ['1:1', 1],
    ['3:4', 3 / 4],
    ['4:3', 4 / 3],
    ['9:16', 9 / 16],
    ['16:9', 16 / 9],
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

/** Xóa khuôn mặt local theo bbox Vision để tạo "blank slot" trước khi ghép */
async function removeFaceRegionLocal(
  targetBuffer: Buffer,
  faceBbox: Awaited<ReturnType<typeof detectFaceInTargetImage>>
): Promise<Buffer> {
  if (!faceBbox) return targetBuffer
  const { width: imgW = 0, height: imgH = 0 } = await sharp(targetBuffer).metadata()
  if (!imgW || !imgH) return targetBuffer

  // Nới vùng mặt một chút để che hết chi tiết mắt/mũi/miệng
  const padX = Math.round(faceBbox.w * 0.18)
  const padY = Math.round(faceBbox.h * 0.22)
  const left = Math.max(0, faceBbox.x - padX)
  const top = Math.max(0, faceBbox.y - padY)
  const right = Math.min(imgW, faceBbox.x + faceBbox.w + padX)
  const bottom = Math.min(imgH, faceBbox.y + faceBbox.h + padY)
  const w = Math.max(1, right - left)
  const h = Math.max(1, bottom - top)

  // Lấy màu trung bình vùng mặt để phủ local (giảm artefact trước khi gửi Gemini)
  const stats = await sharp(targetBuffer).extract({ left, top, width: w, height: h }).stats()
  const r = Math.round(stats.channels[0]?.mean ?? 198)
  const g = Math.round(stats.channels[1]?.mean ?? 170)
  const b = Math.round(stats.channels[2]?.mean ?? 160)

  const maskSvg = Buffer.from(
    `<svg width="${imgW}" height="${imgH}" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="${left + w / 2}" cy="${top + h / 2}" rx="${w / 2}" ry="${h / 2}" fill="rgb(${r},${g},${b})" fill-opacity="0.97" />
    </svg>`
  )

  return sharp(targetBuffer)
    .composite([{ input: maskSvg, blend: 'over' }])
    .png()
    .toBuffer()
}

/** Log chi tiết response Gemini để debug */
function logGeminiResponse(
  step: string,
  res: { response: { candidates?: Array<{ finishReason?: string; safetyRatings?: Array<{ category?: string; probability?: string }> }>; promptFeedback?: { blockReason?: string } } }
) {
  const c = res.response.candidates?.[0]
  const pf = res.response.promptFeedback
  const details: Record<string, unknown> = {
    step,
    finishReason: c?.finishReason ?? 'N/A',
    safetyRatings: c?.safetyRatings?.map((r) => `${r.category}=${r.probability}`) ?? [],
    promptBlockReason: pf?.blockReason ?? null,
  }
  console.log('[FaceSwap] Gemini response:', JSON.stringify(details))
}

/** Hoán đổi khuôn mặt. 2K: 2 credit, 4K: 4 credit. Cần 2 ảnh: ảnh khuôn mặt nguồn + ảnh đích. */
export async function faceSwap(formData: FormData) {
  if (!formData || typeof formData.get !== 'function') {
    return { error: 'Dữ liệu không hợp lệ. Vui lòng thử lại.' }
  }
  const faceImage = formData.get('faceImage') as File
  const targetImage = formData.get('targetImage') as File
  const imageQuality = (formData.get('imageQuality') as '2K' | '4K') || '2K'
  const note = (formData.get('note') as string)?.trim() || ''
  if (!faceImage || faceImage.size === 0) return { error: 'Cần tải ảnh khuôn mặt nguồn (ảnh bạn).' }
  if (!targetImage || targetImage.size === 0) return { error: 'Cần tải ảnh đích (nhân vật muốn ghép mặt vào).' }

  let prompt = PROMPT_BASE
  if (note) {
    const noteEn = await normalizeToEnglish(note)
    prompt = prompt.replace(NO_TEXT, `REQUEST: "${noteEn}". ${NO_TEXT}`)
  }

  const faceBuffer = Buffer.from(await faceImage.arrayBuffer())
  const targetBuffer = Buffer.from(await targetImage.arrayBuffer())
  const aspectRatio = await getAspectRatioFromImage(targetBuffer)

  const COST = FACESWAP_COSTS[imageQuality]
  const supabase = createClient()
  const adminSupabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const result = await getUserForAction(() => supabase.auth.getUser())
  if ('error' in result) return { error: result.error }
  const { user } = result

  const { data: creditData, error: creditError } = await supabase.from('credits').select('balance').eq('user_id', user.id).single()
  if (creditError || !creditData || toTenths(creditData.balance) < toTenths(COST)) {
    return { error: `Không đủ credits. Cần ${formatCredits(COST)} credits, hiện có ${formatCredits(creditData?.balance || 0)}.` }
  }

  const timestamp = Date.now()
  const path = `uploads/${user.id}/faceswap_${timestamp}.png`
  await supabase.storage.from('try-on-images').upload(path, faceImage)
  const { data: origUrl } = supabase.storage.from('try-on-images').getPublicUrl(path)
  const { data: historyItem, error: historyError } = await supabase.from('try_on_history').insert({
    user_id: user.id,
    original_image_url: origUrl.publicUrl,
    garment_image_url: origUrl.publicUrl,
    status: 'processing',
  }).select().single()
  if (historyError || !historyItem) return { error: 'Không thể khởi tạo phiên xử lý.' }

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)
  const model = genAI.getGenerativeModel({
    model: 'gemini-3-pro-image-preview',
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

  try {
    let facePartToUse: { inlineData: { data: string; mimeType: string } } = {
      inlineData: { data: faceBuffer.toString('base64'), mimeType: faceImage.type || 'image/png' },
    }
    let targetPreparedBuffer = targetBuffer

    let faceBbox: Awaited<ReturnType<typeof detectFaceInTargetImage>> = null
    try {
      faceBbox = await detectFaceInTargetImage(targetBuffer)
    } catch (visionErr) {
      console.warn('[FaceSwap] Vision lỗi, dùng single call:', visionErr)
    }

    try {
      const extractedFace = await extractFaceFromSourceImage(faceBuffer)
      if (extractedFace) {
        facePartToUse = { inlineData: { data: extractedFace.toString('base64'), mimeType: 'image/png' } }
        console.log('[FaceSwap] Dùng ảnh mặt đã cắt từ nguồn')
      }
    } catch (extractErr) {
      console.warn('[FaceSwap] Không cắt được mặt nguồn, dùng ảnh gốc:', extractErr)
    }

    if (faceBbox) {
      targetPreparedBuffer = await removeFaceRegionLocal(targetBuffer, faceBbox)
      console.log('[FaceSwap] Đã xóa mặt local theo bbox Vision')
    }

    // Chỉ gọi Gemini 1 lần: ảnh mặt nguồn + ảnh đích đã xử lý local
    const targetPreparedPart = {
      inlineData: { data: targetPreparedBuffer.toString('base64'), mimeType: targetImage.type || 'image/png' },
    }
    const singlePrompt = prompt.includes('REQUEST:')
      ? prompt
      : prompt.replace(
          'Preserve expression and pose of target image.',
          'Preserve the face from image 1 with minimal changes. Only adjust lighting/angle to match. Preserve expression and pose of target body.'
        )
    const genResult = await model.generateContent([singlePrompt, facePartToUse, targetPreparedPart], { safetySettings })
    const response = genResult.response
    logGeminiResponse('single_call_local_remove', genResult)
    trackFromUsageMetadata(response.usageMetadata, 'gemini-3-pro-image-preview', 'hoan-doi-khuon-mat', user.id, imageQuality)
    const imagePartRes = response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
    if (!imagePartRes || !('inlineData' in imagePartRes)) {
      const reason = response.candidates?.[0]?.finishReason ?? response.promptFeedback?.blockReason ?? 'unknown'
      console.warn('[FaceSwap] Single call thất bại, finishReason:', reason)
      await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
      if (String(reason).toUpperCase().includes('IMAGE_SAFETY')) {
        return { error: 'Ảnh bị bộ lọc an toàn từ chối. Vui lòng đổi ảnh khác (ít nhạy cảm hơn) và thử lại.' }
      }
      return { error: `AI không trả về ảnh hợp lệ (${reason}). Thử ảnh khác.` }
    }
    const resultBuffer = Buffer.from(imagePartRes.inlineData.data, 'base64')

    const resultPath = `results/${user.id}/faceswap_${Date.now()}.png`
    await adminSupabase.storage.from('try-on-images').upload(resultPath, resultBuffer, { contentType: 'image/png', upsert: true })
    const { data: urlData } = adminSupabase.storage.from('try-on-images').getPublicUrl(resultPath)

    const { data: latestCredit } = await adminSupabase.from('credits').select('balance').eq('user_id', user.id).single()
    if (!latestCredit || toTenths(latestCredit.balance) < toTenths(COST)) {
      await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
      return { error: 'Không đủ credits để hoàn tất.' }
    }
    const newBalance = fromTenths(toTenths(latestCredit.balance) - toTenths(COST))
    await adminSupabase.from('credits').update({ balance: newBalance }).eq('user_id', user.id)
    await adminSupabase.from('try_on_history').update({ result_image_url: urlData.publicUrl, status: 'completed' }).eq('id', historyItem.id)

    revalidatePath('/hoan-doi-khuon-mat')
    revalidatePath('/dashboard/history')
    return { success: true, resultUrl: urlData.publicUrl }
  } catch (e) {
    await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
    const msg = e instanceof Error ? e.message : String(e)
    const stack = e instanceof Error ? e.stack : undefined
    console.error('[FaceSwap] Lỗi:', msg, stack ? `\n${stack}` : '')
    if (/500|Internal Server Error|Internal error/i.test(msg)) {
      return { error: 'Hệ thống quá tải. Bạn có thể chọn 2K hoặc thử lại sau ít phút.' }
    }
    return { error: `Hoán đổi khuôn mặt thất bại: ${msg}` }
  }
}
