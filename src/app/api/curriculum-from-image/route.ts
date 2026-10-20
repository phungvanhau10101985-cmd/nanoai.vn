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
} from '@/lib/curriculum-ai-credits'
import {
  applyCurriculumAiCharge,
  buildCurriculumBodyArtifactKey,
  buildCurriculumBodyFingerprintKey,
  estimateCurriculumAiPrecheckAmount,
} from '@/lib/curriculum-ai-charge-policy'
import { formatCurriculumLessonNoDisplay, parseCurriculumLessonNumber } from '@/app/tao-giao-trinh/lib/curriculum-input-normalize'
import { curriculumOriginalLessonRules, normalizeKnowledgePoints } from '@/app/tao-giao-trinh/lib/curriculum-original-body'
import { repairThenMarkLessonMarkdown } from '@/app/tao-giao-trinh/lib/curriculum-math-repair'

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

/** Giới hạn số ảnh – 20 ảnh nếu mỗi file không quá lớn */
const MAX_IMAGES = 20

/** Đọc ảnh và viết giáo trình. Ghi đè bằng CURRICULUM_FROM_IMAGE_OPENAI_MODEL */
const CURRICULUM_FROM_IMAGE_OPENAI_MODEL =
  process.env.CURRICULUM_FROM_IMAGE_OPENAI_MODEL?.trim() || 'gpt-5.1'

type LessonOutlineItem = { lessonNo: number; title: string; markdown: string }

type ImagePartForAi = { mimeType: string; base64: string }

async function generateCurriculumJsonTextWithOpenAI(
  prompt: string,
  images: ImagePartForAi[],
  userId: string | null,
  maxTokens: number
): Promise<string> {
  const openaiKey = process.env.OPENAI_API_KEY?.trim()
  if (!openaiKey) throw new Error('Thiếu OPENAI_API_KEY.')

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
    body.max_completion_tokens = maxTokens
  } else {
    body.max_tokens = maxTokens
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
      feature: CurriculumApiFeature.fromImage,
      promptTokenCount: promptTok,
      candidatesTokenCount: outTok,
      totalTokenCount: Math.max(1, totalTok),
    })
  }
  return content
}

async function generateCurriculumModelText(
  prompt: string,
  images: ImagePartForAi[],
  userId: string | null,
  maxTokens: number
): Promise<string> {
  const openaiKeyConfigured = Boolean(process.env.OPENAI_API_KEY?.trim())
  let openaiError: unknown = null
  if (openaiKeyConfigured) {
    try {
      const text = await generateCurriculumJsonTextWithOpenAI(prompt, images, userId, maxTokens)
      if (text) return text
      openaiError = new Error('OpenAI trả về rỗng.')
    } catch (e) {
      openaiError = e
      const msg = e instanceof Error ? e.message : String(e)
      console.warn('[curriculum-from-image] GPT lỗi:', msg.slice(0, 500))
    }
  }

  const apiKey = process.env.GOOGLE_API_KEY?.trim()
  if (!apiKey) {
    if (openaiError instanceof Error) throw openaiError
    if (openaiError) throw new Error(String(openaiError))
    throw new Error('Thiếu OPENAI_API_KEY hoặc GOOGLE_API_KEY.')
  }

  try {
    if (openaiError || !openaiKeyConfigured) {
      console.warn('[curriculum-from-image] Fallback Gemini', GEMINI_25_PRO.model)
    }
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      ...GEMINI_25_PRO,
      generationConfig: { temperature: 0.3 },
    })
    const imageParts = images.map(({ mimeType, base64 }) => ({
      inlineData: { data: base64, mimeType },
    }))
    const result = images.length
      ? await model.generateContent([prompt, ...imageParts])
      : await model.generateContent(prompt)
    trackCurriculumGeminiResult(result, GEMINI_25_PRO.model, 'curriculum-from-image-gemini-fallback', userId)
    const text = result.response.text()?.trim() || ''
    if (text) return text
  } catch (geminiErr) {
    const gmsg = geminiErr instanceof Error ? geminiErr.message : String(geminiErr)
    if (openaiError) {
      const omsg = openaiError instanceof Error ? openaiError.message : String(openaiError)
      throw new Error(`OpenAI: ${omsg.slice(0, 280)} | Gemini: ${gmsg.slice(0, 280)}`)
    }
    throw geminiErr instanceof Error ? geminiErr : new Error(gmsg)
  }

  if (openaiError instanceof Error) throw openaiError
  throw new Error('AI không trả về nội dung.')
}

function parseCurriculumJson(text: string): Record<string, unknown> {
  const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
  if (!cleaned) throw new Error('AI không trả về nội dung.')
  return JSON.parse(cleaned) as Record<string, unknown>
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

/** Tạo giáo trình từ ảnh trang sách: GPT-5.1 đọc ảnh và viết bài. Với môn Toán, Gemini viết lại bài code báo sai hoặc chưa kiểm được. Gemini cũng chạy khi GPT lỗi. */
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
    const overwriteCurriculumId = String(formData.get('overwriteCurriculumId') || '').trim()
    const textbookVolume = String(formData.get('textbookVolume') || '').trim() || null
    const bookIsbn = String(formData.get('bookIsbn') || '').trim().toLowerCase() || null

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
    const bodyArtifactKey = overwriteCurriculumId
      ? buildCurriculumBodyArtifactKey(overwriteCurriculumId)
      : buildCurriculumBodyFingerprintKey({
          subjectId,
          gradeLevelId,
          textbookSetId,
          lessonNumber,
          textbookVolume,
          bookIsbn,
        })
    const isRegenerateBody = Boolean(overwriteCurriculumId)
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
      const requiredPrecheck = await estimateCurriculumAiPrecheckAmount({
        userId: billingUserId!,
        kind: 'curriculum_body',
        artifactKey: bodyArtifactKey,
        listPrice: fromImageCost,
        isRegenerate: isRegenerateBody,
      })
      if (requiredPrecheck > 0) {
        const bal = await readUserCreditBalance(billingUserId!)
        if (bal < requiredPrecheck) {
          return NextResponse.json(
            {
              error: 'insufficient_credits',
              code: 'INSUFFICIENT_CREDITS',
              balance: bal,
              required: requiredPrecheck,
            },
            { status: 402 }
          )
        }
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

    const imgLabel = files.length > 1 ? `${files.length} ảnh trang sách` : 'ảnh trang sách'
    const outlinePrompt = `Đây là ${imgLabel} để nhận diện bài học ${subjectName}, khối ${gradeLevelId}, bộ ${textbookName}.
Chỉ đọc nhãn bài và mạch kiến thức. Trả JSON:
{
  "lessonNumber": <số đứng ngay sau chữ "Bài" trên nhãn đầu trang>,
  "lessonTitle": "<tên bài in cạnh nhãn Bài, tối đa 12 từ>",
  "knowledgePoints": ["ý kiến thức ngắn", "..."]
}

Ràng buộc số bài:
- lessonNumber chỉ lấy từ nhãn "Bài" ở đầu trang. "Bài 8" → 8. "Bài 1.5" → 1.5.
- Cấm lấy số từ hình, trang, mục, hoạt động, ví dụ, bài tập. "Hình 2.47" là số hình, không phải bài 2. Số trang ở góc không phải số bài. Mục "1." không phải số bài.
- knowledgePoints từ 4 đến 12 ý. Mỗi ý là khái niệm, công thức hoặc kỹ năng, tối đa 12 từ. Không ghi số hình, số trang, số bài tập.
- Không chép câu chữ, đề, số liệu, lời giải. Không mô tả hình vẽ trong sách.
- Không trả lessons, không viết giáo án trong bước này.
- Chỉ trả JSON hợp lệ.`

    let outlineParsed: Record<string, unknown>
    try {
      const outlineText = await generateCurriculumModelText(outlinePrompt, imageBuffers, trackUserId, 4096)
      outlineParsed = parseCurriculumJson(outlineText)
    } catch (outlineErr) {
      const msg = outlineErr instanceof Error ? outlineErr.message : String(outlineErr)
      const status = /Gemini:|OpenAI|503|429|502/.test(msg) ? 503 : 500
      return NextResponse.json({ error: msg }, { status })
    }

    const knowledgePoints = normalizeKnowledgePoints(outlineParsed.knowledgePoints)
    if (knowledgePoints.length < 2) {
      return NextResponse.json(
        { error: 'Không đọc được mạch kiến thức từ ảnh. Ảnh không được lưu.' },
        { status: 422 }
      )
    }

    const outlineTitle = String(outlineParsed.lessonTitle || '').replace(/\s+/g, ' ').trim().slice(0, 120)
    const outlineLessonNumber = parseCurriculumLessonNumber(outlineParsed.lessonNumber as number | string | null)
    const writerPrompt = `Soạn giáo trình từ mạch kiến thức dưới đây. Không có trang sách trong bước này.
Môn: ${subjectName}
Khối lớp: ${gradeLevelId}
Bộ sách: ${textbookName}
Số bài: ${outlineLessonNumber != null ? formatCurriculumLessonNoDisplay(outlineLessonNumber) : formatCurriculumLessonNoDisplay(lessonNumber)}
Tên bài: ${outlineTitle || 'theo mạch kiến thức'}
Số tiết: ${numLessons}
- Trường lessonNumber phải đúng số bài đã ghi ở trên. Không tự đổi số bài.
${curriculumOriginalLessonRules(lessonDurationMinutes, subjectId)}

Mạch kiến thức:
${knowledgePoints.map((point, i) => `${i + 1}. ${point}`).join('\n')}

Trả JSON:
{
  "lessonNumber": <số bài>,
  "lessonTitle": "<tên bài>",
  "lessons": [ { "lessonNo": 1, "title": "...", "markdown": "..." } ]
}
- lessons phải có đúng ${numLessons} tiết.
- Chỉ trả JSON hợp lệ, không markdown/code fence.`

    let text = ''
    try {
      text = await generateCurriculumModelText(writerPrompt, [], trackUserId, 32000)
    } catch (writerErr) {
      const msg = writerErr instanceof Error ? writerErr.message : String(writerErr)
      const status = /Gemini:|OpenAI|503|429|502/.test(msg) ? 503 : 500
      return NextResponse.json({ error: msg }, { status })
    }

    if (!text) {
      return NextResponse.json(
        { error: 'AI không trả về nội dung (Gemini và OpenAI đều không có kết quả).' },
        { status: 500 }
      )
    }

    let parsed: {
      lessonNumber?: number | string
      lessonTitle?: string
      lessons?: Array<{ lessonNo?: number; title?: string; markdown?: string }>
    }
    try {
      parsed = parseCurriculumJson(text) as typeof parsed
    } catch {
      return NextResponse.json({ error: 'AI trả về JSON giáo trình không hợp lệ.' }, { status: 500 })
    }
    if (outlineLessonNumber != null) parsed.lessonNumber = outlineLessonNumber
    if (!parsed.lessonTitle && outlineTitle) parsed.lessonTitle = outlineTitle
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
    for (const lesson of lessonOutline) {
      lesson.markdown = await repairThenMarkLessonMarkdown(lesson.markdown, trackUserId, subjectId)
    }
    const extractedLessonNumber = outlineLessonNumber ?? lessonNumber
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
    let chargeReason: string | undefined
    let dailyQuota: { usedToday: number; limit: number; remaining: number; usageDate: string } | undefined
    if (!chargeDisabled && isPgConfigured() && billingUserId) {
      try {
        const charge = await applyCurriculumAiCharge({
          userId: billingUserId,
          kind: 'curriculum_body',
          artifactKey: bodyArtifactKey,
          listPrice: fromImageCost,
          chargeType: CURRICULUM_AI_CHARGE_TYPES.fromImage,
          isRegenerate: isRegenerateBody,
          eventKey: `curriculum_from_image:${billingUserId}:${randomUUID()}`,
          metadata: {
            contentHash,
            subjectId,
            gradeLevelId,
            textbookSetId,
            lessonNumber: extractedLessonNumber,
            overwriteCurriculumId: overwriteCurriculumId || null,
          },
        })
        dailyQuota = charge.dailyQuota
        if (!charge.ok) {
          if (charge.code === 'INSUFFICIENT_CREDITS') {
            chargeError = 'insufficient_credits'
            console.warn('[curriculum-from-image] Thiếu credit sau khi AI đã tạo nội dung', {
              balance: charge.balance,
              required: charge.required,
            })
          } else {
            chargeError = charge.error || 'charge_failed'
            console.error('[curriculum-from-image] Trừ credit thất bại (đã tạo nội dung):', chargeError)
          }
        } else {
          creditsCharged = charge.creditsCharged
          chargeReason = charge.chargeReason
          if (typeof charge.newBalance === 'number') newBalance = charge.newBalance
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
      ...(chargeReason ? { chargeReason } : {}),
      ...(dailyQuota ? { dailyQuota } : {}),
      ...(typeof newBalance === 'number' ? { newBalance } : {}),
      ...(chargeError ? { chargeError } : {}),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[curriculum-from-image]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
