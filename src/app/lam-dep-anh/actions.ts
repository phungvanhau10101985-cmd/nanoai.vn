'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { normalizeToEnglish } from '@/lib/ai-normalize'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'

const BEAUTIFY_COSTS = { '2K': 1.5, '4K': 3 } as const
const toTenths = (value: number) => Math.round(value * 10)
const fromTenths = (value: number) => value / 10
const formatCredits = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

const PERSON_LABELS: Record<number, string[]> = {
  1: ['person in the image'],
  2: ['person on the LEFT', 'person on the RIGHT'],
  3: ['person on the LEFT', 'person in the CENTER', 'person on the RIGHT'],
  4: ['person 1 (leftmost)', 'person 2', 'person 3', 'person 4 (rightmost)'],
}

const MALE_RETOUCH = `MALE style: Subtle skin smoothing – reduce blemishes, uneven tone, oil shine. Keep natural texture, stubble/beard if present. Enhance jawline subtly. Slightly brighten eyes. Do NOT over-smooth – maintain masculine character.`
const FEMALE_RETOUCH = `FEMALE style: Smooth skin gently – reduce blemishes, dark circles. Soft, even complexion. Enhance eyes, natural lip color. Do NOT over-retouch – avoid plastic look.`

/** Prompt làm đẹp – hỗ trợ 1–4 người, mỗi người có giới tính riêng */
function buildBeautifyPrompt(personGenders: ('male' | 'female')[], noteEn: string): string {
  const count = personGenders.length
  const labels = PERSON_LABELS[count] || PERSON_LABELS[1]
  const personInstructions = personGenders
    .map((g, i) => `${labels[i]}: ${g === 'female' ? FEMALE_RETOUCH : MALE_RETOUCH}`)
    .join('\n')

  return `Professional portrait beautification – studio-quality retouch. Output must look like a professional studio photo.

NUMBER OF PEOPLE: ${count}. Apply retouch to EACH person according to their gender below.

PERSON-BY-PERSON (left to right):
${personInstructions}

CRITICAL – PRESERVE ALL FACES:
- Keep EVERY face 100% recognizable. Do NOT change facial structure, features, or proportions.
- Maintain sharpness and clarity of all faces. Do NOT blur or distort.
- Same people, same faces – only improve lighting, skin, and overall polish per person.

STUDIO STYLE:
- Professional lighting: soft, even, flattering for all.
- Clean background or subtle enhancement if needed.
- Overall polish: like a professional photographer's retouched group portrait.

${noteEn ? `ADDITIONAL USER REQUEST: "${noteEn}". ` : ''}Return only the result image, no text overlay.`
}

/** Làm đẹp ảnh. 2K: 1,5 credit, 4K: 3 credit. */
export async function beautifyImage(formData: FormData) {
  if (!formData || typeof formData.get !== 'function') {
    return { error: 'Dữ liệu không hợp lệ. Vui lòng thử lại.' }
  }
  const image = formData.get('image') as File
  const imageQuality = (formData.get('imageQuality') as '2K' | '4K') || '2K'
  const personCount = Math.min(4, Math.max(1, parseInt(String(formData.get('personCount') || '1'), 10) || 1))
  const personGenders: ('male' | 'female')[] = []
  for (let i = 0; i < personCount; i++) {
    const g = (formData.get(`person_${i}_gender`) as string)?.trim() || 'female'
    personGenders.push(g === 'male' ? 'male' : 'female')
  }
  const note = (formData.get('note') as string)?.trim() || ''
  if (!image || image.size === 0) return { error: 'Cần tải lên ít nhất một ảnh.' }

  const noteEn = note ? await normalizeToEnglish(note) : ''
  const prompt = buildBeautifyPrompt(personGenders, noteEn)

  const COST = BEAUTIFY_COSTS[imageQuality]

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
  const path = `uploads/${user.id}/beautify_${timestamp}.png`
  await supabase.storage.from('try-on-images').upload(path, image)
  const { data: origUrl } = supabase.storage.from('try-on-images').getPublicUrl(path)
  const { data: historyItem, error: historyError } = await supabase.from('try_on_history').insert({
    user_id: user.id,
    original_image_url: origUrl.publicUrl,
    garment_image_url: origUrl.publicUrl,
    status: 'processing',
    feature: 'lam-dep-anh',
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
    trackFromUsageMetadata(response.usageMetadata, 'gemini-3-pro-image-preview', 'lam-dep-anh', user.id, imageQuality)
    const imagePartRes = response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
    if (!imagePartRes || !('inlineData' in imagePartRes)) {
      await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
      return { error: 'AI không trả về ảnh hợp lệ.' }
    }
    const resultBuffer = Buffer.from(imagePartRes.inlineData.data, 'base64')
    const resultPath = `results/${user.id}/beautify_${Date.now()}.png`
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

    revalidatePath('/lam-dep-anh')
    revalidatePath('/dashboard/history')
    return { success: true, resultUrl: urlData.publicUrl }
  } catch (e) {
    await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
    const msg = e instanceof Error ? e.message : String(e)
    if (/500|Internal Server Error|Internal error/i.test(msg)) {
      return { error: 'Hệ thống quá tải. Bạn có thể chọn 2K hoặc thử lại sau ít phút.' }
    }
    return { error: `Làm đẹp ảnh thất bại: ${msg}` }
  }
}
