import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_PRO } from '@/lib/gemini-config'
import { getUserOrBypass } from '@/lib/auth'
import { CurriculumApiFeature, trackCurriculumGeminiResult } from '@/lib/curriculum-api-usage'
import {
  curriculumOriginalLessonRules,
  normalizeKnowledgePoints,
  stampCurriculumOriginalBody,
} from '@/app/tao-giao-trinh/lib/curriculum-original-body'
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

const MAX_IMAGES = 10

/** Tạo giáo trình từ mạch kiến thức đọc được ở chữ dán hoặc ảnh. Không lưu đoạn sách. */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const pastedContent = (formData.get('pastedContent') as string)?.trim() || ''
    const subjectId = String(formData.get('subjectId') || 'toan').trim()
    const gradeLevelId = String(formData.get('gradeLevelId') || 'lop-6').trim()
    const topic = (formData.get('topic') as string)?.trim() || ''
    const numLessons = Math.min(10, Math.max(1, parseInt(String(formData.get('numLessons') || '3'), 10)))
    const lessonDurationMinutes = Math.min(120, Math.max(15, parseInt(String(formData.get('lessonDurationMinutes') || '45'), 10)))
    const goals = (formData.get('goals') as string)?.trim() || ''

    if (!pastedContent || pastedContent.length < 100) {
      return NextResponse.json(
        { error: 'Vui lòng dán nội dung sách (ít nhất 100 ký tự).' },
        { status: 400 }
      )
    }

    const images = formData.getAll('images') as File[]
    const files = images.filter((f) => f && typeof f === 'object' && f.size > 0).slice(0, MAX_IMAGES)
    const hasImages = files.length > 0

    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Thiếu GOOGLE_API_KEY.' }, { status: 500 })
    }

    const pasteUser = await getUserOrBypass()
    const trackUserId = pasteUser?.id ?? null

    const subjectName = SUBJECT_NAMES[subjectId] || subjectId
    const gradeLabel = gradeLevelId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    const numTiet = numLessons
    const thoiLuong = lessonDurationMinutes

    const extractPrompt = `Đoạn dưới đây và ảnh kèm theo (nếu có) chỉ để nhận mạch kiến thức. Trả JSON:
{"knowledgePoints":["ý ngắn","..."]}
- 4 đến 12 ý. Mỗi ý là khái niệm, công thức hoặc kỹ năng, tối đa 12 từ.
- Không chép câu chữ, đề, số liệu, lời giải. Không mô tả hình.
- Chỉ trả JSON.

ĐOẠN THAM KHẢO:
---
${pastedContent.slice(0, 12000)}
---`

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      ...GEMINI_25_PRO,
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
    })

    const imageParts = hasImages
      ? await Promise.all(
          files.map(async (file) => {
            const buffer = Buffer.from(await file.arrayBuffer())
            const mimeType = file.type || 'image/png'
            return { inlineData: { data: buffer.toString('base64'), mimeType } }
          })
        )
      : []
    const extractResult = imageParts.length
      ? await model.generateContent([extractPrompt, ...imageParts])
      : await model.generateContent(extractPrompt)
    trackCurriculumGeminiResult(extractResult, GEMINI_25_PRO.model, CurriculumApiFeature.fromPaste, trackUserId)
    const extractRaw = extractResult.response.text()?.trim() || ''
    let knowledgePoints: string[] = []
    try {
      const cleanedExtract = extractRaw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
      const extractParsed = JSON.parse(cleanedExtract) as { knowledgePoints?: unknown }
      knowledgePoints = normalizeKnowledgePoints(extractParsed.knowledgePoints)
    } catch {
      knowledgePoints = []
    }
    if (knowledgePoints.length < 2) {
      return NextResponse.json(
        { error: 'Không đọc được mạch kiến thức. Nội dung đã dán không được lưu.' },
        { status: 422 }
      )
    }

    const writerPrompt = `Soạn giáo trình từ mạch kiến thức dưới đây. Không dùng lại đoạn sách gốc.
Môn: ${subjectName}
Cấp độ: ${gradeLabel}
Thời lượng: ${numTiet} tiết x ${thoiLuong} phút.
${topic ? `Tên bài: ${topic}` : ''}
${goals ? `Mục tiêu bổ sung: ${goals}` : ''}

Mạch kiến thức:
${knowledgePoints.map((point, i) => `${i + 1}. ${point}`).join('\n')}

${curriculumOriginalLessonRules(thoiLuong, subjectId)}

FORMAT:
- Tiêu đề chính: ## GIÁO TRÌNH: <TÊN BÀI VIẾT HOA>
- Mỗi tiết: ### Tiết X: <tiêu đề tiết> (tổng ${thoiLuong} phút)
- Mỗi hoạt động: **1. Khởi động (X phút)**, **2. Hình thành kiến thức (X phút)**, **3. Luyện tập (X phút)**, **4. Vận dụng (X phút)**
- Chỉ trả Markdown, không giải thích thêm.`

    const writerModel = genAI.getGenerativeModel({ ...GEMINI_25_PRO, generationConfig: { temperature: 0.3 } })
    const writerResult = await writerModel.generateContent(writerPrompt)
    trackCurriculumGeminiResult(writerResult, GEMINI_25_PRO.model, CurriculumApiFeature.fromPaste, trackUserId)
    const text = writerResult.response.text()?.trim() || ''

    const cleaned = text.replace(/^```(?:markdown|md)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
    if (!cleaned) {
      return NextResponse.json({ error: 'AI không trả về nội dung.' }, { status: 500 })
    }

    const extractedTopic =
      topic ||
      cleaned.match(/^#+\s*GIÁO TRÌNH:\s*(.+?)(?:\n|$)/im)?.[1]?.trim() ||
      cleaned.match(/^#+\s*(.+?)(?:\n|$)/m)?.[1]?.trim() ||
      'Giáo trình từ nội dung sách'

    const checked = await repairThenMarkLessonMarkdown(cleaned, trackUserId, subjectId)
    return NextResponse.json({
      curriculumMarkdown: stampCurriculumOriginalBody(checked),
      topic: extractedTopic,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[curriculum-from-paste]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
