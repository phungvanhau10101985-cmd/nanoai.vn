'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import { buildTransparentPngFromMask } from '@/lib/mask-to-transparent'

const REMOVE_BG_COSTS = { '2K': 1.5, '4K': 3 } as const
const toTenths = (value: number) => Math.round(value * 10)
const fromTenths = (value: number) => value / 10
const formatCredits = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

const MASK_PROMPT = `Create a precise foreground segmentation mask for this image.
Return ONLY one grayscale mask image:
- White = subject to KEEP.
- Black = background to REMOVE.
- Preserve fine details (hair, fur, transparent edges) with smooth anti-aliased boundaries.
- No color, no text, no extra graphics, no additional objects.`

export async function removeBackgroundToTransparentPng(formData: FormData) {
  if (!formData || typeof formData.get !== 'function') {
    return { error: 'Dữ liệu không hợp lệ. Vui lòng thử lại.' }
  }
  const image = formData.get('image') as File
  const imageQuality = (formData.get('imageQuality') as '2K' | '4K') || '2K'
  if (!image || image.size === 0) return { error: 'Cần tải lên ít nhất một ảnh.' }

  const COST = REMOVE_BG_COSTS[imageQuality]
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
  const uploadPath = `uploads/${user.id}/remove_bg_${timestamp}.png`
  await supabase.storage.from('try-on-images').upload(uploadPath, image)
  const { data: origUrl } = supabase.storage.from('try-on-images').getPublicUrl(uploadPath)
  const { data: historyItem, error: historyError } = await supabase.from('try_on_history').insert({
    user_id: user.id,
    original_image_url: origUrl.publicUrl,
    garment_image_url: origUrl.publicUrl,
    status: 'processing',
    feature: 'xoa-nen-png',
  }).select().single()
  if (historyError || !historyItem) return { error: 'Không thể khởi tạo phiên xử lý.' }

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)
  const model = genAI.getGenerativeModel({
    model: 'gemini-3-pro-image-preview',
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { imageSize: imageQuality },
    },
  })

  const inputBuffer = Buffer.from(await image.arrayBuffer())
  const imagePart = { inlineData: { data: inputBuffer.toString('base64'), mimeType: image.type || 'image/png' } }
  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  ]

  try {
    const gemResult = await model.generateContent([MASK_PROMPT, imagePart], { safetySettings })
    const response = gemResult.response
    trackFromUsageMetadata(response.usageMetadata, 'gemini-3-pro-image-preview', 'xoa-nen-png', user.id, imageQuality)

    const maskPart = response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
    if (!maskPart || !('inlineData' in maskPart)) {
      await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
      return { error: 'AI không trả về ảnh mask hợp lệ.' }
    }

    const maskBuffer = Buffer.from(maskPart.inlineData.data, 'base64')
    const transparentPngBuffer = await buildTransparentPngFromMask(inputBuffer, maskBuffer)

    const resultPath = `results/${user.id}/remove_bg_${Date.now()}.png`
    await adminSupabase.storage.from('try-on-images').upload(resultPath, transparentPngBuffer, { contentType: 'image/png', upsert: true })
    const { data: urlData } = adminSupabase.storage.from('try-on-images').getPublicUrl(resultPath)

    const { data: latestCredit } = await adminSupabase.from('credits').select('balance').eq('user_id', user.id).single()
    if (!latestCredit || toTenths(latestCredit.balance) < toTenths(COST)) {
      await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
      return { error: 'Không đủ credits để hoàn tất.' }
    }
    const newBalance = fromTenths(toTenths(latestCredit.balance) - toTenths(COST))
    await adminSupabase.from('credits').update({ balance: newBalance }).eq('user_id', user.id)
    await adminSupabase.from('try_on_history').update({ result_image_url: urlData.publicUrl, status: 'completed' }).eq('id', historyItem.id)

    revalidatePath('/xoa-nen-png')
    revalidatePath('/dashboard/history')
    return { success: true, resultUrl: urlData.publicUrl }
  } catch (e) {
    await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
    const msg = e instanceof Error ? e.message : String(e)
    if (/500|Internal Server Error|Internal error/i.test(msg)) {
      return { error: 'Hệ thống quá tải. Bạn có thể chọn 2K hoặc thử lại sau ít phút.' }
    }
    return { error: `Xóa nền PNG thất bại: ${msg}` }
  }
}
