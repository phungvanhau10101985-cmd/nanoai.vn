'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { normalizeToEnglish } from '@/lib/ai-normalize'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'

const BEAUTIFY_COSTS = { '2K': 1.5, '4K': 3 } as const
const toTenths = (value: number) => Math.round(value * 10)
const fromTenths = (value: number) => value / 10
const formatCredits = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

const PERSON_LABELS: Record<number, string[]> = {
  1: ['người trong ảnh'],
  2: ['người bên TRÁI', 'người bên PHẢI'],
  3: ['người bên TRÁI', 'người ở GIỮA', 'người bên PHẢI'],
  4: ['người 1 (ngoài cùng bên trái)', 'người 2', 'người 3', 'người 4 (ngoài cùng bên phải)'],
}

const MALE_RETOUCH = `Phong cách NAM: làm mịn da nhẹ nhàng, giảm mụn/vết không đều màu/bóng dầu. Giữ kết cấu da tự nhiên, giữ râu nếu có. Tôn nhẹ đường hàm. Làm sáng mắt vừa phải. KHÔNG làm mịn quá mức, vẫn giữ nét nam tính.`
const FEMALE_RETOUCH = `Phong cách NỮ: làm mịn da nhẹ, giảm mụn và quầng thâm. Da đều màu, mềm mại tự nhiên. Tăng độ nổi bật của mắt, màu môi tự nhiên. KHÔNG chỉnh sửa quá đà, tránh cảm giác giả.`
type BeautifyStyle = 'natural' | 'korean' | 'pro_sharp' | 'beauty_glow' | 'male_elegant' | 'female_soft' | 'mixed_group'
type BeautifyStrength = 'light' | 'medium' | 'strong'

const STYLE_PRESET_PROMPTS: Record<BeautifyStyle, string> = {
  natural: 'Phong cách tự nhiên: giữ nét thật, chỉ retouch vừa đủ để ảnh sạch và sáng hơn.',
  korean: 'Phong cách makeup nhẹ Hàn Quốc: da sáng trong, mịn tự nhiên, tông màu mềm, không quá đà.',
  pro_sharp: 'Phong cách sắc nét chuyên nghiệp: tăng độ nét khuôn mặt và ánh sáng studio, vẫn giữ tự nhiên.',
  beauty_glow: 'Phong cách beauty glow: da căng bóng nhẹ, ánh sáng mềm, tổng thể tươi tắn và cao cấp.',
  male_elegant: 'Phong cách nam lịch lãm: nhấn đường nét nam tính, da sạch khỏe, ánh sáng mạnh mẽ tinh gọn.',
  female_soft: 'Phong cách nữ mềm mại: da mịn tự nhiên, ánh sáng dịu, vẻ ngoài thanh lịch và nữ tính.',
  mixed_group: 'Phong cách nhóm nam + nữ: tối ưu từng người theo giới tính của họ trong cùng ảnh, tổng thể hài hòa và đồng nhất.',
}

const STRENGTH_PROMPTS: Record<BeautifyStrength, string> = {
  light: 'Mức độ nhẹ: ưu tiên tự nhiên, chỉnh sửa tối thiểu.',
  medium: 'Mức độ vừa: cân bằng giữa tự nhiên và độ nổi bật.',
  strong: 'Mức độ mạnh: tăng hiệu ứng rõ hơn nhưng vẫn phải giữ nhận diện thật.',
}

function hasMixedGenders(personGenders: ('male' | 'female')[]): boolean {
  const hasMale = personGenders.includes('male')
  const hasFemale = personGenders.includes('female')
  return hasMale && hasFemale
}

/** Prompt làm đẹp – hỗ trợ 1–4 người, mỗi người có giới tính riêng */
function buildBeautifyPrompt(
  personGenders: ('male' | 'female')[],
  noteEn: string,
  style: BeautifyStyle,
  strength: BeautifyStrength,
  backgroundBlurStrength: number
): string {
  const count = personGenders.length
  const labels = PERSON_LABELS[count] || PERSON_LABELS[1]
  const personInstructions = personGenders
    .map((g, i) => `${labels[i]}: ${g === 'female' ? FEMALE_RETOUCH : MALE_RETOUCH}`)
    .join('\n')
  const effectiveStyle = hasMixedGenders(personGenders) && (style === 'male_elegant' || style === 'female_soft')
    ? 'mixed_group'
    : style
  const stylePrompt = STYLE_PRESET_PROMPTS[effectiveStyle]
  const strengthPrompt = STRENGTH_PROMPTS[strength]

  const blurInstruction = backgroundBlurStrength <= 0
    ? 'KHÔNG xóa phông. Giữ nền gốc rõ nét hoàn toàn.'
    : `Chỉ xóa phông bằng làm mờ nền gốc ở mức ${backgroundBlurStrength}/100 (kiểu bokeh/gaussian/lens blur).`

  return `Làm đẹp chân dung chuyên nghiệp theo chất lượng studio. Kết quả phải giống ảnh chụp studio chuyên nghiệp.

SỐ NGƯỜI: ${count}. Hãy áp dụng chỉnh sửa cho TỪNG người theo giới tính bên dưới.
PHONG CÁCH ĐÃ CHỌN: ${stylePrompt}
MỨC ĐỘ: ${strengthPrompt}

CHI TIẾT TỪNG NGƯỜI (từ trái sang phải):
${personInstructions}

QUAN TRỌNG - GIỮ NGUYÊN NHẬN DIỆN KHUÔN MẶT:
- Mỗi khuôn mặt phải nhận ra đúng 100%. KHÔNG thay đổi cấu trúc, đặc điểm hay tỷ lệ khuôn mặt.
- Giữ độ nét và độ rõ của mọi khuôn mặt. KHÔNG làm mờ hoặc biến dạng.
- Vẫn là đúng những người trong ảnh, chỉ cải thiện ánh sáng, làn da và độ hoàn thiện tổng thể.

PHONG CÁCH STUDIO:
- Ánh sáng chuyên nghiệp: mềm, đều, tôn mọi khuôn mặt.
- Tổng thể hoàn thiện như ảnh nhóm đã được nhiếp ảnh gia chỉnh chuyên nghiệp.

RÀNG BUỘC NỀN (BẮT BUỘC):
- Giữ NGUYÊN nền gốc 100%: không thay nền, không xóa nền, không vẽ lại nền.
- Chỉ được phép xử lý nền theo hướng làm mờ/xóa phông (background blur), tuyệt đối không dùng inpaint/outpaint hay model tạo sinh để chỉnh nền.
- Bố cục, vật thể, màu sắc nền phải giữ như ảnh gốc; chỉ thay đổi độ mờ của nền.
- ${blurInstruction}

${noteEn ? `YÊU CẦU BỔ SUNG CỦA NGƯỜI DÙNG: "${noteEn}". ` : ''}Chỉ trả về ảnh kết quả, không chèn chữ.`
}

/** Làm đẹp ảnh. 2K: 1,5 credit, 4K: 3 credit. */
export async function beautifyImage(formData: FormData) {
  if (!formData || typeof formData.get !== 'function') {
    return { error: 'Dữ liệu không hợp lệ. Vui lòng thử lại.' }
  }
  const image = formData.get('image') as File
  const imageQuality = (formData.get('imageQuality') as '2K' | '4K') || '2K'
  const style = ((formData.get('beautifyStyle') as BeautifyStyle) || 'natural')
  const strength = ((formData.get('beautifyStrength') as BeautifyStrength) || 'medium')
  const backgroundBlurStrengthRaw = parseInt(String(formData.get('backgroundBlurStrength') || '35'), 10)
  const backgroundBlurStrength = Number.isFinite(backgroundBlurStrengthRaw)
    ? Math.min(100, Math.max(0, backgroundBlurStrengthRaw))
    : 35
  const personCount = Math.min(4, Math.max(1, parseInt(String(formData.get('personCount') || '1'), 10) || 1))
  const personGenders: ('male' | 'female')[] = []
  for (let i = 0; i < personCount; i++) {
    const g = (formData.get(`person_${i}_gender`) as string)?.trim() || 'female'
    personGenders.push(g === 'male' ? 'male' : 'female')
  }
  const note = (formData.get('note') as string)?.trim() || ''
  if (!image || image.size === 0) return { error: 'Cần tải lên ít nhất một ảnh.' }

  const noteEn = note ? await normalizeToEnglish(note) : ''
  const prompt = buildBeautifyPrompt(personGenders, noteEn, style, strength, backgroundBlurStrength)

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
  const { publicUrl: originalPublicUrl } = await uploadTryOnImagePublic(supabase, path, image, {
    contentType: image.type || 'image/png',
  })
  const { data: historyItem, error: historyError } = await supabase.from('try_on_history').insert({
    user_id: user.id,
    original_image_url: originalPublicUrl,
    garment_image_url: originalPublicUrl,
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
    const resultBuffer = Buffer.from((imagePartRes as { inlineData: { data: string } }).inlineData.data, 'base64')
    const resultPath = `results/${user.id}/beautify_${Date.now()}.png`
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

    revalidatePath('/lam-dep-anh')
    revalidatePath('/dashboard/history')
    return { success: true, resultUrl: resultPublicUrl }
  } catch (e) {
    await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
    const msg = e instanceof Error ? e.message : String(e)
    if (/500|Internal Server Error|Internal error/i.test(msg)) {
      return { error: 'Hệ thống quá tải. Bạn có thể chọn 2K hoặc thử lại sau ít phút.' }
    }
    return { error: `Làm đẹp ảnh thất bại: ${msg}` }
  }
}
