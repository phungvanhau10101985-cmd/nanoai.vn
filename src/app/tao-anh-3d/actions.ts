'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { normalizeToEnglish } from '@/lib/ai-normalize'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'

const MOCKUP_COSTS = { '2K': 1.5, '4K': 3 } as const

const SAMPLE_PRODUCTS = [
  { id: 'phone', label: 'Điện thoại', url: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800' },
  { id: 'cup', label: 'Cốc/Tumbler', url: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=800' },
  { id: 'box', label: 'Hộp sản phẩm', url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800' },
  { id: 'bag', label: 'Túi vải', url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800' },
  { id: 'bottle', label: 'Chai nước', url: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800' },
]

const toTenths = (value: number) => Math.round(value * 10)
const fromTenths = (value: number) => value / 10
const formatCredits = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

const PROMPT_BASE = `Create professional 3D mockup: You receive TWO images.
- IMAGE 1: Product photo (phone, cup, box, bag, shirt, etc.) – the base product.
- IMAGE 2: Logo or brand design – to print/overlay onto the product surface.

Task: Place the logo/design from IMAGE 2 onto the product from IMAGE 1. The design must wrap correctly on the product surface, natural proportions, realistic 3D lighting and perspective. Result like a real product mockup photo. Return only the result image, no text overlay.`

/** Tạo ảnh 3D Mockup. Ảnh 1 = sản phẩm (hoặc mẫu), Ảnh 2 = logo in lên. 2K: 1,5 credit, 4K: 3 credit. */
export async function create3DMockup(formData: FormData) {
  if (!formData || typeof formData.get !== 'function') {
    return { error: 'Dữ liệu không hợp lệ. Vui lòng thử lại.' }
  }
  const productImage = formData.get('productImage') as File | null
  const logoImage = formData.get('logoImage') as File
  const useSample = (formData.get('useSample') as string) === 'true'
  const sampleId = (formData.get('sampleId') as string)?.trim() || ''
  const imageQuality = (formData.get('imageQuality') as '2K' | '4K') || '2K'
  const note = (formData.get('note') as string)?.trim() || ''

  if (!logoImage || logoImage.size === 0) return { error: 'Cần tải lên ảnh logo/thương hiệu (Ảnh 2) để in lên sản phẩm.' }
  if (!useSample && (!productImage || productImage.size === 0)) {
    return { error: 'Cần tải ảnh sản phẩm (Ảnh 1) hoặc chọn mẫu.' }
  }

  const noteEn = note ? await normalizeToEnglish(note) : ''
  let prompt = PROMPT_BASE
  if (noteEn) {
    prompt = prompt.replace('Return only the result image, no text overlay.', `REQUEST: "${noteEn}". Return only the result image, no text overlay.`)
  }

  const COST = MOCKUP_COSTS[imageQuality]
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
  const logoPath = `uploads/${user.id}/mockup3d_logo_${timestamp}.png`
  await supabase.storage.from('try-on-images').upload(logoPath, logoImage)
  const { data: logoUrlData } = supabase.storage.from('try-on-images').getPublicUrl(logoPath)

  let productImagePart: { inlineData: { data: string; mimeType: string } }
  if (useSample && sampleId) {
    const sampleUrl = SAMPLE_PRODUCTS.find((s) => s.id === sampleId)?.url
    if (!sampleUrl) return { error: 'Mẫu không hợp lệ.' }
    const res = await fetch(sampleUrl)
    if (!res.ok) return { error: 'Không tải được ảnh mẫu.' }
    const buf = Buffer.from(await res.arrayBuffer())
    productImagePart = { inlineData: { data: buf.toString('base64'), mimeType: 'image/png' } }
  } else if (productImage?.size) {
    const buf = Buffer.from(await productImage.arrayBuffer())
    productImagePart = { inlineData: { data: buf.toString('base64'), mimeType: productImage.type } }
  } else {
    return { error: 'Cần ảnh sản phẩm hoặc chọn mẫu.' }
  }

  const { data: historyItem, error: historyError } = await supabase.from('try_on_history').insert({
    user_id: user.id,
    original_image_url: logoUrlData.publicUrl,
    garment_image_url: logoUrlData.publicUrl,
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
  const logoBuffer = Buffer.from(await logoImage.arrayBuffer())
  const logoImagePart = { inlineData: { data: logoBuffer.toString('base64'), mimeType: logoImage.type } }
  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  ]

  try {
    const result = await model.generateContent(
      [prompt, productImagePart, logoImagePart],
      { safetySettings }
    )
    const response = result.response
    trackFromUsageMetadata(response.usageMetadata, 'gemini-3-pro-image-preview', 'tao-anh-3d', user.id, imageQuality)
    const imagePartRes = response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
    if (!imagePartRes || !('inlineData' in imagePartRes)) {
      await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
      return { error: 'AI không trả về ảnh hợp lệ.' }
    }
    const resultBuffer = Buffer.from(imagePartRes.inlineData.data, 'base64')
    const resultPath = `results/${user.id}/mockup3d_${Date.now()}.png`
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

    revalidatePath('/tao-anh-3d')
    revalidatePath('/dashboard/history')
    return { success: true, resultUrl: urlData.publicUrl }
  } catch (e) {
    await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
    const msg = e instanceof Error ? e.message : String(e)
    if (/500|Internal Server Error|Internal error/i.test(msg)) {
      return { error: 'Hệ thống quá tải. Bạn có thể chọn 2K hoặc thử lại sau ít phút.' }
    }
    return { error: `Tạo mockup 3D thất bại: ${msg}` }
  }
}
