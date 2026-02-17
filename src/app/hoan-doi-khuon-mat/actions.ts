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

const PROMPT_BASE = `Face Swap: Transfer face from image 1 onto the body in image 2. Face must look natural, blend with lighting and angle. Preserve expression and pose of target image. ${NO_TEXT}`

/** Prompt xóa mặt khỏi ảnh đích – vị trí mặt đã được Vision định vị */
const PROMPT_REMOVE_FACE = (hint: string) =>
  `This image has a person. Remove ONLY the face region. The face is ${hint}. Inpaint the face area so the background (skin tone, hair, neck) blends naturally – as if preparing a blank slot for another face. Keep body, clothes, pose, background unchanged. Output one image with the face region cleanly removed and inpainted. ${NO_TEXT}`

/** Prompt ghép mặt – ảnh 1 đã cắt chỉ còn mặt, ảnh 2 đã xóa mặt */
const PROMPT_PASTE_FACE = `Face Swap: Image 1 = cropped face only (no background). Image 2 = body with face region removed (blank slot). Paste the face from image 1 into the blank slot in image 2. Match lighting, angle, skin tone. Preserve facial features from image 1 with minimal change. Output one natural result image. ${NO_TEXT}`

/** Suy ra tỷ lệ khung hình gần nhất từ ảnh gốc để giữ framing output */
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

  const faceB64 = faceBuffer.toString('base64')
  const targetB64 = targetBuffer.toString('base64')
  const facePart = { inlineData: { data: faceB64, mimeType: faceImage.type } }
  const targetPart = { inlineData: { data: targetB64, mimeType: targetImage.type } }

  try {
    let resultBuffer: Buffer

    let faceBbox: Awaited<ReturnType<typeof detectFaceInTargetImage>> = null
    try {
      faceBbox = await detectFaceInTargetImage(targetBuffer)
    } catch (visionErr) {
      console.warn('[FaceSwap] Vision lỗi, dùng single call:', visionErr)
    }
    if (faceBbox) {
      // Pipeline: (1) Cắt mặt từ ảnh nguồn (2) Xóa mặt ảnh đích (3) Ghép mặt đã cắt vào
      let facePartToUse = facePart
      try {
        const extractedFace = await extractFaceFromSourceImage(faceBuffer)
        if (extractedFace) {
          facePartToUse = { inlineData: { data: extractedFace.toString('base64'), mimeType: 'image/png' } }
          console.log('[FaceSwap] Dùng ảnh mặt đã cắt từ nguồn')
        }
      } catch (extractErr) {
        console.warn('[FaceSwap] Không cắt được mặt nguồn, dùng ảnh gốc:', extractErr)
      }

      const removePrompt = PROMPT_REMOVE_FACE(faceBbox.positionHint)
      const removeRes = await model.generateContent([removePrompt, targetPart], { safetySettings })
      logGeminiResponse('remove_face', removeRes)
      const removeImg = removeRes.response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
      if (!removeImg || !('inlineData' in removeImg)) {
        console.warn('[FaceSwap] Bước xóa mặt không trả ảnh, fallback single call')
        const fallback = await model.generateContent([prompt, facePartToUse, targetPart], { safetySettings })
        logGeminiResponse('fallback_remove', fallback)
        trackFromUsageMetadata(fallback.response.usageMetadata, 'gemini-3-pro-image-preview', 'hoan-doi-khuon-mat', user.id, imageQuality)
        const fp = fallback.response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
        if (!fp || !('inlineData' in fp)) {
          const reason = fallback.response.candidates?.[0]?.finishReason ?? fallback.response.promptFeedback?.blockReason ?? 'unknown'
          console.warn('[FaceSwap] Fallback remove thất bại, finishReason:', reason)
          await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
          return { error: `AI không trả về ảnh hợp lệ (${reason}). Thử ảnh khác.` }
        }
        resultBuffer = Buffer.from(fp.inlineData.data, 'base64')
      } else {
        trackFromUsageMetadata(removeRes.response.usageMetadata, 'gemini-3-pro-image-preview', 'hoan-doi-khuon-mat', user.id, imageQuality)
        const targetWithoutFace = removeImg.inlineData
        const pasteRes = await model.generateContent(
          [PROMPT_PASTE_FACE, facePartToUse, { inlineData: { data: targetWithoutFace.data, mimeType: targetWithoutFace.mimeType || 'image/png' } }],
          { safetySettings }
        )
        logGeminiResponse('paste_face', pasteRes)
        trackFromUsageMetadata(pasteRes.response.usageMetadata, 'gemini-3-pro-image-preview', 'hoan-doi-khuon-mat', user.id, imageQuality)
        const pasteImg = pasteRes.response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
        if (!pasteImg || !('inlineData' in pasteImg)) {
          console.warn('[FaceSwap] Bước ghép mặt không trả ảnh, fallback single call')
          const enhancedPrompt = prompt.includes('REQUEST:')
            ? prompt
            : prompt.replace(
                'Preserve expression and pose of target image.',
                'Preserve the face from image 1 with minimal changes. Only adjust lighting/angle to match. Preserve expression and pose of target body.'
              )
          const fallback = await model.generateContent([enhancedPrompt, facePartToUse, targetPart], { safetySettings })
          logGeminiResponse('fallback_paste', fallback)
          trackFromUsageMetadata(fallback.response.usageMetadata, 'gemini-3-pro-image-preview', 'hoan-doi-khuon-mat', user.id, imageQuality)
          const fp = fallback.response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in fp)
          if (!fp || !('inlineData' in fp)) {
            const reason = fallback.response.candidates?.[0]?.finishReason ?? fallback.response.promptFeedback?.blockReason ?? 'unknown'
            console.warn('[FaceSwap] Fallback cũng thất bại, finishReason:', reason)
            await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
            return { error: `AI không trả về ảnh hợp lệ (${reason}). Thử ảnh khác hoặc chọn chất lượng 2K.` }
          }
          resultBuffer = Buffer.from(fp.inlineData.data, 'base64')
        } else {
          resultBuffer = Buffer.from(pasteImg.inlineData.data, 'base64')
        }
      }
    } else {
      // Fallback: single call (prompt đã nhấn mạnh preserve face)
      const enhancedPrompt = prompt.includes('REQUEST:')
        ? prompt
        : prompt.replace(
            'Preserve expression and pose of target image.',
            'Preserve the face from image 1 with minimal changes. Only adjust lighting/angle to match. Preserve expression and pose of target body.'
          )
      const result = await model.generateContent([enhancedPrompt, facePart, targetPart], { safetySettings })
      const response = result.response
      logGeminiResponse('single_call', result)
      trackFromUsageMetadata(response.usageMetadata, 'gemini-3-pro-image-preview', 'hoan-doi-khuon-mat', user.id, imageQuality)
      const imagePartRes = response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
      if (!imagePartRes || !('inlineData' in imagePartRes)) {
        const reason = response.candidates?.[0]?.finishReason ?? response.promptFeedback?.blockReason ?? 'unknown'
        console.warn('[FaceSwap] Single call thất bại, finishReason:', reason)
        await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
        return { error: `AI không trả về ảnh hợp lệ (${reason}). Thử ảnh khác.` }
      }
      resultBuffer = Buffer.from(imagePartRes.inlineData.data, 'base64')
    }

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
