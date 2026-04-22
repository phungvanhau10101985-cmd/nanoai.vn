import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_PRO } from '@/lib/gemini-config'
import { getUserForCreditAction, getUserOrBypass } from '@/lib/auth'
import { CurriculumApiFeature, trackCurriculumGeminiResult } from '@/lib/curriculum-api-usage'
import { trackApiUsage } from '@/lib/track-ai-usage'
import { isPgConfigured } from '@/lib/db/pool'
import {
  CURRICULUM_AI_CHARGE_TYPES,
  curriculumMarkdownCreditHash,
  FROM_IMAGE_CREDIT_COST,
  isCurriculumAiCreditsDisabled,
  readUserCreditBalance,
  spendCurriculumAiCredits,
} from '@/lib/curriculum-ai-credits'
import { formatCurriculumLessonNoDisplay, parseCurriculumLessonNumber } from '@/app/tao-giao-trinh/lib/curriculum-input-normalize'

const SUBJECT_NAMES: Record<string, string> = {
  toan: 'Toán học',
  'ngu-van': 'Ngữ văn',
  'tieng-anh': 'Tiếng Anh',
  'vat-ly': 'Vật lý',
  'hoa-hoc': 'Hóa học',
  'sinh-hoc': 'Sinh học',
  'lich-su': 'Lịch sử',
  'dia-ly': 'Địa lý',
  gdcd: 'Giáo dục công dân',
  'tin-hoc': 'Tin học',
  'cong-nghe': 'Công nghệ',
  'am-nhac': 'Âm nhạc',
  'my-thuat': 'Mỹ thuật',
  'the-duc': 'Thể dục',
  khac: 'Khác',
}

const TEXTBOOK_NAMES: Record<string, string> = {
  'ket-noi-tri-thuc': 'Kết nối tri thức với cuộc sống',
  'canh-dieu': 'Cánh diều',
  'chan-troi-sang-tao': 'Chân trời sáng tạo',
  khac: 'Không chỉ định',
}

/** Giới hạn số ảnh – Gemini có trần payload/request; 20 ảnh nếu mỗi file không quá lớn */
const MAX_IMAGES = 20

/** Model OpenAI khi Gemini quá tải / 503 — ghi đè bằng CURRICULUM_FROM_IMAGE_OPENAI_MODEL */
const CURRICULUM_FROM_IMAGE_OPENAI_MODEL =
  process.env.CURRICULUM_FROM_IMAGE_OPENAI_MODEL?.trim() || 'gpt-5'

type LessonOutlineItem = { lessonNo: number; title: string; markdown: string }

type ImagePartForAi = { mimeType: string; base64: string }

/** Lỗi Gemini tạm thời → được phép fallback OpenAI (tránh gọi GPT khi sai API key / payload 400 rõ ràng). */
function isGeminiTransientForOpenAIFallback(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  if (/API key not valid|API_KEY_INVALID|invalid api key/i.test(msg)) return false
  const m = msg.toLowerCase()
  return (
    /\b503\b/.test(msg) ||
    /\b502\b/.test(msg) ||
    /\b429\b/.test(msg) ||
    m.includes('service unavailable') ||
    m.includes('high demand') ||
    m.includes('overloaded') ||
    m.includes('resource_exhausted') ||
    (m.includes('unavailable') && m.includes('model')) ||
    m.includes('try again later') ||
    m.includes('econnreset') ||
    m.includes('fetch failed') ||
    m.includes('too many requests') ||
    m.includes('deadline exceeded') ||
    m.includes('internal error')
  )
}

async function generateCurriculumJsonTextWithOpenAI(
  prompt: string,
  images: ImagePartForAi[],
  userId: string | null
): Promise<string> {
  const openaiKey = process.env.OPENAI_API_KEY?.trim()
  if (!openaiKey) throw new Error('Thiếu OPENAI_API_KEY cho fallback.')

  const userContent: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  > = [
    { type: 'text', text: prompt },
    ...images.map(({ mimeType, base64 }) => ({
      type: 'image_url' as const,
      image_url: { url: `data:${mimeType};base64,${base64}` },
    })),
  ]

  const modelId = CURRICULUM_FROM_IMAGE_OPENAI_MODEL
  const body: Record<string, unknown> = {
    model: modelId,
    temperature: 0.3,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: userContent }],
  }
  const m = modelId.toLowerCase()
  if (m.startsWith('gpt-5') || m.startsWith('o1') || m.startsWith('o3') || m.startsWith('o4')) {
    body.max_completion_tokens = 16384
  } else {
    body.max_tokens = 16384
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify(body),
  })

  const rawText = await res.text()
  if (!res.ok) {
    throw new Error(`OpenAI ${res.status}: ${rawText.slice(0, 400)}`)
  }
  let data: {
    choices?: Array<{ message?: { content?: string | null } }>
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
  }
  try {
    data = JSON.parse(rawText) as typeof data
  } catch {
    throw new Error('OpenAI: phản hồi không phải JSON.')
  }
  const content = String(data?.choices?.[0]?.message?.content ?? '').trim()
  const u = data.usage
  const promptChars = prompt.length + images.reduce((s, im) => s + im.base64.length / 1.35, 0)
  const promptEst = Math.ceil(promptChars / 4)
  const outEst = Math.ceil(content.length / 4) || 1
  const promptTok = u?.prompt_tokens ?? promptEst
  const outTok = u?.completion_tokens ?? outEst
  const totalTok = u?.total_tokens ?? promptTok + outTok
  if (totalTok > 0) {
    void trackApiUsage({
      userId,
      model: modelId,
      feature: 'curriculum-from-image-openai-fallback',
      promptTokenCount: promptTok,
      candidatesTokenCount: outTok,
      totalTokenCount: Math.max(1, totalTok),
    })
  }
  return content
}

function composeCurriculumMarkdownFromLessons(lessons: LessonOutlineItem[]): string {
  const parts = lessons
    .map((item, idx) => {
      const lessonNo = Math.max(1, Math.floor(Number(item.lessonNo) || idx + 1))
      const title = String(item.title || '').trim()
      const markdown = String(item.markdown || '').trim()
      const heading = title ? `### Tiết ${lessonNo}: ${title}` : `### Tiết ${lessonNo}`
      if (!markdown) return heading
      if (/^#{2,3}\s*ti[eế]t\b/im.test(markdown)) return markdown
      return `${heading}\n\n${markdown}`
    })
    .filter((x) => x.trim().length > 0)
  return parts.join('\n\n')
}

/** Tạo giáo trình từ ảnh trang sách giáo khoa – dùng Gemini vision */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const images = formData.getAll('images') as File[]
    let files = images.filter((f) => f && typeof f === 'object' && f.size > 0)
    if (files.length === 0) {
      const single = formData.get('image') as File | null
      if (single && single.size > 0) files = [single]
    }
    if (files.length > MAX_IMAGES) {
      return NextResponse.json(
        { error: `Tối đa ${MAX_IMAGES} ảnh. Vui lòng chọn lại.` },
        { status: 400 }
      )
    }
    const subjectId = String(formData.get('subjectId') || 'toan').trim()
    const gradeLevelId = String(formData.get('gradeLevelId') || 'lop-12').trim()
    const textbookSetId = String(formData.get('textbookSetId') || 'ket-noi-tri-thuc').trim()
    const formLessonRaw = formData.get('lessonNumber')
    const lessonNumber =
      parseCurriculumLessonNumber(formLessonRaw != null ? String(formLessonRaw) : '') ?? 1
    const numLessons = Math.min(10, Math.max(1, parseInt(String(formData.get('numLessons') || '3'), 10)))
    const lessonDurationMinutes = Math.min(120, Math.max(15, parseInt(String(formData.get('lessonDurationMinutes') || '45'), 10)))

    if (files.length === 0) {
      return NextResponse.json({ error: 'Vui lòng gửi ảnh trang sách.' }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_API_KEY?.trim()
    const openaiKeyConfigured = Boolean(process.env.OPENAI_API_KEY?.trim())
    if (!apiKey && !openaiKeyConfigured) {
      return NextResponse.json(
        { error: 'Thiếu GOOGLE_API_KEY hoặc OPENAI_API_KEY (cần ít nhất một để gọi AI).' },
        { status: 500 }
      )
    }

    const chargeDisabled = isCurriculumAiCreditsDisabled()
    const fromImageCost = FROM_IMAGE_CREDIT_COST
    let trackUserId: string | null = null
    let billingUserId: string | null = null
    if (chargeDisabled) {
      const visionUser = await getUserOrBypass()
      trackUserId = visionUser?.id ?? null
      billingUserId = visionUser?.id ?? null
    } else {
      const auth = await getUserForCreditAction('Vui lòng đăng nhập để tạo giáo trình từ ảnh.')
      if ('error' in auth) {
        return NextResponse.json(
          { error: auth.error, code: 'UNAUTHORIZED' },
          { status: 401 }
        )
      }
      trackUserId = auth.user.id
      billingUserId = auth.user.id
    }

    if (!chargeDisabled) {
      if (!isPgConfigured()) {
        return NextResponse.json(
          {
            error: 'Máy chủ thiếu DATABASE_URL — không thể kiểm tra/trừ credit.',
            code: 'BILLING_CONFIG_MISSING',
          },
          { status: 503 }
        )
      }
      const bal = await readUserCreditBalance(billingUserId!)
      if (bal < fromImageCost) {
        return NextResponse.json(
          {
            error: 'insufficient_credits',
            code: 'INSUFFICIENT_CREDITS',
            balance: bal,
            required: fromImageCost,
          },
          { status: 402 }
        )
      }
    }

    const subjectName = SUBJECT_NAMES[subjectId] || subjectId
    const textbookName = TEXTBOOK_NAMES[textbookSetId] || TEXTBOOK_NAMES.khac

    const imageBuffers: ImagePartForAi[] = await Promise.all(
      files.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer())
        const mimeType = file.type || 'image/png'
        return { mimeType, base64: buffer.toString('base64') }
      })
    )

    const imageParts = imageBuffers.map(({ mimeType, base64 }) => ({
      inlineData: { data: base64, mimeType },
    }))

    const imgLabel = files.length > 1 ? `${files.length} ảnh trang sách` : 'ảnh trang sách'
    const prompt = `Đây là ${imgLabel} giáo khoa ${subjectName} ${gradeLevelId}, bộ ${textbookName}.
Hãy trả về JSON theo schema:
{
  "lessonNumber": <số bài trích từ ảnh; có thể số thập phân như 1.5, 2.5 nếu SGK ghi vậy>,
  "lessonTitle": "<tên bài>",
  "lessons": [
    { "lessonNo": 1, "title": "...", "markdown": "..." }
  ]
}

Ràng buộc:
- lessons phải có đúng ${numLessons} tiết (hoặc sát nhất có thể nếu dữ liệu ảnh thiếu).
- Mỗi tiết gồm 4 hoạt động theo Công văn 5512: Khởi động, Hình thành kiến thức, Luyện tập, Vận dụng.
- Mỗi hoạt động chia phần nhỏ, có thời lượng, tổng mỗi tiết = ${lessonDurationMinutes} phút.
- Bám sát SGK trong ảnh, không thêm bớt sai nội dung.
- Viết chi tiết theo ý SGK: nêu rõ kiến thức trọng tâm, ví dụ minh họa, câu hỏi dẫn dắt, bài tập luyện tập và gợi ý đáp án ngắn.
- Nếu SGK trong ảnh ghi quá ngắn, được bổ sung ý hợp lý để bài dạy đầy đủ hơn (ghi rõ phần "Mở rộng"), nhưng không được mâu thuẫn SGK.
- lesson.markdown phải đủ nội dung để dạy đủ ${lessonDurationMinutes} phút/tiết, tránh viết sơ sài.
- Ví dụ minh họa phải sát SGK trong ảnh.
- Nếu SGK có ví dụ/lời giải mẫu thì phải ghi đầy đủ các bước lời giải và kết luận, không tóm tắt.
- Dùng tiếng Việt + Unicode, không LaTeX.
- Chỉ trả JSON hợp lệ, không markdown/code fence.`

    let text = ''
    let geminiError: unknown = null
    if (apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey)
        const model = genAI.getGenerativeModel({
          ...GEMINI_25_PRO,
          generationConfig: { temperature: 0.3 },
        })
        const result = await model.generateContent([prompt, ...imageParts])
        trackCurriculumGeminiResult(result, GEMINI_25_PRO.model, CurriculumApiFeature.fromImage, trackUserId)
        text = result.response.text()?.trim() || ''
      } catch (e) {
        geminiError = e
        const msg = e instanceof Error ? e.message : String(e)
        console.warn('[curriculum-from-image] Gemini lỗi:', msg.slice(0, 500))
      }
    }

    if (!text && openaiKeyConfigured) {
      const allowFallback =
        !apiKey || (geminiError != null && isGeminiTransientForOpenAIFallback(geminiError)) || (!text && geminiError == null)
      if (allowFallback) {
        try {
          console.warn(
            '[curriculum-from-image] Fallback OpenAI',
            CURRICULUM_FROM_IMAGE_OPENAI_MODEL,
            geminiError ? '(sau lỗi Gemini)' : '(không có GOOGLE_API_KEY hoặc Gemini trả rỗng)'
          )
          text = await generateCurriculumJsonTextWithOpenAI(prompt, imageBuffers, trackUserId)
        } catch (openaiErr) {
          const omsg = openaiErr instanceof Error ? openaiErr.message : String(openaiErr)
          console.error('[curriculum-from-image] OpenAI fallback thất bại:', omsg.slice(0, 500))
          if (geminiError) {
            const gmsg = geminiError instanceof Error ? geminiError.message : String(geminiError)
            return NextResponse.json(
              {
                error: `Gemini: ${gmsg.slice(0, 280)} | OpenAI: ${omsg.slice(0, 280)}`,
              },
              { status: 503 }
            )
          }
          return NextResponse.json({ error: omsg }, { status: 503 })
        }
      } else if (geminiError) {
        const gmsg = geminiError instanceof Error ? geminiError.message : String(geminiError)
        return NextResponse.json({ error: gmsg }, { status: 500 })
      }
    } else if (!text && geminiError) {
      const gmsg = geminiError instanceof Error ? geminiError.message : String(geminiError)
      return NextResponse.json({ error: gmsg }, { status: 500 })
    }

    if (!text) {
      return NextResponse.json(
        { error: 'AI không trả về nội dung (Gemini và OpenAI đều không có kết quả).' },
        { status: 500 }
      )
    }

    const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
    if (!cleaned) {
      return NextResponse.json({ error: 'AI không trả về nội dung.' }, { status: 500 })
    }
    const parsed = JSON.parse(cleaned) as {
      lessonNumber?: number | string
      lessonTitle?: string
      lessons?: Array<{ lessonNo?: number; title?: string; markdown?: string }>
    }
    const lessonOutline = (parsed.lessons ?? [])
      .map((item, idx) => ({
        lessonNo: Math.max(1, Math.floor(Number(item.lessonNo) || idx + 1)),
        title: String(item.title || '').trim(),
        markdown: String(item.markdown || '').trim(),
      }))
      .filter((item) => item.markdown.length > 0)
    if (lessonOutline.length === 0) {
      return NextResponse.json({ error: 'AI chưa trả về JSON tiết học hợp lệ.' }, { status: 500 })
    }
    const fromJson = parseCurriculumLessonNumber(parsed.lessonNumber)
    const extractedLessonNumber = fromJson ?? lessonNumber
    const extractedTitle =
      String(parsed.lessonTitle || '').trim() ||
      `Bài ${formatCurriculumLessonNoDisplay(extractedLessonNumber)}`
    const curriculumBody = composeCurriculumMarkdownFromLessons(lessonOutline)
    if (!curriculumBody.trim()) {
      return NextResponse.json({ error: 'Không thể tổng hợp content_markdown từ JSON tiết học.' }, { status: 500 })
    }

    const contentHash = curriculumMarkdownCreditHash(curriculumBody)
    let creditsCharged = false
    let newBalance: number | undefined
    let chargeError: string | undefined
    if (!chargeDisabled && isPgConfigured() && billingUserId) {
      try {
        const spend = await spendCurriculumAiCredits({
          userId: billingUserId,
          amount: fromImageCost,
          chargeType: CURRICULUM_AI_CHARGE_TYPES.fromImage,
          eventKey: `curriculum_from_image:${billingUserId}:${randomUUID()}`,
          metadata: {
            contentHash,
            subjectId,
            gradeLevelId,
            textbookSetId,
            lessonNumber: extractedLessonNumber,
          },
        })
        if (spend.ok) {
          creditsCharged = true
          newBalance = spend.newBalance
        } else {
          chargeError = spend.error || 'charge_failed'
          console.error('[curriculum-from-image] Trừ credit thất bại (đã tạo nội dung):', chargeError)
        }
      } catch (chargeEx) {
        chargeError = chargeEx instanceof Error ? chargeEx.message : String(chargeEx)
        console.error('[curriculum-from-image] Lỗi trừ credit:', chargeEx)
      }
    }

    return NextResponse.json({
      curriculumMarkdown: curriculumBody,
      lessonOutline,
      topic: extractedTitle,
      lessonNumber: extractedLessonNumber,
      lessonTitle: extractedTitle,
      creditsCharged,
      ...(typeof newBalance === 'number' ? { newBalance } : {}),
      ...(chargeError ? { chargeError } : {}),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[curriculum-from-image]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
