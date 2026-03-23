'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { normalizeToEnglish } from '@/lib/ai-normalize'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'

const COSTS = { '2K': 1.5, '4K': 3 } as const
const VALID_ASPECT_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'] as const
const MAX_PROMPT_LEN = 8000
const toTenths = (value: number) => Math.round(value * 10)
const fromTenths = (value: number) => value / 10
const formatCredits = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

const PROMPT_TEXT_ONLY = `You are an image generation assistant. Create ONE high-quality image that matches the user's text description. Follow lighting, style, and subject as described. Return only the generated image, no extra text.`

const REFERENCE_HINT = ` The user attached a reference image. Use it to guide overall style, color palette, composition, or subject resemblance when it helps, but the TEXT DESCRIPTION is the primary instruction—do not copy the reference blindly if it conflicts with the text.`

const VALID_IMAGE_STYLES = [
  'auto',
  'photorealistic',
  'anime',
  'illustration',
  '3d_render',
  'watercolor',
  'minimal_flat',
  'cinematic',
  'sketch',
  'pixel_art',
] as const

type ImageStyleId = (typeof VALID_IMAGE_STYLES)[number]

const STYLE_DIRECTIVES: Record<ImageStyleId, string> = {
  auto:
    'STYLE: Infer the best visual style from the user description. If they do not specify a style, use a polished, versatile look that fits the subject.',
  photorealistic:
    'STYLE (mandatory): Photorealistic rendering—natural materials, believable lighting, fine detail, no illustration outlines unless the scene demands it.',
  anime:
    'STYLE (mandatory): Anime/manga illustration—clean linework, appealing cel or soft shading, coherent character design if people appear.',
  illustration:
    'STYLE (mandatory): Digital illustration or concept-art look—expressive brushwork or clean stylized shapes as fits the subject; not a raw photo.',
  '3d_render':
    'STYLE (mandatory): High-quality 3D CGI render—believable materials, studio or environmental lighting, subtle depth of field if appropriate.',
  watercolor:
    'STYLE (mandatory): Watercolor or soft traditional painting—organic edges, paper texture feel, gentle color bleeding.',
  minimal_flat:
    'STYLE (mandatory): Minimal flat design—simple bold shapes, limited harmonious palette, modern poster or UI-adjacent clarity.',
  cinematic:
    'STYLE (mandatory): Cinematic framing and mood—dramatic or film-like lighting, cohesive color grading, strong composition.',
  sketch:
    'STYLE (mandatory): Hand-drawn sketch—pencil or charcoal feel, visible strokes, optional light paper texture.',
  pixel_art:
    'STYLE (mandatory): Pixel art—clear pixel grid, limited palette, retro game aesthetic, readable at low resolution.',
}

/** Tạo ảnh từ mô tả chữ; có thể kèm 1 ảnh tham khảo. 2K: 1,5 credit, 4K: 3 credit. */
export async function createImageFromText(formData: FormData) {
  if (!formData || typeof formData.get !== 'function') {
    return { error: 'Dữ liệu không hợp lệ. Vui lòng thử lại.' }
  }
  const rawPrompt = (formData.get('prompt') as string)?.trim() || ''
  if (rawPrompt.length < 3) {
    return { error: 'Vui lòng nhập mô tả ảnh (ít nhất vài ký tự).' }
  }
  if (rawPrompt.length > MAX_PROMPT_LEN) {
    return { error: `Mô tả quá dài (tối đa ${MAX_PROMPT_LEN} ký tự).` }
  }

  const imageQuality = (formData.get('imageQuality') as '2K' | '4K') || '2K'
  const aspectRatioRaw = (formData.get('aspectRatio') as string)?.trim() || '1:1'
  const aspectRatio = VALID_ASPECT_RATIOS.includes(aspectRatioRaw as (typeof VALID_ASPECT_RATIOS)[number])
    ? aspectRatioRaw
    : '1:1'

  const styleRaw = (formData.get('imageStyle') as string)?.trim() || 'auto'
  const imageStyle: ImageStyleId = VALID_IMAGE_STYLES.includes(styleRaw as ImageStyleId)
    ? (styleRaw as ImageStyleId)
    : 'auto'

  const ref = formData.get('referenceImage') as File | null
  const hasRef = (ref?.size ?? 0) > 0
  if (hasRef && ref && !ref.type.startsWith('image/')) {
    return { error: 'Ảnh tham khảo phải là file ảnh hợp lệ.' }
  }

  const COST = COSTS[imageQuality]

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
  const uploadPath = hasRef && ref ? `uploads/${user.id}/text2img_ref_${timestamp}.png` : null
  if (hasRef && ref && uploadPath) {
    await supabase.storage.from('try-on-images').upload(uploadPath, ref)
  }
  const { data: origUrl } = supabase.storage.from('try-on-images').getPublicUrl(uploadPath || `uploads/${user.id}/text2img_placeholder_${timestamp}`)
  const { data: historyItem, error: historyError } = await supabase.from('try_on_history').insert({
    user_id: user.id,
    original_image_url: origUrl.publicUrl,
    garment_image_url: origUrl.publicUrl,
    status: 'processing',
  }).select().single()
  if (historyError || !historyItem) return { error: 'Không thể khởi tạo phiên xử lý.' }

  const promptEn = await normalizeToEnglish(rawPrompt)
  const styleBlock = `\n\n${STYLE_DIRECTIVES[imageStyle]}`
  let instruction =
    PROMPT_TEXT_ONLY + (hasRef ? REFERENCE_HINT : '') + styleBlock + `\n\nUSER DESCRIPTION:\n${promptEn}`

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

  const contentParts: (string | object)[] = [instruction]
  if (hasRef && ref) {
    const buffer = Buffer.from(await ref.arrayBuffer())
    contentParts.push({ inlineData: { data: buffer.toString('base64'), mimeType: ref.type || 'image/png' } })
  }

  try {
    const genResult = await model.generateContent(contentParts as never, { safetySettings } as never)
    const response = genResult.response
    trackFromUsageMetadata(response.usageMetadata, 'gemini-3-pro-image-preview', 'tao-anh-tu-chu', user.id, imageQuality)
    const imagePartRes = response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
    if (!imagePartRes || !('inlineData' in imagePartRes)) {
      await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
      return { error: 'AI không trả về ảnh hợp lệ.' }
    }
    const resultBuffer = Buffer.from((imagePartRes as { inlineData: { data: string } }).inlineData.data, 'base64')
    const resultPath = `results/${user.id}/text2img_${Date.now()}.png`
    await adminSupabase.storage.from('try-on-images').upload(resultPath, resultBuffer, { contentType: 'image/png', upsert: true })
    const { data: urlData } = adminSupabase.storage.from('try-on-images').getPublicUrl(resultPath)

    const { data: latestCredit } = await adminSupabase.from('credits').select('balance').eq('user_id', user.id).single()
    if (!latestCredit || toTenths(latestCredit.balance) < toTenths(COST)) {
      await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
      return { error: 'Không đủ credits để hoàn tất.' }
    }
    const newBalance = fromTenths(toTenths(latestCredit.balance) - toTenths(COST))
    await adminSupabase.from('credits').update({ balance: newBalance }).eq('user_id', user.id)
    await adminSupabase.from('try_on_history').update({
      result_image_url: urlData.publicUrl,
      status: 'completed',
      feature: 'tao-anh-tu-chu',
      aspect_ratio: aspectRatio,
    }).eq('id', historyItem.id)

    revalidatePath('/tao-anh-tu-chu')
    revalidatePath('/dashboard/history')
    return { success: true, resultUrl: urlData.publicUrl }
  } catch (e) {
    await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
    const msg = e instanceof Error ? e.message : String(e)
    if (/500|Internal Server Error|Internal error/i.test(msg)) {
      return { error: 'Hệ thống quá tải. Bạn có thể chọn 2K hoặc thử lại sau ít phút.' }
    }
    return { error: `Tạo ảnh thất bại: ${msg}` }
  }
}
