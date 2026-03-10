import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_FLASH_NO_THINKING, GEMINI_25_PRO } from '@/lib/gemini-config'

/** Model tạo quiz: luôn dùng Pro cho kiến thức giáo dục. */
const QUIZ_CREATE_MODEL = GEMINI_25_PRO

/** Model retry khi DeepSeek báo sai: GPT (OpenAI). */
const GPT_RETRY_MODEL = process.env.EDUCATIONAL_RETRY_MODEL?.trim() || process.env.OPENAI_FALLBACK_MODEL?.trim() || 'gpt-4o-mini'

const QUIZ_SCHEMA = `{
  "quizzes": [
    {
      "question": "Câu hỏi trắc nghiệm ngắn gọn?",
      "options": ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
      "correctIndex": 0
    }
  ]
}`

function buildQuizPrompt(fullContent: string): string {
  return `Bạn là giáo viên chuyên môn. Tạo ĐÚNG 1 câu trắc nghiệm CHUẨN, CHÍNH XÁC từ nội dung slide.

QUY TRÌNH BẮT BUỘC:
1. ĐỌC KỸ slide, xác định công thức/định nghĩa/quy tắc CHÍNH XÁC được nêu.
2. Tạo đáp án ĐÚNG trước – phải khớp 100% với nội dung slide, không thiếu ký hiệu.
3. Tạo 3 đáp án SAI – plausible nhưng rõ ràng sai (thiếu dấu, sai công thức, nhầm khái niệm).

QUY TẮC CÔNG THỨC TOÁN (BẮT BUỘC):
- Diện tích hình phẳng: S = ∫|f(x)|dx  → phải có TRỊ TUYỆT ĐỐI |f(x)|.
- Thể tích khối tròn xoay quanh Ox: V = π∫[f(x)]²dx  → phải có BÌNH PHƯƠNG [f(x)]².
- CHO HỌC SINH ĐỌC ĐƯỢC: BẮT BUỘC dùng Unicode, KHÔNG LaTeX $...$. Ví dụ: π, ∫, x², 1/2, √, ∞, ∈, ℝ, ⇒.
- Đáp án đúng phải copy đúng ký hiệu từ slide (∈, ℝ, π, ∫, ², √, ...).

QUY TẮC CHUNG:
- Mỗi đáp án là CÂU HOÀN CHỈNH, không rời rạc (SAI: "f(x)", "dx", "S =" riêng lẻ).
- Đúng 4 đáp án A/B/C/D. correctIndex 0–3 (0=A, 1=B, 2=C, 3=D).
- QUAN TRỌNG: Đặt đáp án đúng ở vị trí NGẪU NHIÊN (0, 1, 2 hoặc 3). Không luôn đặt ở A (0). Xáo trộn thứ tự 4 đáp án sao cho đúng đôi khi ở B, C hoặc D.
- Ngôn ngữ: Tiếng Việt.
- Chỉ trả về JSON hợp lệ, không markdown.

NỘI DUNG SLIDE:
---
${fullContent.slice(0, 4000)}
---

Schema: ${QUIZ_SCHEMA}`
}

function parseAndShuffleQuizzes(rawText: string): Array<{ question: string; options: string[]; correctIndex: number }> | null {
  const cleaned = rawText.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
  const parsed = JSON.parse(cleaned) as { quizzes?: Array<{ question?: string; options?: string[]; correctIndex?: number }> }
  const quizzes = Array.isArray(parsed?.quizzes)
    ? parsed.quizzes
        .slice(0, 1)
        .filter((q) => q?.question && Array.isArray(q?.options) && q.options.length >= 4)
        .map((q) => ({
          ...q,
          options: (q.options ?? []).slice(0, 4),
          correctIndex: Math.max(0, Math.min(q.correctIndex ?? 0, 3)),
        }))
    : []
  if (quizzes.length === 0) return null
  return quizzes.map((q) => {
    const opts = (q.options ?? []).slice(0, 4)
    const correctIdx = Math.max(0, Math.min(q.correctIndex ?? 0, opts.length - 1))
    const indices = [0, 1, 2, 3].slice(0, opts.length)
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]]
    }
    const newOpts = indices.map((i) => opts[i])
    const newCorrectIdx = indices.indexOf(correctIdx)
    return { question: q.question ?? '', options: newOpts, correctIndex: newCorrectIdx }
  })
}

/** AI tạo 1 câu trắc nghiệm cho một slide */
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

    const prompt = buildQuizPrompt(fullContent)
    const genAI = new GoogleGenerativeAI(apiKey)

    // Bước 1: Gemini Pro tạo
    const model = genAI.getGenerativeModel({
      ...QUIZ_CREATE_MODEL,
      generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
    })
    const result = await model.generateContent(prompt)
    let rawText = result.response.text()?.trim() || ''
    let shuffled = parseAndShuffleQuizzes(rawText)

    // Nếu Gemini không parse được, thử GPT retry
    if (!shuffled && process.env.OPENAI_API_KEY?.trim()) {
      const gptRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: GPT_RETRY_MODEL,
          temperature: 0.1,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'Trả về đúng JSON theo schema. Không markdown.' },
            { role: 'user', content: prompt },
          ],
        }),
      })
      if (gptRes.ok) {
        const gptData = (await gptRes.json().catch(() => ({}))) as { choices?: Array<{ message?: { content?: string } }> }
        rawText = String(gptData?.choices?.[0]?.message?.content ?? '').trim()
        shuffled = parseAndShuffleQuizzes(rawText)
      }
    }

    if (!shuffled || shuffled.length === 0) {
      return NextResponse.json({ error: 'AI không tạo được câu hỏi.' }, { status: 500 })
    }

    let shuffledFinal = shuffled

    // Kiểm tra chéo: DeepSeek Reasoner verify (lỗi → fallback Gemini 2.5 Flash). Nếu sai → GPT tạo lại → verify lần 2
    const shouldVerify = process.env.SLIDE_QUIZ_VERIFY !== 'false' && process.env.SLIDE_QUIZ_VERIFY !== '0'
    const deepSeekKey = process.env.DEEPSEEK_API_KEY?.trim()

    const DEEPSEEK_VERIFY_MODEL = process.env.DEEPSEEK_VERIFY_MODEL?.trim() || 'deepseek-reasoner'

    const runVerify = async (q: { question: string; options: string[]; correctIndex: number }): Promise<{ verified: boolean; correctIndex?: number } | null> => {
      const opts = q.options ?? []
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

Đáp án hiện tại được đánh dấu đúng: ${String.fromCharCode(65 + (q.correctIndex ?? 0))} (${opts[q.correctIndex ?? 0] ?? ''})

Nhiệm vụ: Đáp án này có ĐÚNG theo nội dung slide không? Nếu SAI, đáp án đúng phải là A/B/C/D nào?

Trả về JSON: { "verified": true|false, "correctIndex": 0|1|2|3 }
- verified: true nếu đáp án hiện tại đúng, false nếu sai
- correctIndex: chỉ cần khi verified=false, chỉ số (0-3) của đáp án đúng theo slide`

      // Ưu tiên DeepSeek Reasoner; lỗi thì fallback Gemini 2.5 Flash
      if (deepSeekKey) {
        try {
          const dsRes = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deepSeekKey}` },
            body: JSON.stringify({
              model: DEEPSEEK_VERIFY_MODEL,
              temperature: 0,
              messages: [
                { role: 'system', content: 'Trả về đúng JSON theo yêu cầu, không markdown.' },
                { role: 'user', content: verifyPrompt },
              ],
            }),
          })
          if (dsRes.ok) {
            const dsData = (await dsRes.json().catch(() => ({}))) as { choices?: Array<{ message?: { content?: string } }> }
            const verifyText = String(dsData?.choices?.[0]?.message?.content ?? '').trim()
            if (verifyText) {
              const cleaned = verifyText.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
              const v = JSON.parse(cleaned) as { verified?: boolean; correctIndex?: number }
              return { verified: v.verified === true, correctIndex: v.correctIndex }
            }
          }
        } catch (e) {
          console.warn('[slide-generate-quiz] DeepSeek verify lỗi, fallback Gemini:', e instanceof Error ? e.message : e)
        }
      }
      if (apiKey) {
        const verifyModel = genAI.getGenerativeModel({
          ...GEMINI_25_FLASH_NO_THINKING,
          generationConfig: { temperature: 0, responseMimeType: 'application/json' },
        })
        const verifyResult = await verifyModel.generateContent(verifyPrompt)
        const verifyText = verifyResult.response.text()?.trim() || ''
        if (verifyText) {
          const cleaned = verifyText.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
          const v = JSON.parse(cleaned) as { verified?: boolean; correctIndex?: number }
          return { verified: v.verified === true, correctIndex: v.correctIndex }
        }
      }
      return null
    }

    if (shouldVerify && shuffledFinal.length > 0) {
      const q = shuffledFinal[0]
      try {
        let verifyResult = await runVerify(q)
        if (verifyResult && !verifyResult.verified && typeof verifyResult.correctIndex === 'number' && verifyResult.correctIndex >= 0 && verifyResult.correctIndex <= 3) {
          // DeepSeek báo sai: dùng GPT tạo lại
          const openAiKey = process.env.OPENAI_API_KEY?.trim()
          if (openAiKey) {
            const gptRes = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openAiKey}` },
              body: JSON.stringify({
                model: GPT_RETRY_MODEL,
                temperature: 0.1,
                response_format: { type: 'json_object' },
                messages: [
                  { role: 'system', content: 'Trả về đúng JSON theo schema. Không markdown.' },
                  { role: 'user', content: prompt },
                ],
              }),
            })
            if (gptRes.ok) {
              const gptData = (await gptRes.json().catch(() => ({}))) as { choices?: Array<{ message?: { content?: string } }> }
              const gptText = String(gptData?.choices?.[0]?.message?.content ?? '').trim()
              const retried = parseAndShuffleQuizzes(gptText)
              if (retried && retried.length > 0) {
                const q2 = retried[0]
                verifyResult = await runVerify(q2)
                if (verifyResult?.verified) {
                  shuffledFinal = retried
                } else if (verifyResult && !verifyResult.verified && typeof verifyResult.correctIndex === 'number' && verifyResult.correctIndex >= 0 && verifyResult.correctIndex <= 3) {
                  shuffledFinal = [{ ...q2, correctIndex: verifyResult.correctIndex }]
                }
              }
            } else {
              shuffledFinal = [{ ...q, correctIndex: verifyResult.correctIndex }]
            }
          } else {
            shuffledFinal = [{ ...q, correctIndex: verifyResult.correctIndex }]
          }
        } else if (verifyResult && !verifyResult.verified && typeof verifyResult.correctIndex === 'number' && verifyResult.correctIndex >= 0 && verifyResult.correctIndex <= 3) {
          shuffledFinal = [{ ...q, correctIndex: verifyResult.correctIndex }]
        }
      } catch {
        // Nếu verify lỗi, giữ nguyên
      }
    }

    const DELIM = '\x1f'
    const markers = shuffledFinal.map((q) => {
      const opts = (q.options ?? []).join(DELIM)
      const idx = Math.max(0, Math.min(q.correctIndex ?? 0, (q.options?.length ?? 1) - 1))
      return `[quiz:${q.question}${DELIM}${opts}${DELIM}${idx}]`
    })

    return NextResponse.json({ markers, quizzes: shuffledFinal })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[slide-generate-quiz] Lỗi:', msg)
    return NextResponse.json({ error: `Lỗi: ${msg}` }, { status: 500 })
  }
}
