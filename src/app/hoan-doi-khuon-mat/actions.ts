'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { normalizeToEnglish } from '@/lib/ai-normalize'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import sharp from 'sharp'
import { detectFaceInTargetImage, detectFacesInTargetImage, extractFaceFromSourceImage, type FaceBbox } from '@/lib/face-swap-vision'

const FACESWAP_COSTS = { '2K': 2, '4K': 4 } as const
const toTenths = (value: number) => Math.round(value * 10)
const fromTenths = (value: number) => value / 10
const formatCredits = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

const NO_TEXT = `Chỉ trả về ảnh sạch. KHÔNG chữ, KHÔNG watermark, KHÔNG logo, KHÔNG thương hiệu, KHÔNG lớp phủ bất kỳ.`

const PROMPT_BASE = `Hoán đổi khuôn mặt: lấy khuôn mặt từ ảnh 1 ghép vào cơ thể trong ảnh 2. Kết quả phải tự nhiên, khớp ánh sáng và góc mặt. Đồng nhất tông da và nhiệt màu giữa mặt ghép với vùng cổ/cơ thể ảnh đích. Chuyển tiếp vùng quai hàm - cổ phải mượt, không viền cứng, không lệch màu. BẮT BUỘC tự tính lại kích thước khuôn mặt để cân đối với tỷ lệ đầu, cổ, vai và thân hình của ảnh đích (không để mặt quá to hoặc quá nhỏ). Giữ nguyên biểu cảm và tư thế của ảnh đích. ${NO_TEXT}`

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

/**
 * Xóa khuôn mặt trên ảnh đích bằng xử lý local:
 * lấy vùng mặt theo bbox Vision, blur mạnh rồi ghép lại vào ảnh gốc.
 */
async function removeFaceRegionLocal(targetBuffer: Buffer, face: FaceBbox): Promise<Buffer> {
  const meta = await sharp(targetBuffer).metadata()
  const imgW = meta.width ?? 0
  const imgH = meta.height ?? 0
  if (imgW <= 0 || imgH <= 0) {
    throw new Error('Không đọc được kích thước ảnh đích để xóa mặt local.')
  }

  const padX = Math.round(face.w * 0.25)
  const padY = Math.round(face.h * 0.25)
  const left = Math.max(0, face.x - padX)
  const top = Math.max(0, face.y - padY)
  const right = Math.min(imgW, face.x + face.w + padX)
  const bottom = Math.min(imgH, face.y + face.h + padY)
  const width = Math.max(1, right - left)
  const height = Math.max(1, bottom - top)

  const blurredRegion = await sharp(targetBuffer)
    .extract({ left, top, width, height })
    .blur(35)
    .toBuffer()

  return sharp(targetBuffer)
    .composite([{ input: blurredRegion, left, top }])
    .png()
    .toBuffer()
}

/**
 * Chuẩn hóa kích thước mặt nguồn theo bbox mặt đích trước khi gửi Gemini.
 * Điều này giúp AI ghép tự nhiên hơn, giảm tình trạng mặt quá to/nhỏ.
 */
async function resizeSourceFaceToTargetSize(sourceFaceBuffer: Buffer, targetFace: FaceBbox): Promise<Buffer> {
  // Nới nhẹ để phủ vùng viền hàm/cổ khi ghép.
  const targetW = Math.max(64, Math.round(targetFace.w * 1.08))
  const targetH = Math.max(64, Math.round(targetFace.h * 1.08))
  return sharp(sourceFaceBuffer)
    .resize(targetW, targetH, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer()
}

/** Hoán đổi khuôn mặt. 2K: 2 credit, 4K: 4 credit. Cần 2 ảnh: ảnh khuôn mặt nguồn + ảnh đích. */
export async function faceSwap(formData: FormData) {
  if (!formData || typeof formData.get !== 'function') {
    return { error: 'Dữ liệu không hợp lệ. Vui lòng thử lại.' }
  }
  const swapMode = ((formData.get('swapMode') as string) || 'single') === 'couple' ? 'couple' : 'single'
  const faceImage = formData.get('faceImage') as File
  const faceImageLeft = formData.get('faceImageLeft') as File | null
  const faceImageRight = formData.get('faceImageRight') as File | null
  const targetImage = formData.get('targetImage') as File
  const imageQuality = (formData.get('imageQuality') as '2K' | '4K') || '2K'
  const note = (formData.get('note') as string)?.trim() || ''
  if (swapMode === 'single') {
    if (!faceImage || faceImage.size === 0) return { error: 'Cần tải ảnh khuôn mặt nguồn (ảnh bạn).' }
  } else {
    if (!faceImageLeft || faceImageLeft.size === 0) return { error: 'Cần tải ảnh khuôn mặt cho người bên trái.' }
    if (!faceImageRight || faceImageRight.size === 0) return { error: 'Cần tải ảnh khuôn mặt cho người bên phải.' }
  }
  if (!targetImage || targetImage.size === 0) return { error: 'Cần tải ảnh đích (nhân vật muốn ghép mặt vào).' }

  let prompt = PROMPT_BASE
  if (note) {
    const noteEn = await normalizeToEnglish(note)
    prompt = prompt.replace(NO_TEXT, `YÊU CẦU BỔ SUNG: "${noteEn}". ${NO_TEXT}`)
  }

  const faceBuffer = swapMode === 'single' && faceImage ? Buffer.from(await faceImage.arrayBuffer()) : null
  const faceBufferLeft = swapMode === 'couple' && faceImageLeft ? Buffer.from(await faceImageLeft.arrayBuffer()) : null
  const faceBufferRight = swapMode === 'couple' && faceImageRight ? Buffer.from(await faceImageRight.arrayBuffer()) : null
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
  const sourcePath = `uploads/${user.id}/faceswap_source_${timestamp}.png`
  const targetPath = `uploads/${user.id}/faceswap_target_${timestamp}.png`
  if (swapMode === 'single' && faceImage) {
    await supabase.storage.from('try-on-images').upload(sourcePath, faceImage)
  } else if (faceImageLeft) {
    await supabase.storage.from('try-on-images').upload(sourcePath, faceImageLeft)
  }
  await supabase.storage.from('try-on-images').upload(targetPath, targetImage)
  const { data: sourceUrl } = supabase.storage.from('try-on-images').getPublicUrl(sourcePath)
  const { data: targetUrl } = supabase.storage.from('try-on-images').getPublicUrl(targetPath)
  const { data: historyItem, error: historyError } = await supabase.from('try_on_history').insert({
    user_id: user.id,
    original_image_url: sourceUrl.publicUrl,
    garment_image_url: targetUrl.publicUrl,
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
    let singlePrompt = ''
    const contentParts: Array<{ text?: string } | { inlineData: { data: string; mimeType: string } }> = []

    if (swapMode === 'single') {
      if (!faceBuffer) throw new Error('Thiếu ảnh khuôn mặt nguồn.')

      const croppedSourceFace = await extractFaceFromSourceImage(faceBuffer)
      if (!croppedSourceFace) {
        await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
        return { error: 'Vision OCR không phát hiện được khuôn mặt rõ trên ảnh nguồn. Vui lòng chọn ảnh có 1 mặt rõ hơn.' }
      }
      console.log('[FaceSwap] Dùng ảnh mặt đã cắt từ nguồn bằng Vision')

      const targetFace = await detectFaceInTargetImage(targetBuffer)
      if (!targetFace) {
        await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
        return { error: 'Vision OCR không phát hiện được khuôn mặt trên ảnh đích. Vui lòng dùng ảnh có mặt rõ hơn.' }
      }

      const targetWithoutFace = await removeFaceRegionLocal(targetBuffer, targetFace)
      console.log('[FaceSwap] Đã xóa mặt local theo bbox Vision')

      const resizedSourceFace = await resizeSourceFaceToTargetSize(croppedSourceFace, targetFace)
      console.log('[FaceSwap] Đã resize mặt nguồn theo kích thước mặt đích:', {
        targetW: targetFace.w,
        targetH: targetFace.h,
      })

      singlePrompt = `${prompt}
YÊU CẦU BẮT BUỘC:
- Ảnh 1 là khuôn mặt nguồn đã được cắt bằng Vision OCR và đã resize theo kích thước mặt đích.
- Ảnh 2 là ảnh đích đã xóa mặt local tại vùng: ${targetFace.positionHint}.
- Hãy ghép khuôn mặt từ Ảnh 1 vào đúng vị trí mặt đã xóa trên Ảnh 2.
- TỰ ĐỘNG tính lại tỉ lệ khuôn mặt để cân đối với đầu/cổ/vai/thân ảnh đích; ưu tiên tỷ lệ thật như ảnh chân dung tự nhiên.
- Giữ nguyên toàn bộ bố cục, cơ thể, trang phục, nền của Ảnh 2; chỉ thay vùng khuôn mặt.
- Không tạo thêm người, không đổi góc máy, không đổi khung hình.
${NO_TEXT}`

      contentParts.push(
        { text: singlePrompt },
        { inlineData: { data: resizedSourceFace.toString('base64'), mimeType: 'image/png' } },
        { inlineData: { data: targetWithoutFace.toString('base64'), mimeType: 'image/png' } }
      )
    } else {
      if (!faceBufferLeft || !faceBufferRight) throw new Error('Thiếu ảnh khuôn mặt trái/phải.')

      const croppedLeftFace = await extractFaceFromSourceImage(faceBufferLeft)
      const croppedRightFace = await extractFaceFromSourceImage(faceBufferRight)
      if (!croppedLeftFace) {
        await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
        return { error: 'Vision OCR không phát hiện mặt trong ảnh nguồn bên trái. Vui lòng chọn ảnh rõ mặt hơn.' }
      }
      if (!croppedRightFace) {
        await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
        return { error: 'Vision OCR không phát hiện mặt trong ảnh nguồn bên phải. Vui lòng chọn ảnh rõ mặt hơn.' }
      }

      const targetFaces = await detectFacesInTargetImage(targetBuffer, 2)
      if (targetFaces.length < 2) {
        await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
        return { error: 'Ảnh đích không nhận đủ 2 khuôn mặt (trái/phải). Vui lòng chọn ảnh có 2 người rõ mặt.' }
      }

      let targetWithoutFaces = targetBuffer
      targetWithoutFaces = await removeFaceRegionLocal(targetWithoutFaces, targetFaces[0])
      targetWithoutFaces = await removeFaceRegionLocal(targetWithoutFaces, targetFaces[1])
      console.log('[FaceSwap] Đã xóa mặt local cho 2 người theo bbox Vision')

      const resizedLeftFace = await resizeSourceFaceToTargetSize(croppedLeftFace, targetFaces[0])
      const resizedRightFace = await resizeSourceFaceToTargetSize(croppedRightFace, targetFaces[1])
      console.log('[FaceSwap] Đã resize mặt nguồn trái/phải theo kích thước mặt đích tương ứng')

      singlePrompt = `${prompt}
YÊU CẦU BẮT BUỘC CHO CHẾ ĐỘ 2 NGƯỜI:
- Ảnh 1: khuôn mặt nguồn cho người bên TRÁI (đã cắt và resize theo kích thước mặt trái đích).
- Ảnh 2: khuôn mặt nguồn cho người bên PHẢI (đã cắt và resize theo kích thước mặt phải đích).
- Ảnh 3: ảnh đích đã xóa 2 khuôn mặt local tại vị trí:
  + Người trái: ${targetFaces[0].positionHint}
  + Người phải: ${targetFaces[1].positionHint}
- Ghép Ảnh 1 vào đúng người bên trái, ghép Ảnh 2 vào đúng người bên phải.
- TỰ ĐỘNG tính lại kích thước mỗi khuôn mặt cho cân đối đầu/cổ/vai/thân của từng người tương ứng.
- Giữ nguyên toàn bộ bố cục, cơ thể, trang phục, nền của ảnh đích; chỉ thay vùng khuôn mặt.
- Không đổi trái/phải, không tạo thêm người, không đổi góc máy, không đổi khung hình.
${NO_TEXT}`

      contentParts.push(
        { text: singlePrompt },
        { inlineData: { data: resizedLeftFace.toString('base64'), mimeType: 'image/png' } },
        { inlineData: { data: resizedRightFace.toString('base64'), mimeType: 'image/png' } },
        { inlineData: { data: targetWithoutFaces.toString('base64'), mimeType: 'image/png' } }
      )
    }

    const genResult = await model.generateContent(contentParts, { safetySettings })
    const response = genResult.response
    logGeminiResponse('single_call_vision_local', genResult)
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
