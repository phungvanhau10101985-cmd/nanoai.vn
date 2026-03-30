import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_PRO } from '@/lib/gemini-config'
import { createClient } from '@/lib/supabase/server'
import { CurriculumApiFeature, trackCurriculumGeminiResult } from '@/lib/curriculum-api-usage'
import {
  CURRICULUM_AI_CHARGE_TYPES,
  curriculumAiAdminClient,
  curriculumMarkdownCreditHash,
  FROM_IMAGE_CREDIT_COST,
  isCurriculumAiCreditsDisabled,
  readUserCreditBalance,
  spendCurriculumAiCredits,
} from '@/lib/curriculum-ai-credits'

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

type LessonOutlineItem = { lessonNo: number; title: string; markdown: string }

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
    const lessonNumber = parseInt(String(formData.get('lessonNumber') || '1'), 10)
    const numLessons = Math.min(10, Math.max(1, parseInt(String(formData.get('numLessons') || '3'), 10)))
    const lessonDurationMinutes = Math.min(120, Math.max(15, parseInt(String(formData.get('lessonDurationMinutes') || '45'), 10)))

    if (files.length === 0) {
      return NextResponse.json({ error: 'Vui lòng gửi ảnh trang sách.' }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Thiếu GOOGLE_API_KEY.' }, { status: 500 })
    }

    const supabase = createClient()
    const {
      data: { user: visionUser },
    } = await supabase.auth.getUser()
    const trackUserId = visionUser?.id ?? null
    const billingUserId = visionUser?.id

    const chargeDisabled = isCurriculumAiCreditsDisabled()
    const admin = chargeDisabled ? null : curriculumAiAdminClient()
    const fromImageCost = FROM_IMAGE_CREDIT_COST

    if (!chargeDisabled && !billingUserId) {
      return NextResponse.json(
        { error: 'Vui lòng đăng nhập để tạo giáo trình từ ảnh.', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }
    if (!chargeDisabled) {
      if (!admin) {
        return NextResponse.json(
          {
            error: 'Máy chủ thiếu cấu hình trừ credit (SUPABASE_SERVICE_ROLE_KEY).',
            code: 'BILLING_CONFIG_MISSING',
          },
          { status: 503 }
        )
      }
      const bal = await readUserCreditBalance(admin, billingUserId!)
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

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      ...GEMINI_25_PRO,
      generationConfig: { temperature: 0.3 },
    })

    const imageParts = await Promise.all(
      files.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer())
        const mimeType = file.type || 'image/png'
        return {
          inlineData: { data: buffer.toString('base64'), mimeType },
        }
      })
    )

    const imgLabel = files.length > 1 ? `${files.length} ảnh trang sách` : 'ảnh trang sách'
    const prompt = `Đây là ${imgLabel} giáo khoa ${subjectName} ${gradeLevelId}, bộ ${textbookName}.
Hãy trả về JSON theo schema:
{
  "lessonNumber": <số bài trích từ ảnh>,
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

    const result = await model.generateContent([prompt, ...imageParts])
    trackCurriculumGeminiResult(result, GEMINI_25_PRO.model, CurriculumApiFeature.fromImage, trackUserId)
    const text = result.response.text()?.trim() || ''
    const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
    if (!cleaned) {
      return NextResponse.json({ error: 'AI không trả về nội dung.' }, { status: 500 })
    }
    const parsed = JSON.parse(cleaned) as {
      lessonNumber?: number
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
    const extractedLessonNumber = Math.max(
      1,
      Math.floor(Number(parsed.lessonNumber) || lessonNumber)
    )
    const extractedTitle = String(parsed.lessonTitle || '').trim() || `Bài ${extractedLessonNumber}`
    const curriculumBody = composeCurriculumMarkdownFromLessons(lessonOutline)
    if (!curriculumBody.trim()) {
      return NextResponse.json({ error: 'Không thể tổng hợp content_markdown từ JSON tiết học.' }, { status: 500 })
    }

    const contentHash = curriculumMarkdownCreditHash(curriculumBody)
    let creditsCharged = false
    let newBalance: number | undefined
    let chargeError: string | undefined
    if (!chargeDisabled && admin && billingUserId) {
      try {
        const spend = await spendCurriculumAiCredits(admin, {
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
