import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'

/** AI tạo 1–2 câu trắc nghiệm cho một slide */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const title = String(body?.title ?? '').trim()
    const content = String(body?.content ?? '').trim()
    const blocks = Array.isArray(body?.blocks) ? body.blocks as Array<{ header?: string; content?: string }> : []

    const slideText = blocks.length > 0
      ? blocks.map((b) => `${b.header || ''}: ${b.content || ''}`).join('\n\n')
      : content

    const fullContent = title ? `## ${title}\n\n${slideText}` : slideText
    if (!fullContent.trim()) {
      return NextResponse.json({ error: 'Thiếu nội dung slide.' }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Thiếu GOOGLE_API_KEY.' }, { status: 500 })
    }

    const schema = `{
  "quizzes": [
    {
      "question": "Câu hỏi trắc nghiệm ngắn gọn?",
      "options": ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
      "correctIndex": 0
    }
  ]
}`

    const prompt = `Dựa trên nội dung slide sau, tạo 1–2 câu hỏi trắc nghiệm (tối đa 2) kiểm tra hiểu bài.

YÊU CẦU:
- Mỗi câu: "question" (ngắn gọn), "options" (đúng 4 đáp án A/B/C/D), "correctIndex" (0–3).
- Đáp án đúng PHẢI chính xác về mặt nội dung (công thức, định nghĩa, quy tắc). Không đoán mò.
- Mỗi đáp án phải là câu/ý hoàn chỉnh, không được rời rạc (ví dụ: không tạo "f(x)", "dx", "S =" riêng lẻ).
- Nếu slide có công thức toán: đáp án đúng phải dùng đúng ký hiệu (ví dụ |f(x)| cho trị tuyệt đối, [f(x)]² cho bình phương).
- Thể tích khối tròn xoay quanh Ox: V = π ∫_a^b [f(x)]² dx (bắt buộc có BÌNH PHƯƠNG).
- Diện tích hình phẳng: S = ∫_a^b |f(x)| dx (bắt buộc có trị tuyệt đối).
- BẮT BUỘC đúng 4 đáp án. Thiếu 1 đáp án = bỏ câu đó.
- Ngôn ngữ: Tiếng Việt.
- Chỉ trả về JSON hợp lệ, không markdown.

NỘI DUNG SLIDE:
---
${fullContent.slice(0, 4000)}
---

Schema: ${schema}`

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      ...GEMINI_25_FLASH_NO_THINKING,
      generationConfig: { temperature: 0.3, responseMimeType: 'application/json' },
    })

    const result = await model.generateContent(prompt)
    const rawText = result.response.text()?.trim() || ''
    if (!rawText) {
      return NextResponse.json({ error: 'AI không trả về nội dung.' }, { status: 500 })
    }

    const cleaned = rawText.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
    const parsed = JSON.parse(cleaned) as { quizzes?: Array<{ question?: string; options?: string[]; correctIndex?: number }> }
    const quizzes = Array.isArray(parsed?.quizzes)
      ? parsed.quizzes
          .slice(0, 2)
          .filter((q) => q?.question && Array.isArray(q?.options) && q.options.length >= 4)
          .map((q) => ({
            ...q,
            options: (q.options ?? []).slice(0, 4),
            correctIndex: Math.max(0, Math.min(q.correctIndex ?? 0, 3)),
          }))
      : []

    if (quizzes.length === 0) {
      return NextResponse.json({ error: 'AI không tạo được câu hỏi.' }, { status: 500 })
    }

    const markers = quizzes.map((q) => {
      const opts = (q.options ?? []).slice(0, 6).join('|')
      const idx = Math.max(0, Math.min(q.correctIndex ?? 0, (q.options?.length ?? 1) - 1))
      return `[quiz:${q.question}|${opts}|${idx}]`
    })

    return NextResponse.json({ markers, quizzes })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[slide-generate-quiz] Lỗi:', msg)
    return NextResponse.json({ error: `Lỗi: ${msg}` }, { status: 500 })
  }
}
