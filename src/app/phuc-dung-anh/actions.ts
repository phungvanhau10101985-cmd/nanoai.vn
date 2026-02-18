'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { normalizeToEnglish } from '@/lib/ai-normalize'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'

const RESTORE_COSTS = { '2K': 4, '4K': 8 } as const
const toTenths = (value: number) => Math.round(value * 10)
const fromTenths = (value: number) => value / 10
const formatCredits = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

const PROMPTS = {
  original: `Phục dựng ảnh này. Yêu cầu độ chính xác cao về gương mặt và thần thái; giữ tối đa những gì đúng với ảnh gốc. Sửa mờ, xước, hư hại và nâng chất lượng. Giữ nguyên đường nét, nội dung và bố cục gốc. Giữ nguyên tông màu gốc, không đổi màu. Mặc định: người trong ảnh là người Việt Nam nếu không có chỉ định khác. Chỉ trả về ảnh kết quả, không chèn chữ.`,
  colorize: `Phục dựng ảnh này. Yêu cầu độ chính xác cao về gương mặt và thần thái; giữ tối đa những gì đúng với ảnh gốc. Sửa mờ, xước, hư hại và nâng chất lượng. Giữ nguyên đường nét, nội dung và bố cục gốc. Tô màu tự nhiên, chân thực. Mặc định: người trong ảnh là người Việt Nam nếu không có chỉ định khác. Chỉ trả về ảnh kết quả, không chèn chữ.`,
}

const PERSON_LABELS: Record<number, string[]> = {
  1: ['người trong ảnh'],
  2: ['người bên trái', 'người bên phải'],
  3: ['người bên trái', 'người ở giữa', 'người bên phải'],
  4: ['người thứ 1 (từ trái)', 'người thứ 2', 'người thứ 3', 'người thứ 4'],
  5: ['người thứ 1 (từ trái)', 'người thứ 2', 'người thứ 3', 'người thứ 4', 'người thứ 5'],
}

/** Phục dựng ảnh: sửa ảnh cũ/mờ, tăng chất lượng. 2K: 4 credit, 4K: 8 credit. */
export async function restoreImage(formData: FormData) {
  if (!formData || typeof formData.get !== 'function') {
    return { error: 'Dữ liệu không hợp lệ. Vui lòng thử lại.' }
  }
  const image = formData.get('image') as File
  const colorMode = (formData.get('colorMode') as 'original' | 'colorize') || 'original'
  const imageQuality = (formData.get('imageQuality') as '2K' | '4K') || '2K'
  const note = (formData.get('note') as string)?.trim() || ''
  if (!image || image.size === 0) return { error: 'Cần tải lên ít nhất một ảnh.' }

  const RESTORE_COST = RESTORE_COSTS[imageQuality]

  const supabase = createClient()
  const adminSupabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const result = await getUserForAction(() => supabase.auth.getUser())
  if ('error' in result) return { error: result.error }
  const { user } = result

  const { data: creditData, error: creditError } = await supabase.from('credits').select('balance').eq('user_id', user.id).single()
  if (creditError || !creditData || toTenths(creditData.balance) < toTenths(RESTORE_COST)) {
    return { error: `Không đủ credits. Cần ${formatCredits(RESTORE_COST)} credits, hiện có ${formatCredits(creditData?.balance || 0)}.` }
  }

  const timestamp = Date.now()
  const path = `uploads/${user.id}/restore_${timestamp}.png`
  await supabase.storage.from('try-on-images').upload(path, image)
  const { data: origUrl } = supabase.storage.from('try-on-images').getPublicUrl(path)
  const { data: historyItem, error: historyError } = await supabase.from('try_on_history').insert({
    user_id: user.id,
    original_image_url: origUrl.publicUrl,
    garment_image_url: origUrl.publicUrl,
    status: 'processing',
  }).select().single()
  if (historyError || !historyItem) return { error: 'Không thể khởi tạo phiên xử lý.' }

  let prompt = PROMPTS[colorMode] ?? PROMPTS.original
  const personCount = Math.min(5, Math.max(1, parseInt(String(formData.get('personCount') || '1'), 10) || 1))
  const labels = PERSON_LABELS[personCount] || PERSON_LABELS[1]
  const personDescriptions: string[] = []
  for (let i = 0; i < personCount; i++) {
    const gender = (formData.get(`person_${i}_gender`) as string)?.trim() || ''
    const age = (formData.get(`person_${i}_age`) as string)?.trim() || ''
    const extra = (formData.get(`person_${i}_extra`) as string)?.trim() || ''
    if (gender || age || extra) {
      const parts: string[] = [labels[i]]
      if (age) parts.push(`${age} tuổi`)
      if (gender) parts.push(`giới tính ${gender}`)
      if (extra) parts.push(extra)
      personDescriptions.push(parts.join(' '))
    }
  }
  const personDescEn = personDescriptions.length ? await normalizeToEnglish(personDescriptions.join('. ')) : ''
  const noteEn = note ? await normalizeToEnglish(note) : ''
  if (personDescEn) {
    prompt = prompt.replace('Chỉ trả về ảnh kết quả, không chèn chữ.', `MÔ TẢ NHÂN VẬT: ${personDescEn}. Chỉ trả về ảnh kết quả, không chèn chữ.`)
  }
  if (noteEn) {
    prompt = prompt.replace(
      'Chỉ trả về ảnh kết quả, không chèn chữ.',
      `YÊU CẦU ẢNH (nền, chữ chèn, yêu cầu khác - KHÔNG phải mô tả người trong ảnh): "${noteEn}". Nếu người dùng muốn có chữ trên ảnh, hãy hiểu đúng ý nghĩa và viết phù hợp, không dán ký tự thô. Chỉ trả về ảnh kết quả, không chèn chữ.`
    )
  }

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
    trackFromUsageMetadata(response.usageMetadata, 'gemini-3-pro-image-preview', 'phuc-dung-anh', user.id, imageQuality)
    const imagePartRes = response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
    if (!imagePartRes || !('inlineData' in imagePartRes)) {
      await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
      return { error: 'AI không trả về ảnh hợp lệ.' }
    }
    const resultBuffer = Buffer.from(imagePartRes.inlineData.data, 'base64')
    const resultPath = `results/${user.id}/restore_${Date.now()}.png`
    await adminSupabase.storage.from('try-on-images').upload(resultPath, resultBuffer, { contentType: 'image/png', upsert: true })
    const { data: urlData } = adminSupabase.storage.from('try-on-images').getPublicUrl(resultPath)

    const { data: latestCredit } = await adminSupabase.from('credits').select('balance').eq('user_id', user.id).single()
    if (!latestCredit || toTenths(latestCredit.balance) < toTenths(RESTORE_COST)) {
      await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
      return { error: 'Không đủ credits để hoàn tất.' }
    }
    const newBalance = fromTenths(toTenths(latestCredit.balance) - toTenths(RESTORE_COST))
    await adminSupabase.from('credits').update({ balance: newBalance }).eq('user_id', user.id)
    await adminSupabase.from('try_on_history').update({ result_image_url: urlData.publicUrl, status: 'completed' }).eq('id', historyItem.id)

    revalidatePath('/phuc-dung-anh')
    revalidatePath('/dashboard/history')
    return { success: true, resultUrl: urlData.publicUrl }
  } catch (e) {
    await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
    const msg = e instanceof Error ? e.message : String(e)
    if (/500|Internal Server Error|Internal error/i.test(msg)) {
      return { error: 'Hệ thống quá tải. Bạn có thể chọn 2K hoặc thử lại sau ít phút.' }
    }
    return { error: `Phục dựng ảnh thất bại: ${msg}` }
  }
}
