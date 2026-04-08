'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'
import { revalidatePath } from 'next/cache'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { normalizeToEnglish } from '@/lib/ai-normalize'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'

const CHE_ANH_COSTS = { '2K': 1.5, '4K': 3 } as const
const toTenths = (value: number) => Math.round(value * 10)
const fromTenths = (value: number) => value / 10
const formatCredits = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

const PROMPT_BASE = `Chỉnh sửa các ảnh này theo yêu cầu. Có thể sáng tạo biến thể nhưng vẫn giữ đúng nhận diện chủ thể. Chỉ trả về ảnh kết quả, không chèn chữ.`

const MEME_STYLE_PROMPTS: Record<string, string> = {
  cam_xuc: 'Emotional meme style: Crying, laughing, surprised, smug smile, "haha".',
  dong_vat: 'Animal meme style: Dogs, cats (Corgi, Husky, Shiba, blep cat, loading).',
  nhan_vat: 'Character meme style: Anime, cartoon (Pikachu, Tom & Jerry, Doraemon), celebrities (Obama, The Rock, Messi).',
  phan_ung: 'Reaction meme style: For commenting, replying to messages.',
  deep_dark: 'Deep/dark meme style: Biting satire, contemplative, not for the faint of heart.',
  kho_hieu: 'Confusing meme style (absurd): Looks nonsensical but gets funnier the more you look.',
  ve_tay: 'Hand-drawn meme style: Sketchy lines, digital, amateur but extremely sharp satire.',
  co_dien: 'Classic meme style: LOLcats, Condescending Wonka, Chuck Norris Facts, Gangnam Style.',
}

/** Chế ảnh: chỉnh sửa, biến tấu ảnh theo yêu cầu. 2K: 1,5 credit, 4K: 3 credit. Tối đa 13 ảnh. */
export async function cheAnh(formData: FormData) {
  if (!formData || typeof formData.get !== 'function') {
    return { error: 'Dữ liệu không hợp lệ. Vui lòng thử lại.' }
  }
  const memeStyle = (formData.get('memeStyle') as string)?.trim() || ''
  const imageQuality = (formData.get('imageQuality') as '2K' | '4K') || '2K'
  const note = (formData.get('note') as string)?.trim() || ''
  const images: File[] = []
  const imageNotes: string[] = []
  let i = 0
  while (true) {
    const img = formData.get(`image_${i}`) as File | null
    if (!img || img.size === 0) break
    images.push(img)
    const imgNote = (formData.get(`image_${i}_note`) as string)?.trim() || ''
    imageNotes.push(imgNote)
    i++
  }
  if (images.length === 0) return { error: 'Cần tải lên ít nhất một ảnh.' }
  if (!memeStyle) return { error: 'Vui lòng chọn phong cách meme.' }

  const noteEn = note ? await normalizeToEnglish(note) : ''
  const perImageNotesEn = await Promise.all(imageNotes.map((n) => (n ? normalizeToEnglish(n) : '')))
  let promptExtras = ''
  if (memeStyle && MEME_STYLE_PROMPTS[memeStyle]) {
    promptExtras += `${MEME_STYLE_PROMPTS[memeStyle]} `
  }
  if (noteEn) promptExtras += `COMMON REQUEST FOR ALL IMAGES: "${noteEn}". `
  const perImageParts = perImageNotesEn
    .map((n, idx) => (n ? `Image ${idx + 1}: ${n}` : null))
    .filter(Boolean)
  if (perImageParts.length) promptExtras += `PER-IMAGE NOTES: ${perImageParts.join('. ')}. `
  const prompt = PROMPT_BASE.replace('Chỉ trả về ảnh kết quả, không chèn chữ.', `${promptExtras}Chỉ trả về ảnh kết quả, không chèn chữ.`)

  const COST = CHE_ANH_COSTS[imageQuality]

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
  const path = `uploads/${user.id}/che_${timestamp}.png`
  const { publicUrl: originalPublicUrl } = await uploadTryOnImagePublic(supabase, path, images[0], {
    contentType: images[0].type || 'image/png',
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
  } as Parameters<GoogleGenerativeAI['getGenerativeModel']>[0])
  const contentParts = await Promise.all([
    { text: prompt },
    ...images.map(async (img) => ({
      inlineData: { data: Buffer.from(await img.arrayBuffer()).toString('base64'), mimeType: img.type },
    })),
  ])
  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  ]

  try {
    const result = await model.generateContent(contentParts, { safetySettings } as never)
    const response = result.response
    trackFromUsageMetadata(response.usageMetadata, 'gemini-3-pro-image-preview', 'che-anh', user.id, imageQuality)
    const imagePartRes = response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
    if (!imagePartRes || !('inlineData' in imagePartRes)) {
      await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
      return { error: 'AI không trả về ảnh hợp lệ.' }
    }
    const inlineData = imagePartRes.inlineData
    if (!inlineData?.data) {
      await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
      return { error: 'AI không trả về ảnh hợp lệ.' }
    }
    const resultBuffer = Buffer.from(inlineData.data, 'base64')
    const resultPath = `results/${user.id}/che_${Date.now()}.png`
    const { publicUrl: resultPublicUrl } = await uploadTryOnImagePublic(
      adminSupabase,
      resultPath,
      resultBuffer,
      { contentType: 'image/png', upsert: true }
    )

    const { data: latestCredit } = await adminSupabase.from('credits').select('balance').eq('user_id', user.id).single()
    if (!latestCredit || toTenths(latestCredit.balance) < toTenths(COST)) {
      await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
      return { error: 'Không đủ credits để hoàn tất.' }
    }
    const newBalance = fromTenths(toTenths(latestCredit.balance) - toTenths(COST))
    await adminSupabase.from('credits').update({ balance: newBalance }).eq('user_id', user.id)
    await adminSupabase.from('try_on_history').update({ result_image_url: resultPublicUrl, status: 'completed' }).eq('id', historyItem.id)

    revalidatePath('/che-anh')
    revalidatePath('/dashboard/history')
    return { success: true, resultUrl: resultPublicUrl }
  } catch (e) {
    await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
    const msg = e instanceof Error ? e.message : String(e)
    if (/500|Internal Server Error|Internal error/i.test(msg)) {
      return { error: 'Hệ thống quá tải. Bạn có thể chọn 2K hoặc thử lại sau ít phút.' }
    }
    return { error: `Chế ảnh thất bại: ${msg}` }
  }
}
