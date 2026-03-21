import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_FLASH_NO_THINKING, GEMINI_25_PRO } from '@/lib/gemini-config'

/** Model tạo / sửa quiz: Gemini 2.5 Pro. */
const QUIZ_CREATE_MODEL = GEMINI_25_PRO

const QUIZ_SCHEMA = `{
  "quizzes": [
    {
      "question": "Câu hỏi trắc nghiệm ngắn gọn?",
      "options": ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
      "correctIndex": 0
    }
  ]
}`

type LessonContext = {
  topic?: string
  allSlideTitles?: string[]
  currentSlideIndex?: number
  totalSlides?: number
}

type Difficulty = 'easy' | 'medium' | 'hard'

const DIFFICULTY_PROMPT: Record<Difficulty, string> = {
  easy: 'Độ khó DỄ: câu hỏi nhận biết, kiến thức cơ bản, áp dụng trực tiếp công thức/định nghĩa.',
  medium: 'Độ khó TRUNG BÌNH: câu hỏi thông hiểu, vận dụng đơn giản, cần suy luận nhẹ.',
  hard: 'Độ khó KHÓ: câu hỏi vận dụng cao, phân tích, tổng hợp, đáp án nhiễu tinh vi.',
}

function buildQuizPrompt(fullContent: string, lessonContext?: LessonContext, difficulty: Difficulty = 'medium'): string {
  const contextBlock =
    lessonContext?.topic || (lessonContext?.allSlideTitles && lessonContext.allSlideTitles.length > 0)
      ? `
BÀI HỌC / GIÁO TRÌNH (ngữ cảnh):
- Chủ đề bài học: ${lessonContext?.topic ?? '(không có)'}
- Các slide trong bài: ${(lessonContext?.allSlideTitles ?? []).map((t, i) => `${i + 1}. ${t}`).join(' | ')}
- Slide hiện tại: ${(lessonContext?.currentSlideIndex ?? 0) + 1}/${lessonContext?.totalSlides ?? 1}

QUAN TRỌNG: Câu hỏi phải BÁM SÁT NỘI DUNG BÀI HỌC, không chỉ hỏi ý nhỏ của 1 slide. Nếu slide chỉ là mục con/tiêu đề phụ, câu hỏi nên kiểm tra kiến thức tổng hợp của bài (công thức chính, định nghĩa quan trọng, quy tắc cốt lõi). Tránh câu hỏi quá ngắn, quá hẹp, không phản ánh mục tiêu bài học.
`
      : ''

  const diffHint = DIFFICULTY_PROMPT[difficulty] ?? DIFFICULTY_PROMPT.medium
  return `Bạn là giáo viên chuyên môn. Tạo ĐÚNG 1 câu trắc nghiệm CHUẨN, CHÍNH XÁC từ nội dung slide VÀ BÁM SÁT BÀI HỌC.

${diffHint}

${contextBlock}
QUY TRÌNH BẮT BUỘC:
1. ĐỌC KỸ slide hiện tại VÀ ngữ cảnh bài học. Xác định kiến thức CỐT LÕI cần kiểm tra (công thức/định nghĩa/quy tắc quan trọng của bài).
2. Tạo đáp án ĐÚNG trước – phải khớp 100% với nội dung slide/bài, không thiếu ký hiệu.
3. Tạo 3 đáp án SAI – plausible nhưng rõ ràng sai (thiếu dấu, sai công thức, nhầm khái niệm).

QUY TẮC CÔNG THỨC TOÁN (BẮT BUỘC):
- Diện tích hình phẳng: S = ∫|f(x)|dx  → phải có TRỊ TUYỆT ĐỐI |f(x)|.
- Thể tích khối tròn xoay quanh Ox: V = π∫[f(x)]²dx  → phải có BÌNH PHƯƠNG [f(x)]².
- CHO HỌC SINH ĐỌC ĐƯỢC: BẮT BUỘC dùng Unicode, KHÔNG LaTeX $...$. Ví dụ: π, ∫, x², 1/2, √, ∞, ∈, ℝ, ⇒.
- Đáp án đúng phải copy đúng ký hiệu từ slide (∈, ℝ, π, ∫, ², √, ...).
- BẢNG BIẾN THIÊN: Nếu câu hỏi có bảng biến thiên, dùng cú pháp [bien_thien]x:-∞,-2,0,2,+∞|f'(x):+,0,-,0,+|f(x):↗,↘,↗,↘,↗[/bien_thien] (dấu | phân tách các hàng, dấu , phân tách ô; ↗↘ cho chiều biến thiên).

QUY TẮC CHUNG:
- Mỗi đáp án là CÂU HOÀN CHỈNH, không rời rạc (SAI: "f(x)", "dx", "S =" riêng lẻ).
- Đúng 4 đáp án A/B/C/D. correctIndex 0–3 (0=A, 1=B, 2=C, 3=D).
- QUAN TRỌNG: Đặt đáp án đúng ở vị trí NGẪU NHIÊN (0, 1, 2 hoặc 3). Không luôn đặt ở A (0). Xáo trộn thứ tự 4 đáp án sao cho đúng đôi khi ở B, C hoặc D.
- Ngôn ngữ: Tiếng Việt.
- Chỉ trả về JSON hợp lệ, không markdown.

NỘI DUNG SLIDE HIỆN TẠI:
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

/** Lần 2: Gemini Pro với nhắc schema — khi lần 1 trả JSON không parse được. */
async function generateQuizRetryParseWithGeminiPro(
  genAI: GoogleGenerativeAI,
  basePrompt: string
): Promise<Array<{ question: string; options: string[]; correctIndex: number }> | null> {
  const model = genAI.getGenerativeModel({
    ...GEMINI_25_PRO,
    generationConfig: { temperature: 0.15, responseMimeType: 'application/json' },
  })
  const result = await model.generateContent(
    `${basePrompt}\n\n⚠️ BẮT BUỘC: chỉ một object JSON hợp lệ, đúng schema "quizzes" (mảng 1 phần tử). Không markdown, không text ngoài JSON.`
  )
  const raw = result.response.text()?.trim() || ''
  return parseAndShuffleQuizzes(raw)
}

/**
 * Verify (Flash) báo sai → Gemini 2.5 Pro sửa lại câu + 4 đáp án cho khớp slide.
 * `suggestedCorrectIndex`: gợi ý từ bước verify (0–3), có thể undefined.
 */
async function fixQuizWithGeminiProForSlide(
  genAI: GoogleGenerativeAI,
  fullContent: string,
  q: { question: string; options: string[]; correctIndex: number },
  suggestedCorrectIndex: number | undefined,
  lessonContext: LessonContext | undefined,
  difficulty: Difficulty
): Promise<Array<{ question: string; options: string[]; correctIndex: number }> | null> {
  const diffHint = DIFFICULTY_PROMPT[difficulty] ?? DIFFICULTY_PROMPT.medium
  const ctx =
    lessonContext?.topic || (lessonContext?.allSlideTitles && lessonContext.allSlideTitles.length > 0)
      ? `Ngữ cảnh bài: chủ đề "${lessonContext?.topic ?? ''}"; slide ${(lessonContext?.currentSlideIndex ?? 0) + 1}/${lessonContext?.totalSlides ?? 1}.\n`
      : ''
  const suggest =
    suggestedCorrectIndex != null && suggestedCorrectIndex >= 0 && suggestedCorrectIndex <= 3
      ? `Bước kiểm tra (Flash) cho rằng đáp án đúng theo slide là **${String.fromCharCode(65 + suggestedCorrectIndex)}** (index ${suggestedCorrectIndex}). ` +
        `Hãy sửa CÂU HỎI và/hoặc các đáp án nếu cần để mọi thứ khớp 100% slide; correctIndex phải là 0–3.\n\n`
      : 'Câu trắc nghiệm không khớp nội dung slide. Sửa lại toàn bộ (câu hỏi + 4 đáp án + chỉ số đúng) cho đúng slide.\n\n'

  const prompt = `Bạn là giáo viên chuyên môn. ${ctx}${suggest}${diffHint}

NỘI DUNG SLIDE (căn cứ duy nhất để sửa):
---
${fullContent.slice(0, 4000)}
---

CÂU HIỆN TẠI (bắt buộc sửa từ đây — không đổi sang chủ đề khác):
Câu hỏi: ${q.question}
A. ${q.options[0] ?? ''}
B. ${q.options[1] ?? ''}
C. ${q.options[2] ?? ''}
D. ${q.options[3] ?? ''}
Đáp án đang đánh dấu: ${String.fromCharCode(65 + q.correctIndex)} (index ${q.correctIndex})

QUY TẮC: Unicode (π, ∫, x²…), không LaTeX $...$. 4 đáp án đủ, correctIndex 0–3.
Trả về JSON đúng schema: ${QUIZ_SCHEMA}
Chỉ 1 phần tử trong "quizzes".`

  const model = genAI.getGenerativeModel({
    ...GEMINI_25_PRO,
    generationConfig: { temperature: 0, responseMimeType: 'application/json' },
  })
  const result = await model.generateContent(prompt)
  const raw = result.response.text()?.trim() || ''
  return parseAndShuffleQuizzes(raw)
}

/** AI tạo 1 câu trắc nghiệm cho một slide */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const title = String(body?.title ?? '').trim()
    const content = String(body?.content ?? '').trim()
    const blocks = Array.isArray(body?.blocks) ? body.blocks as Array<{ header?: string; content?: string }> : []
    const difficultyRaw = String(body?.difficulty ?? 'medium').toLowerCase()
    const difficulty: Difficulty = ['easy', 'medium', 'hard'].includes(difficultyRaw) ? (difficultyRaw as Difficulty) : 'medium'

    const lessonContext: LessonContext | undefined =
      body?.lessonContext && typeof body.lessonContext === 'object'
        ? {
            topic: String(body.lessonContext.topic ?? '').trim() || undefined,
            allSlideTitles: Array.isArray(body.lessonContext.allSlideTitles)
              ? (body.lessonContext.allSlideTitles as string[]).map((t) => String(t ?? '').trim()).filter(Boolean)
              : undefined,
            currentSlideIndex: typeof body.lessonContext.currentSlideIndex === 'number' ? body.lessonContext.currentSlideIndex : undefined,
            totalSlides: typeof body.lessonContext.totalSlides === 'number' ? body.lessonContext.totalSlides : undefined,
          }
        : undefined

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

    const prompt = buildQuizPrompt(fullContent, lessonContext, difficulty)
    const genAI = new GoogleGenerativeAI(apiKey)

    // Bước 1: Gemini Pro tạo
    const model = genAI.getGenerativeModel({
      ...QUIZ_CREATE_MODEL,
      generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
    })
    const result = await model.generateContent(prompt)
    let rawText = result.response.text()?.trim() || ''
    let shuffled = parseAndShuffleQuizzes(rawText)

    // Lần 1 không parse được → Gemini Pro gọi lại (không dùng GPT)
    if (!shuffled) {
      shuffled = await generateQuizRetryParseWithGeminiPro(genAI, prompt)
    }

    if (!shuffled || shuffled.length === 0) {
      return NextResponse.json({ error: 'AI không tạo được câu hỏi.' }, { status: 500 })
    }

    let shuffledFinal = shuffled

    // Kiểm tra chéo: Gemini 2.5 Flash verify. Nếu sai → Gemini 2.5 Pro sửa câu → verify lần 2
    const shouldVerify = process.env.SLIDE_QUIZ_VERIFY !== 'false' && process.env.SLIDE_QUIZ_VERIFY !== '0'

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
        if (verifyResult && !verifyResult.verified) {
          const suggested =
            typeof verifyResult.correctIndex === 'number' &&
            verifyResult.correctIndex >= 0 &&
            verifyResult.correctIndex <= 3
              ? verifyResult.correctIndex
              : undefined
          const retried = await fixQuizWithGeminiProForSlide(
            genAI,
            fullContent,
            q,
            suggested,
            lessonContext,
            difficulty
          )
          if (retried && retried.length > 0) {
            const q2 = retried[0]!
            verifyResult = await runVerify(q2)
            if (verifyResult?.verified) {
              shuffledFinal = retried
            } else if (
              verifyResult &&
              !verifyResult.verified &&
              typeof verifyResult.correctIndex === 'number' &&
              verifyResult.correctIndex >= 0 &&
              verifyResult.correctIndex <= 3
            ) {
              shuffledFinal = [{ ...q2, correctIndex: verifyResult.correctIndex }]
            } else {
              shuffledFinal = retried
            }
          } else if (suggested !== undefined) {
            shuffledFinal = [{ ...q, correctIndex: suggested }]
          }
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
