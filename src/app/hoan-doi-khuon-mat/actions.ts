'use server'
import { deleteTryOnHistoryRowAndStorage } from '@/lib/storage/try-on-history-cleanup'
import { getCreditBalanceByUserId } from '@/lib/db/credits-balance'
import { deductUserCredits } from '@/lib/music/deduct-user-credits'


import { getUserForCreditAction } from '@/lib/auth'
import { insertTryOnHistoryProcessingPg, updateTryOnHistoryCompletedPg } from '@/lib/db/try-on-history-pg'
import { revalidatePath } from 'next/cache'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { normalizeToEnglish } from '@/lib/ai-normalize'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import sharp from 'sharp'
import { detectFaceInTargetImage, detectFacesInTargetImage, extractFaceFromSourceImage, type FaceBbox } from '@/lib/face-swap-vision'
import { uploadTryOnImagePublic, getTryOnPublicUrlFromPath } from '@/lib/storage/try-on-public-upload'
import { requireGoogleApiKeyForUser } from '@/lib/ai/google-api-key-resolver'

const FACESWAP_COSTS = { '2K': 1, '4K': 2 } as const
const toTenths = (value: number) => Math.round(value * 10)
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

/** Hoán đổi khuôn mặt. 2K: 1 credit, 4K: 2 credit. Cần 2 ảnh: ảnh khuôn mặt nguồn + ảnh đích. */
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

  const timestamp = Date.now()
  const sourcePath = `uploads/${user.id}/faceswap_source_${timestamp}.png`
  const targetPath = `uploads/${user.id}/faceswap_target_${timestamp}.png`
  if (swapMode === 'single' && faceImage) {
    await uploadTryOnImagePublic(sourcePath, faceImage, { contentType: faceImage.type || 'image/png' })
  } else if (faceImageLeft) {
    await uploadTryOnImagePublic(sourcePath, faceImageLeft, { contentType: faceImageLeft.type || 'image/png' })
  }
  await uploadTryOnImagePublic(targetPath, targetImage, { contentType: targetImage.type || 'image/png' })
  const sourcePublicUrl = getTryOnPublicUrlFromPath(sourcePath)
  const targetPublicUrl = getTryOnPublicUrlFromPath(targetPath)
  const historyItem = await insertTryOnHistoryProcessingPg({
    userId: user.id,
    originalImageUrl: sourcePublicUrl,
    garmentImageUrl: targetPublicUrl,
    feature: 'hoan-doi-khuon-mat',
  })
  if (!historyItem) return { error: 'Không thể khởi tạo phiên xử lý.' }

  const { apiKey } = await requireGoogleApiKeyForUser(user.id)
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-3-pro-image-preview',
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { imageSize: imageQuality, aspectRatio },
    },
  } as Parameters<GoogleGenerativeAI['getGenerativeModel']>[0])
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

      const croppedSourceFace = await extractFaceFromSourceImage(faceBuffer, user.id)
      if (!croppedSourceFace) {
        await deleteTryOnHistoryRowAndStorage(historyItem.id)
        return { error: 'Vision OCR không phát hiện được khuôn mặt rõ trên ảnh nguồn. Vui lòng chọn ảnh có 1 mặt rõ hơn.' }
      }
      console.log('[FaceSwap] Dùng ảnh mặt đã cắt từ nguồn bằng Vision')

      const targetFace = await detectFaceInTargetImage(targetBuffer)
      if (!targetFace) {
        await deleteTryOnHistoryRowAndStorage(historyItem.id)
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

      const croppedLeftFace = await extractFaceFromSourceImage(faceBufferLeft, user.id)
      const croppedRightFace = await extractFaceFromSourceImage(faceBufferRight, user.id)
      if (!croppedLeftFace) {
        await deleteTryOnHistoryRowAndStorage(historyItem.id)
        return { error: 'Vision OCR không phát hiện mặt trong ảnh nguồn bên trái. Vui lòng chọn ảnh rõ mặt hơn.' }
      }
      if (!croppedRightFace) {
        await deleteTryOnHistoryRowAndStorage(historyItem.id)
        return { error: 'Vision OCR không phát hiện mặt trong ảnh nguồn bên phải. Vui lòng chọn ảnh rõ mặt hơn.' }
      }

      const targetFaces = await detectFacesInTargetImage(targetBuffer, 2, user.id)
      if (targetFaces.length < 2) {
        await deleteTryOnHistoryRowAndStorage(historyItem.id)
        return { error: 'Ảnh đích không nhận đủ 2 khuôn mặt (trái/phải). Vui lòng chọn ảnh có 2 người rõ mặt.' }
      }

      let targetWithoutFaces: Buffer = targetBuffer
      targetWithoutFaces = (await removeFaceRegionLocal(targetWithoutFaces, targetFaces[0])) as Buffer
      targetWithoutFaces = (await removeFaceRegionLocal(targetWithoutFaces, targetFaces[1])) as Buffer
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

    const genResult = await model.generateContent(contentParts as never, { safetySettings } as never)
    const response = genResult.response
    logGeminiResponse('single_call_vision_local', genResult)
    trackFromUsageMetadata(response.usageMetadata, 'gemini-3-pro-image-preview', 'hoan-doi-khuon-mat', user.id, imageQuality)
    const imagePartRes = response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
    if (!imagePartRes || !('inlineData' in imagePartRes)) {
      const reason = response.candidates?.[0]?.finishReason ?? response.promptFeedback?.blockReason ?? 'unknown'
      console.warn('[FaceSwap] Single call thất bại, finishReason:', reason)
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      if (String(reason).toUpperCase().includes('IMAGE_SAFETY')) {
        return { error: 'Ảnh bị bộ lọc an toàn từ chối. Vui lòng đổi ảnh khác (ít nhạy cảm hơn) và thử lại.' }
      }
      return { error: `AI không trả về ảnh hợp lệ (${reason}). Thử ảnh khác.` }
    }
    const swapInline = imagePartRes.inlineData
    if (!swapInline?.data) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: 'AI không trả về ảnh hợp lệ (thiếu dữ liệu ảnh).' }
    }
    const resultBuffer = Buffer.from(swapInline.data, 'base64')

    const resultPath = `results/${user.id}/faceswap_${Date.now()}.png`
    const { publicUrl: resultPublicUrl } = await uploadTryOnImagePublic(resultPath, resultBuffer, {
      contentType: 'image/png',
      upsert: true,
    })

    const d = await deductUserCredits(user.id, COST)
    if (!d.ok) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: d.code === 'INSUFFICIENT_CREDITS' ? 'Không đủ credits để hoàn tất.' : d.error }
    }
    await updateTryOnHistoryCompletedPg(historyItem.id, resultPublicUrl)

    revalidatePath('/hoan-doi-khuon-mat')
    revalidatePath('/dashboard/history')
    return { success: true, resultUrl: resultPublicUrl }
  } catch (e) {
    await deleteTryOnHistoryRowAndStorage(historyItem.id)
    const msg = e instanceof Error ? e.message : String(e)
    const stack = e instanceof Error ? e.stack : undefined
    console.error('[FaceSwap] Lỗi:', msg, stack ? `\n${stack}` : '')
    if (/500|Internal Server Error|Internal error/i.test(msg)) {
      return { error: 'Hệ thống quá tải. Bạn có thể chọn 2K hoặc thử lại sau ít phút.' }
    }
    return { error: `Hoán đổi khuôn mặt thất bại: ${msg}` }
  }
}
