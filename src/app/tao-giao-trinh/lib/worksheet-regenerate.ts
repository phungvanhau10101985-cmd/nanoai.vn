/**
 * Tạo lại 1 câu trắc nghiệm hoặc 1 bài tự luận bằng Gemini (Flash hoặc Pro).
 * Dùng khi DeepSeek verify thất bại – retry với model mạnh hơn.
 */
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_FLASH_NO_THINKING, GEMINI_25_PRO } from '@/lib/gemini-config'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import { normalizeSolutionToStr } from './worksheet-content-json'


const QUIZ_SCHEMA = `{"quizzes":[{"question":"Câu hỏi?","options":["A","B","C","D"],"correctIndex":0}]}`
const ESSAY_SCHEMA = `{"problem":"Đề bài (câu hỏi)","solution":"Lời giải chi tiết từng bước"}`

function buildQuizPrompt(curriculum: string, topic: string): string {
  return `Bạn là giáo viên. Tạo ĐÚNG 1 câu trắc nghiệm từ GIÁO TRÌNH.

⚠️ QUY TẮC SỐ 1 – KHÔNG tạo câu hỏi bắt buộc nhìn đồ thị/ảnh để trả lời. Phiếu tạo mới không kèm hình. Phải cho hàm số cụ thể hoặc bảng biến thiên bằng chữ.

QUY TẮC: Unicode (π, ∫, x², √, ∈, ℝ), 4 đáp án A/B/C/D, correctIndex 0-3. Tiếng Việt.
KHÔNG tạo câu trắc nghiệm thiếu phần mở đầu và phần đặt câu hỏi. Mỗi câu phải có: (1) phần mở đầu/ngữ cảnh, (2) phần đặt câu hỏi rõ ràng. CẤM mở đầu bằng bảng/số.
CẤM hàm số ax⁴+bx²+c chưa cho a,b,c – phải ghi rõ giá trị cụ thể.
Chỉ trả về JSON, không markdown.

GIÁO TRÌNH:
---
${curriculum.slice(0, 6000)}
---

Chủ đề: ${topic}

Schema: ${QUIZ_SCHEMA}`
}

function buildEssayPrompt(curriculum: string, topic: string): string {
  return `Bạn là giáo viên. Tạo ĐÚNG 1 BÀI TỰ LUẬN (đề + lời giải) từ GIÁO TRÌNH.

QUY TẮC:
- Unicode: π, ∫, x², √, ∈, ℝ, ⇒. KHÔNG LaTeX.
- Phân số: 1/2 hoặc ½. Căn: √(x+1).
- Đề bài rõ ràng. Lời giải từng bước, logic.
- CẤM hàm số thiếu tham số để vẽ đồ thị. Phải ghi rõ giá trị cụ thể.
- CẤM tạo đề bắt nhìn đồ thị/ảnh. Phiếu tạo mới không kèm hình.
- Chỉ trả về JSON, không markdown.

GIÁO TRÌNH:
---
${curriculum.slice(0, 6000)}
---

Chủ đề: ${topic}

Schema: ${ESSAY_SCHEMA}`
}

function parseQuiz(raw: string): { question: string; options: string[]; correctIndex: number } | null {
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
    const p = JSON.parse(cleaned) as { quizzes?: Array<{ question?: string; options?: string[]; correctIndex?: number }> }
    const q = Array.isArray(p?.quizzes) ? p.quizzes[0] : null
    if (!q?.question || !Array.isArray(q.options) || q.options.length < 4) return null
    const opts = q.options.slice(0, 4)
    const correctIndex = Math.max(0, Math.min(q.correctIndex ?? 0, 3))
    return { question: q.question, options: opts, correctIndex }
  } catch {
    return null
  }
}

function parseEssay(raw: string): { problem: string; solution: string } | null {
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
    const p = JSON.parse(cleaned) as { problem?: string; solution?: unknown }
    if (!p?.problem) return null
    const solution = normalizeSolutionToStr(p.solution) || String(p.solution ?? '').trim()
    if (!solution) return null
    return { problem: p.problem, solution }
  } catch {
    return null
  }
}

export type RegenerateModel = 'flash' | 'pro'

/** Tạo lại 1 câu trắc nghiệm. */
export async function regenerateQuiz(
  curriculum: string,
  topic: string,
  model: RegenerateModel,
  userId?: string | null
): Promise<{ question: string; options: string[]; correctIndex: number } | null> {
  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) return null
  const genAI = new GoogleGenerativeAI(apiKey)
  const geminiModel = model === 'pro' ? GEMINI_25_PRO : GEMINI_25_FLASH_NO_THINKING
  const m = genAI.getGenerativeModel({
    ...geminiModel,
    generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
  })
  const result = await m.generateContent(buildQuizPrompt(curriculum, topic))
  void trackFromUsageMetadata(
    result.response.usageMetadata,
    geminiModel.model,
    model === 'pro' ? 'worksheet-regenerate-quiz-gemini-pro' : 'worksheet-regenerate-quiz-gemini-flash',
    userId ?? null
  )
  const raw = result.response.text()?.trim() || ''
  return parseQuiz(raw)
}

/** Tạo lại 1 bài tự luận. */
export async function regenerateEssay(
  curriculum: string,
  topic: string,
  model: RegenerateModel,
  userId?: string | null
): Promise<{ problem: string; solution: string } | null> {
  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) return null
  const genAI = new GoogleGenerativeAI(apiKey)
  const geminiModel = model === 'pro' ? GEMINI_25_PRO : GEMINI_25_FLASH_NO_THINKING
  const m = genAI.getGenerativeModel({
    ...geminiModel,
    generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
  })
  const result = await m.generateContent(buildEssayPrompt(curriculum, topic))
  void trackFromUsageMetadata(
    result.response.usageMetadata,
    geminiModel.model,
    model === 'pro' ? 'worksheet-regenerate-essay-gemini-pro' : 'worksheet-regenerate-essay-gemini-flash',
    userId ?? null
  )
  const raw = result.response.text()?.trim() || ''
  return parseEssay(raw)
}

/** Sửa câu trắc nghiệm khi verify sai nhưng không trả về fix. Gọi thêm 1 lần với prompt "sửa". */
export async function fixQuizWhenVerifyFailed(
  curriculum: string,
  q: { question: string; options: string[]; correctIndex: number },
  userId?: string | null
): Promise<{ question: string; options: string[]; correctIndex: number } | null> {
  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) return null
  const prompt = `Câu trắc nghiệm sau SAI so với giáo trình. BẮT BUỘC sửa CÂU NÀY (không tạo câu khác, không lấy câu khác từ giáo trình). Chỉ sửa phần sai, giữ cấu trúc tương tự.

GIÁO TRÌNH:
---
${curriculum.slice(0, 4000)}
---

CÂU CẦN SỬA (bắt buộc sửa đúng câu này, không thay bằng câu khác):
Câu hỏi: ${q.question}
A. ${(q.options ?? [])[0] ?? ''}
B. ${(q.options ?? [])[1] ?? ''}
C. ${(q.options ?? [])[2] ?? ''}
D. ${(q.options ?? [])[3] ?? ''}
Đáp án hiện tại: ${String.fromCharCode(65 + q.correctIndex)}

Trả về JSON: {"question":"...","options":["A","B","C","D"],"correctIndex":0|1|2|3}`

  const genAI = new GoogleGenerativeAI(apiKey)
  const m = genAI.getGenerativeModel({
    ...GEMINI_25_PRO,
    generationConfig: { temperature: 0, responseMimeType: 'application/json' },
  })
  const result = await m.generateContent(prompt)
  void trackFromUsageMetadata(
    result.response.usageMetadata,
    GEMINI_25_PRO.model,
    'worksheet-regenerate-fix-quiz-gemini-pro',
    userId ?? null
  )
  const raw = result.response.text()?.trim() || ''
  try {
    const p = JSON.parse(raw.replace(/^```\w*\n?|```\s*$/g, '').trim()) as { question?: string; options?: string[]; correctIndex?: number }
    if (!p?.question || !Array.isArray(p.options) || p.options.length < 4) return null
    const opts = p.options.slice(0, 4)
    const idx = Math.max(0, Math.min(p.correctIndex ?? 0, 3))
    return { question: p.question, options: opts, correctIndex: idx }
  } catch {
    return null
  }
}

/** Sửa bài tự luận khi verify sai nhưng không trả về fix. */
export async function fixEssayWhenVerifyFailed(
  curriculum: string,
  e: { problem: string; solution: string },
  userId?: string | null
): Promise<{ problem: string; solution: string } | null> {
  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) return null
  const prompt = `Bài tự luận sau SAI so với giáo trình. BẮT BUỘC sửa BÀI NÀY (không tạo bài khác, không lấy bài khác từ giáo trình). Chỉ sửa phần sai, giữ cấu trúc tương tự.

GIÁO TRÌNH:
---
${curriculum.slice(0, 4000)}
---

BÀI CẦN SỬA (bắt buộc sửa đúng bài này, không thay bằng bài khác):
ĐỀ BÀI:
---
${e.problem}
---

LỜI GIẢI SAI:
---
${e.solution}
---

Trả về JSON: {"problem":"...","solution":"..."}`

  const genAI = new GoogleGenerativeAI(apiKey)
  const m = genAI.getGenerativeModel({
    ...GEMINI_25_PRO,
    generationConfig: { temperature: 0, responseMimeType: 'application/json' },
  })
  const result = await m.generateContent(prompt)
  void trackFromUsageMetadata(
    result.response.usageMetadata,
    GEMINI_25_PRO.model,
    'worksheet-regenerate-fix-essay-gemini-pro',
    userId ?? null
  )
  const raw = result.response.text()?.trim() || ''
  return parseEssay(raw)
}
