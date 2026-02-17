'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'

const STORY_COSTS = { '2K': 3, '4K': 6 } as const
const VALID_ASPECT_RATIOS = ['1:1', '4:3', '3:4', '16:9', '9:16'] as const
const toTenths = (value: number) => Math.round(value * 10)
const fromTenths = (value: number) => value / 10
const formatCredits = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

const STORY_EXPANSION_PROMPT = `Bạn là nhà văn khoa học/giáo dục. Người dùng đưa ra một ý tưởng hoặc chủ đề ngắn gọn. Nhiệm vụ của bạn là viết một CÂU CHUYỆN DẪN DẮT hấp dẫn, ĐÚNG CHUẨN KHOA HỌC về chủ đề đó.

Quy tắc BẮT BUỘC:
- KHÔNG ĐƯỢC BỊA: Mọi thông tin khoa học, sự kiện, số liệu phải chính xác và dựa trên kiến thức đã được xác minh. KHÔNG tạo ra sự kiện, quy trình hay dữ liệu không có thật.
- Viết bằng TIẾNG VIỆT.
- Câu chuyện phải DẪN DẮT: giải thích vấn đề/chủ đề theo trình tự logic, ví dụ: sáng → trưa → chiều; hoặc bước 1 → 2 → 3; hoặc nguyên nhân → diễn biến → kết quả.
- Ví dụ quang hợp: dẫn dắt đúng quy trình: lá hấp thụ ánh sáng, nước, CO2 → tạo glucose và O2 → cây tích trữ năng lượng. KHÔNG thêm chi tiết sai lệch.
- Nội dung phải ĐÚNG CHUẨN KHOA HỌC, không chấp nhận sai lệch hay bịa đặt.
- Phong cách: trang sách thiếu nhi hoặc infographic giáo dục – rõ ràng, sinh động, dễ hình dung.
- Độ dài: 4–8 câu, mô tả cảnh, bối cảnh, màu sắc, các yếu tố hình ảnh chính.
- Chỉ xuất câu chuyện, không thêm lời bình luận.`

const PROMPT_BASE = `Tạo một bức tranh minh họa hoặc infographic SỐNG ĐỘNG, NHIỀU MÀU SẮC dựa trên câu chuyện tiếng Việt sau. Câu chuyện đã được kiểm chứng khoa học – minh họa CHÍNH XÁC nội dung đó, KHÔNG thêm chi tiết bịa đặt hay sai lệch.

Yêu cầu:
- Phong cách: trang sách thiếu nhi hoặc infographic giáo dục – rõ ràng, hấp dẫn, kể chuyện.
- Bức ảnh phải KỂ CÂU CHUYỆN: không chỉ là hình ảnh đơn lẻ mà là ảnh CÓ CÂU CHUYỆN bên trong – có thể dùng khung phân cảnh, nhãn chú thích, hoặc trình tự hình ảnh để dẫn dắt người xem.
- Minh họa ĐÚNG nội dung khoa học trong câu chuyện, không bịa thêm.
- Tất cả chữ trong ảnh phải là TIẾNG VIỆT (nhãn, chú thích, tiêu đề nếu có).
- Màu sắc tươi sáng, bố cục rõ ràng, dễ hiểu.
- Xuất ảnh kết quả.`

/** Kể chuyện bằng hình ảnh: khách đưa ý tưởng → Flash 2.5 viết câu chuyện → Gemini 3 Pro Image tạo ảnh. 2K: 3 credit, 4K: 6 credit. */
export async function createStoryImage(formData: FormData) {
  if (!formData || typeof formData.get !== 'function') {
    return { error: 'Dữ liệu không hợp lệ. Vui lòng thử lại.' }
  }
  const prompt = (formData.get('prompt') as string)?.trim() || ''
  const imageQuality = (formData.get('imageQuality') as '2K' | '4K') || '2K'
  const aspectRatioRaw = (formData.get('aspectRatio') as string)?.trim() || '4:3'
  const aspectRatio = VALID_ASPECT_RATIOS.includes(aspectRatioRaw as (typeof VALID_ASPECT_RATIOS)[number])
    ? aspectRatioRaw
    : '4:3'

  if (!prompt) {
    return { error: 'Vui lòng nhập ý tưởng hoặc chủ đề cần minh họa.' }
  }

  const COST = STORY_COSTS[imageQuality]

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

  const { data: historyItem, error: historyError } = await supabase.from('try_on_history').insert({
    user_id: user.id,
    original_image_url: '',
    garment_image_url: '',
    status: 'processing',
    feature: 'story',
  }).select().single()
  if (historyError || !historyItem) return { error: 'Không thể khởi tạo phiên xử lý.' }

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)

  // Bước 1: Gemini Flash 2.5 mở rộng ý tưởng thành câu chuyện dẫn dắt (tiếng Việt)
  const flashModel = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseModalities: ['TEXT'] },
  })
  const expansionResult = await flashModel.generateContent(
    `${STORY_EXPANSION_PROMPT}\n\nÝ TƯỞNG CỦA NGƯỜI DÙNG: "${prompt}"`
  )
  const expandedStory =
    (expansionResult.response.text?.() || '').trim() ||
    expansionResult.response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
    prompt

  // Bước 2: Gemini 3 Pro Image Preview tạo ảnh từ câu chuyện (ảnh có chữ tiếng Việt)
  const fullPrompt = `${PROMPT_BASE}\n\nCÂU CHUYỆN CẦN MINH HỌA:\n"${expandedStory}"`

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
    const result = await model.generateContent(fullPrompt, { safetySettings })
    const response = result.response
    trackFromUsageMetadata(response.usageMetadata, 'gemini-3-pro-image-preview', 'ke-chuyen-bang-hinh-anh', user.id, imageQuality)

    const imagePartRes = response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
    if (!imagePartRes || !('inlineData' in imagePartRes)) {
      await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
      return { error: 'AI không trả về ảnh hợp lệ.' }
    }

    const resultBuffer = Buffer.from(imagePartRes.inlineData.data, 'base64')
    const resultPath = `results/${user.id}/story_${Date.now()}.png`
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

    revalidatePath('/ke-chuyen-bang-hinh-anh')
    revalidatePath('/dashboard/history')
    return { success: true, resultUrl: urlData.publicUrl }
  } catch (e) {
    await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
    const msg = e instanceof Error ? e.message : String(e)
    if (/500|Internal Server Error|Internal error/i.test(msg)) {
      return { error: 'Hệ thống quá tải. Bạn có thể thử lại sau ít phút.' }
    }
    return { error: msg }
  }
}
