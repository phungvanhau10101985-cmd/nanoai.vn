/**
 * Kiểm tra chi tiết nội dung câu (block) phiếu bài tập.
 * Trả về từng trường cần sửa: vị trí, vấn đề, gợi ý sửa.
 * Có thể trả về correctedContent để nút "Áp dụng sửa" dùng.
 */
import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'

const PROMPT_QUIZ = `Bạn là chuyên gia kiểm tra phiếu bài tập toán. Phân tích câu trắc nghiệm dưới đây.

CÂU HỎI (Markdown):
---
{content}
---

NGỮ CẢNH GIÁO TRÌNH (nếu có):
---
{curriculum}
---

Nhiệm vụ:
1. Kiểm tra: đáp án có đúng với bài toán không? Các lựa chọn A,B,C,D có logic không?
2. Kiểm tra: công thức dùng Unicode (∈, ℝ, ∞, →...) chứ không LaTeX (\\in, \\mathbb{R}, \\infty, \\rightarrow)?
3. Liệt kê TỪNG vấn đề cần sửa.

Trả về ĐÚNG JSON (không markdown, không giải thích):
{
  "issues": [
    {
      "field": "Tên trường (vd: Đáp án, Lựa chọn B, Công thức)",
      "location": "Vị trí trong văn bản (vd: dòng Đáp án, phần lựa chọn C)",
      "issue": "Mô tả vấn đề",
      "suggested": "Nội dung nên sửa thành"
    }
  ],
  "correctedContent": "Toàn bộ nội dung câu đã sửa (markdown, giữ format gốc)"
}

- Nếu không có lỗi: issues = [], correctedContent = null (giữ nguyên).
- Nếu có lỗi: điền đủ từng issue, correctedContent = nội dung đã sửa toàn bộ.`

const PROMPT_ESSAY = `Bạn là chuyên gia kiểm tra phiếu bài tập. Phân tích bài tự luận dưới đây.

BÀI TỰ LUẬN (Markdown):
---
{content}
---

NGỮ CẢNH GIÁO TRÌNH (nếu có):
---
{curriculum}
---

Nhiệm vụ:
1. Kiểm tra: lời giải có đúng với đề bài không? Logic, công thức?
2. Kiểm tra: công thức dùng Unicode (∈, ℝ, ∞, ∫...) chứ không LaTeX?
3. Liệt kê TỪNG vấn đề cần sửa.

Trả về ĐÚNG JSON (không markdown, không giải thích):
{
  "issues": [
    {
      "field": "Tên trường (vd: Đề bài, Lời giải, Công thức)",
      "location": "Vị trí trong văn bản",
      "issue": "Mô tả vấn đề",
      "suggested": "Nội dung nên sửa thành"
    }
  ],
  "correctedContent": "Toàn bộ nội dung bài đã sửa (markdown) hoặc null nếu không cần sửa"
}`

function parseResponse(text: string): { issues: Array<{ field: string; location: string; issue: string; suggested: string }>; correctedContent: string | null } | null {
  try {
    const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
    const parsed = JSON.parse(cleaned) as {
      issues?: Array<{ field?: string; location?: string; issue?: string; suggested?: string }>
      correctedContent?: string | null
    }
    const issues = (parsed.issues ?? []).map((i) => ({
      field: String(i.field ?? ''),
      location: String(i.location ?? ''),
      issue: String(i.issue ?? ''),
      suggested: String(i.suggested ?? ''),
    }))
    const correctedContent =
      parsed.correctedContent != null && parsed.correctedContent !== '' ? String(parsed.correctedContent) : null
    return { issues, correctedContent }
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GOOGLE_API_KEY?.trim()
    if (!apiKey) {
      return NextResponse.json({ error: 'Thiếu GOOGLE_API_KEY.' }, { status: 500 })
    }
    const contentType = req.headers.get('content-type') || ''
    const isFormData = contentType.includes('multipart/form-data')
    let content = ''
    let blockType: 'quiz' | 'essay' = 'quiz'
    let curriculum = ''
    let imageParts: Array<{ inlineData: { data: string; mimeType: string } }> = []

    if (isFormData) {
      const formData = await req.formData()
      content = String(formData.get('content') ?? '').trim()
      blockType = (String(formData.get('blockType') ?? 'quiz') as 'quiz' | 'essay')
      curriculum = String(formData.get('curriculum') ?? '').trim().slice(0, 4000)
      const images = formData.getAll('images') as File[]
      const files = images.filter((f) => f && typeof f === 'object' && f.size > 0).slice(0, 6)
      if (files.length > 0) {
        imageParts = await Promise.all(
          files.map(async (file) => {
            const buffer = Buffer.from(await file.arrayBuffer())
            return {
              inlineData: {
                data: buffer.toString('base64'),
                mimeType: file.type || 'image/png',
              },
            }
          })
        )
      }
    } else {
      const body = await req.json().catch(() => ({}))
      content = String(body?.content ?? '').trim()
      blockType = (body?.blockType ?? 'quiz') as 'quiz' | 'essay'
      curriculum = String(body?.curriculum ?? '').trim().slice(0, 4000)
    }

    if (!content || content.length < 10) {
      return NextResponse.json({ error: 'Nội dung câu quá ngắn.' }, { status: 400 })
    }

    const prompt =
      blockType === 'essay'
        ? PROMPT_ESSAY.replace('{content}', content).replace('{curriculum}', curriculum || '(không có)')
        : PROMPT_QUIZ.replace('{content}', content).replace('{curriculum}', curriculum || '(không có)')

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel(GEMINI_25_FLASH_NO_THINKING as { model: 'gemini-2.5-flash' })
    const result = imageParts.length > 0 ? await model.generateContent([prompt, ...imageParts]) : await model.generateContent(prompt)
    const text = result.response.text()?.trim() ?? ''
    const parsed = parseResponse(text)

    if (!parsed) {
      return NextResponse.json({ error: 'AI không trả về JSON hợp lệ.' }, { status: 500 })
    }

    return NextResponse.json({
      issues: parsed.issues,
      correctedContent: parsed.correctedContent,
    })
  } catch (e) {
    console.error('[worksheet-edit-check]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Lỗi kiểm tra.' },
      { status: 500 }
    )
  }
}
