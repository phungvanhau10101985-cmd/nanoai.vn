import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'

/** Kiểm tra câu hỏi trắc nghiệm chèn thủ công – đối chiếu đáp án với nội dung slide.
 * Model: Gemini 2.5 Flash.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const slideTitle = String(body?.slideTitle ?? '').trim()
    const slideContent = String(body?.slideContent ?? '').trim()
    const question = String(body?.question ?? '').trim()
    const options = Array.isArray(body?.options) ? body.options.map((o: unknown) => String(o ?? '').trim()) : []
    const correctIndex = Math.max(0, Math.min(Number(body?.correctIndex) || 0, 3))

    const fullContent = slideTitle ? `## ${slideTitle}\n\n${slideContent}` : slideContent
    if (!fullContent.trim()) {
      return NextResponse.json({ error: 'Thiếu nội dung slide.', verified: false }, { status: 400 })
    }
    if (!question || options.length < 2) {
      return NextResponse.json({ error: 'Thiếu câu hỏi hoặc đáp án.', verified: false }, { status: 400 })
    }

    const opts = options.slice(0, 4)
    const q = { question, options: opts, correctIndex }

    const verifyPrompt = `Bạn là giáo viên kiểm tra chất lượng. Đối chiếu nội dung slide với câu hỏi trắc nghiệm.

NỘI DUNG SLIDE:
---
${fullContent.slice(0, 3000)}
---

CÂU HỎI: ${q.question}

ĐÁP ÁN:
A. ${opts[0] ?? ''}
B. ${opts[1] ?? ''}
C. ${opts[2] ?? ''}
D. ${opts[3] ?? ''}

Đáp án hiện tại được đánh dấu đúng: ${String.fromCharCode(65 + correctIndex)} (${opts[correctIndex] ?? ''})

Nhiệm vụ: Đáp án này có ĐÚNG theo nội dung slide không? Nếu SAI, đáp án đúng phải là A/B/C/D nào?

Trả về JSON: { "verified": true|false, "correctIndex": 0|1|2|3 }
- verified: true nếu đáp án hiện tại đúng, false nếu sai
- correctIndex: chỉ cần khi verified=false, chỉ số (0-3) của đáp án đúng theo slide`

    const apiKey = process.env.GOOGLE_API_KEY?.trim()
    let result: { verified: boolean; correctIndex?: number } | null = null

    if (apiKey) {
      const genAI = new GoogleGenerativeAI(apiKey)
      const verifyModel = genAI.getGenerativeModel({
        ...GEMINI_25_FLASH_NO_THINKING,
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      })
      const verifyResult = await verifyModel.generateContent(verifyPrompt)
      const verifyText = verifyResult.response.text()?.trim() || ''
      if (verifyText) {
        const cleaned = verifyText.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
        const v = JSON.parse(cleaned) as { verified?: boolean; correctIndex?: number }
        result = { verified: v.verified === true, correctIndex: v.correctIndex }
      }
    }

    if (!result) {
      return NextResponse.json({ error: 'Không thể kiểm tra (thiếu API key).', verified: false }, { status: 500 })
    }

    return NextResponse.json({
      verified: result.verified,
      correctIndex: result.correctIndex,
      suggestedCorrectLetter: typeof result.correctIndex === 'number' && result.correctIndex >= 0 && result.correctIndex <= 3
        ? String.fromCharCode(65 + result.correctIndex)
        : undefined,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[slide-verify-quiz] Lỗi:', msg)
    return NextResponse.json({ error: `Lỗi: ${msg}`, verified: false }, { status: 500 })
  }
}
