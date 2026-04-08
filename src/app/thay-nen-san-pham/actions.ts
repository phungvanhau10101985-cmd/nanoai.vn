'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'
import { revalidatePath } from 'next/cache'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { normalizeToEnglish } from '@/lib/ai-normalize'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'

const PRODUCT_COSTS = { '2K': 1.5, '4K': 3 } as const
const toTenths = (value: number) => Math.round(value * 10)
const fromTenths = (value: number) => value / 10
const formatCredits = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

const PROMPT_BASE = `Ảnh sản phẩm AI: tách sản phẩm khỏi nền gốc và đặt vào bối cảnh chuyên nghiệp. Sản phẩm phải giữ nguyên hình dạng, sắc nét. Nền mới cần phù hợp và đẹp (studio, bãi biển, phòng khách sang trọng...). Chỉ trả về ảnh kết quả, không chèn chữ.`

/** Thay nền sản phẩm. 2K: 1,5 credit, 4K: 3 credit. */
export async function replaceProductBackground(formData: FormData) {
  if (!formData || typeof formData.get !== 'function') {
    return { error: 'Dữ liệu không hợp lệ. Vui lòng thử lại.' }
  }
  const image = formData.get('image') as File
  const imageQuality = (formData.get('imageQuality') as '2K' | '4K') || '2K'
  const note = (formData.get('note') as string)?.trim() || ''
  if (!image || image.size === 0) return { error: 'Cần tải lên ít nhất một ảnh sản phẩm.' }

  const noteEn = note ? await normalizeToEnglish(note) : ''
  let prompt = PROMPT_BASE
  if (noteEn) {
    prompt = prompt.replace('Chỉ trả về ảnh kết quả, không chèn chữ.', `YÊU CẦU NỀN MỚI: "${noteEn}". Chỉ trả về ảnh kết quả, không chèn chữ.`)
  }

  const COST = PRODUCT_COSTS[imageQuality]
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
  const path = `uploads/${user.id}/product_${timestamp}.png`
  const { publicUrl: originalPublicUrl } = await uploadTryOnImagePublic(supabase, path, image, {
    contentType: image.type || 'image/png',
  })
  const { data: historyItem, error: historyError } = await supabase.from('try_on_history').insert({
    user_id: user.id,
    original_image_url: originalPublicUrl,
    garment_image_url: originalPublicUrl,
    status: 'processing',
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
  const buffer = Buffer.from(await image.arrayBuffer())
  const imagePart = { inlineData: { data: buffer.toString('base64'), mimeType: image.type } }
  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  ]

  try {
    const result = await model.generateContent([prompt, imagePart], { safetySettings })
    const response = result.response
    trackFromUsageMetadata(response.usageMetadata, 'gemini-3-pro-image-preview', 'thay-nen-san-pham', user.id, imageQuality)
    const imagePartRes = response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
    if (!imagePartRes || !('inlineData' in imagePartRes)) {
      await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
      return { error: 'AI không trả về ảnh hợp lệ.' }
    }
    const resultBuffer = Buffer.from((imagePartRes as { inlineData: { data: string } }).inlineData.data, 'base64')
    const resultPath = `results/${user.id}/product_${Date.now()}.png`
    const { publicUrl: resultPublicUrl } = await uploadTryOnImagePublic(adminSupabase, resultPath, resultBuffer, {
      contentType: 'image/png',
      upsert: true,
    })

    const { data: latestCredit } = await adminSupabase.from('credits').select('balance').eq('user_id', user.id).single()
    if (!latestCredit || toTenths(latestCredit.balance) < toTenths(COST)) {
      await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
      return { error: 'Không đủ credits để hoàn tất.' }
    }
    const newBalance = fromTenths(toTenths(latestCredit.balance) - toTenths(COST))
    await adminSupabase.from('credits').update({ balance: newBalance }).eq('user_id', user.id)
    await adminSupabase.from('try_on_history').update({ result_image_url: resultPublicUrl, status: 'completed' }).eq('id', historyItem.id)

    revalidatePath('/thay-nen-san-pham')
    revalidatePath('/dashboard/history')
    return { success: true, resultUrl: resultPublicUrl }
  } catch (e) {
    await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
    const msg = e instanceof Error ? e.message : String(e)
    if (/500|Internal Server Error|Internal error/i.test(msg)) {
      return { error: 'Hệ thống quá tải. Bạn có thể chọn 2K hoặc thử lại sau ít phút.' }
    }
    return { error: `Thay nền thất bại: ${msg}` }
  }
}
