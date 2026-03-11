/**
 * Logic AI chung cho quiz: verify đáp án, tạo câu mới.
 * Dùng bởi slide-generate-quiz, slide-verify-quiz, slide-quiz-report.
 */
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_FLASH_NO_THINKING, GEMINI_25_PRO } from '@/lib/gemini-config'

const QUIZ_SCHEMA = `{
  "quizzes": [
    {
      "question": "Câu hỏi trắc nghiệm ngắn gọn?",
      "options": ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
      "correctIndex": 0
    }
  ]
}`

export type QuizData = { question: string; options: string[]; correctIndex: number }

export function buildVerifyPrompt(
  fullContent: string,
  q: { question: string; options: string[]; correctIndex: number }
): string {
  const opts = q.options ?? []
  return `Bạn là giáo viên kiểm tra chất lượng. Đối chiếu nội dung slide với câu hỏi trắc nghiệm.

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
}

export function buildCreatePrompt(fullContent: string): string {
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

export function parseAndShuffleQuizzes(rawText: string): QuizData[] | null {
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
      const j = Math.floor(Math.random() * (i + 1))
      ;[indices[i], indices[j]] = [indices[j], indices[i]]
    }
    const newOpts = indices.map((i) => opts[i])
    const newCorrectIdx = indices.indexOf(correctIdx)
    return { question: q.question ?? '', options: newOpts, correctIndex: newCorrectIdx }
  })
}

export async function verifyQuizWithAI(
  fullContent: string,
  q: QuizData
): Promise<{ verified: boolean; correctIndex?: number } | null> {
  const verifyPrompt = buildVerifyPrompt(fullContent, q)
  const apiKey = process.env.GOOGLE_API_KEY?.trim()
  const deepSeekKey = process.env.DEEPSEEK_API_KEY?.trim()
  const DEEPSEEK_VERIFY_MODEL = process.env.DEEPSEEK_VERIFY_MODEL?.trim() || 'deepseek-reasoner'

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
      console.warn('[quiz-ai] DeepSeek verify lỗi, fallback Gemini:', e instanceof Error ? e.message : e)
    }
  }
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
      return { verified: v.verified === true, correctIndex: v.correctIndex }
    }
  }
  return null
}

/** Gemini 2.5 Pro tạo câu mới + DeepSeek verify */
export async function createQuizWithGemini(fullContent: string): Promise<{ quiz: QuizData; marker: string } | null> {
  const apiKey = process.env.GOOGLE_API_KEY?.trim()
  if (!apiKey) return null
  const prompt = buildCreatePrompt(fullContent)
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    ...GEMINI_25_PRO,
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
  })
  const result = await model.generateContent(prompt)
  const rawText = result.response.text()?.trim() || ''
  const shuffled = parseAndShuffleQuizzes(rawText)
  if (!shuffled || shuffled.length === 0) return null
  return { quiz: shuffled[0], marker: quizToMarker(shuffled[0]) }
}

/** GPT tạo câu mới (model: gpt-4o hoặc QUIZ_REPORT_GPT_MODEL) */
export async function createQuizWithGPT(fullContent: string): Promise<{ quiz: QuizData; marker: string } | null> {
  const openAiKey = process.env.OPENAI_API_KEY?.trim()
  const model = process.env.QUIZ_REPORT_GPT_MODEL?.trim() || 'gpt-4o'
  if (!openAiKey) return null
  const prompt = buildCreatePrompt(fullContent)
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openAiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Trả về đúng JSON theo schema. Không markdown.' },
        { role: 'user', content: prompt },
      ],
    }),
  })
  if (!res.ok) return null
  const data = (await res.json().catch(() => ({}))) as { choices?: Array<{ message?: { content?: string } }> }
  const rawText = String(data?.choices?.[0]?.message?.content ?? '').trim()
  const shuffled = parseAndShuffleQuizzes(rawText)
  if (!shuffled || shuffled.length === 0) return null
  return { quiz: shuffled[0], marker: quizToMarker(shuffled[0]) }
}

const DELIM = '\x1f'
export function quizToMarker(q: QuizData): string {
  const opts = (q.options ?? []).join(DELIM)
  const idx = Math.max(0, Math.min(q.correctIndex ?? 0, (q.options?.length ?? 1) - 1))
  return `[quiz:${q.question}${DELIM}${opts}${DELIM}${idx}]`
}

/** GPT kiểm tra: câu hỏi có sai không? (report lần 2) */
export async function checkQuizWrongWithGPT(
  fullContent: string,
  q: QuizData
): Promise<{ isWrong: boolean; reasoning: string } | null> {
  const openAiKey = process.env.OPENAI_API_KEY?.trim()
  const model = process.env.QUIZ_REPORT_GPT_MODEL?.trim() || 'gpt-4o'
  if (!openAiKey) return null
  const opts = q.options ?? []
  const prompt = `Bạn là giáo viên kiểm tra chất lượng. Giáo viên đã báo câu hỏi trắc nghiệm này SAI lần 2. Đối chiếu với nội dung slide.

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

Trả về JSON: { "isWrong": true|false, "reasoning": "Lập luận chi tiết cho giáo viên" }
- isWrong: true nếu câu hỏi/đáp án sai, false nếu đúng
- reasoning: giải thích rõ ràng để giáo viên hiểu`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openAiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Trả về đúng JSON theo yêu cầu, không markdown.' },
        { role: 'user', content: prompt },
      ],
    }),
  })
  if (!res.ok) return null
  const data = (await res.json().catch(() => ({}))) as { choices?: Array<{ message?: { content?: string } }> }
  const rawText = String(data?.choices?.[0]?.message?.content ?? '').trim()
  if (!rawText) return null
  try {
    const cleaned = rawText.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
    const v = JSON.parse(cleaned) as { isWrong?: boolean; reasoning?: string }
    return { isWrong: v.isWrong === true, reasoning: v.reasoning ?? '' }
  } catch {
    return null
  }
}

/** Gemini 2.5 Pro kiểm tra: câu hỏi có sai không? Trả về lập luận + kết luận. */
export async function checkQuizWrongWithGemini(
  fullContent: string,
  q: QuizData
): Promise<{ isWrong: boolean; reasoning: string } | null> {
  const apiKey = process.env.GOOGLE_API_KEY?.trim()
  if (!apiKey) return null
  const opts = q.options ?? []
  const prompt = `Bạn là giáo viên kiểm tra chất lượng. Giáo viên báo câu hỏi trắc nghiệm này SAI. Đối chiếu với nội dung slide.

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

Trả về JSON: { "isWrong": true|false, "reasoning": "Lập luận chi tiết cho giáo viên" }
- isWrong: true nếu câu hỏi/đáp án sai, false nếu đúng
- reasoning: giải thích rõ ràng để giáo viên hiểu`

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    ...GEMINI_25_PRO,
    generationConfig: { temperature: 0, responseMimeType: 'application/json' },
  })
  const result = await model.generateContent(prompt)
  const rawText = result.response.text()?.trim() || ''
  if (!rawText) return null
  try {
    const cleaned = rawText.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
    const v = JSON.parse(cleaned) as { isWrong?: boolean; reasoning?: string }
    return { isWrong: v.isWrong === true, reasoning: v.reasoning ?? '' }
  } catch {
    return null
  }
}
