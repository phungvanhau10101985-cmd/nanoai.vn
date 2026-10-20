import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_PRO } from '@/lib/gemini-config'
import { trackCurriculumGeminiResult } from '@/lib/curriculum-api-usage'
import {
  applyCurriculumMathMarks,
  CURRICULUM_MATH_CHECK_RULES,
  findCurriculumMathFailures,
  isCurriculumMathSubject,
  type CurriculumMathIssueKind,
} from '@/app/tao-giao-trinh/lib/curriculum-math-check'

function parseRepairJson(text: string): Record<string, unknown> {
  const cleaned = String(text || '')
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim()
  if (!cleaned) return {}
  return JSON.parse(cleaned) as Record<string, unknown>
}

async function rewriteExerciseWithGemini(
  block: string,
  message: string,
  kind: CurriculumMathIssueKind,
  userId: string | null
): Promise<string | null> {
  const apiKey = process.env.GOOGLE_API_KEY?.trim()
  if (!apiKey) return null
  const task =
    kind === 'unverified'
      ? `Viết lại đúng một bài toán thành ví dụ tự đặt cùng kỹ năng. Bài phải có kết quả số hoặc biểu thức để code tính. ${message}`
      : `Viết lại đúng một bài trong giáo trình. Code đã tính lại và báo: ${message}
Giữ cùng dạng kiến thức. Sửa số liệu hoặc sửa câu kết luận để phép tính khớp.`
  const prompt = `${task}
Viết đề ngắn và lời giải ngắn. Thêm một dòng kiểm tra.
${CURRICULUM_MATH_CHECK_RULES}
Không kể lại lỗi cũ. Không chép đề sách. Không thêm <!-- curriculum-math-teacher-ok -->.
Chỉ trả JSON {"markdown":"..."}

Bài cần viết lại:
${block.slice(0, 6000)}`
  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      ...GEMINI_25_PRO,
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
    })
    const result = await model.generateContent(prompt)
    trackCurriculumGeminiResult(result, GEMINI_25_PRO.model, 'curriculum-math-repair', userId)
    const parsed = parseRepairJson(result.response.text() || '')
    const markdown = String(parsed.markdown || '').trim()
    return markdown || null
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[curriculum-math-repair] Gemini viết lại bài lỗi:', msg.slice(0, 400))
    return null
  }
}

/** Môn Toán: viết lại từng bài lệch hoặc chưa kiểm được, rồi code chấm lại. Môn khác chỉ giữ dấu khi dòng kiểm tra đã có mà tính lệch. */
export async function repairThenMarkLessonMarkdown(
  markdown: string,
  userId: string | null,
  subjectId?: string | null
): Promise<string> {
  const options = { subjectId }
  if (!isCurriculumMathSubject(subjectId)) return applyCurriculumMathMarks(markdown, options)
  let md = markdown
  const skipped = new Set<string>()
  for (let attempt = 0; attempt < 8; attempt++) {
    const all = findCurriculumMathFailures(md, options)
    if (all.length === 0) return md
    const failure = all.find((item) => !skipped.has(md.slice(item.start, item.end).trim()))
    if (!failure) break
    const block = md.slice(failure.start, failure.end)
    const rewritten = await rewriteExerciseWithGemini(block, failure.message, failure.kind, userId)
    if (rewritten && findCurriculumMathFailures(rewritten, options).length === 0) {
      md = `${md.slice(0, failure.start)}${rewritten.trim()}\n${md.slice(failure.end)}`
      continue
    }
    skipped.add(block.trim())
  }
  return applyCurriculumMathMarks(md, options)
}
