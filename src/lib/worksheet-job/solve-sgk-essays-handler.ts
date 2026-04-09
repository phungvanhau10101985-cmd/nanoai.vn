import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_PRO } from '@/lib/gemini-config'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import { questionsToMarkdown } from '@/app/tao-giao-trinh/lib/questions-to-markdown'
import { getEssayProblem, getEssaySolution, normalizeSolutionToStr } from '@/app/tao-giao-trinh/lib/worksheet-content-json'
import { isPgConfigured } from '@/lib/db/pool'
import { fetchWorksheetSheetOwnedByUserPg, fetchWorksheetQuestionsMarkdownRowsOrderedFromPg } from '@/lib/db/worksheet-pg'
import {
  fetchCurriculumContentMarkdownForVerifyPg,
  updateWorksheetQuestionContentJsonPg,
  updateWorksheetSheetContentMarkdownPg,
} from '@/lib/db/worksheet-verify-run-pg'

function essayNeedsImage(problem: string): boolean {
  const text = String(problem ?? '').toLowerCase()
  if (!text) return false
  return /đồ thị|hình vẽ|hình\s*\d+|hình minh họa|quan sát hình|biểu đồ|dựa vào hình|trên hình/.test(text)
}

async function fetchImageAsBase64(url: string): Promise<{ data: string; mimeType: string }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Fetch image failed: ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const contentType = res.headers.get('content-type') || 'image/png'
  const mimeType = contentType.split(';')[0]?.trim() || 'image/png'
  return { data: buf.toString('base64'), mimeType }
}

async function generateEssaySolution(
  problem: string,
  topic: string,
  curriculumMarkdown: string,
  apiKey: string,
  userId: string,
  imageParts?: Array<{ inlineData: { data: string; mimeType: string } }>
): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    ...GEMINI_25_PRO,
    generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
  })
  const context = curriculumMarkdown ? `\n\nGIÁO TRÌNH (tham khảo):\n---\n${curriculumMarkdown.slice(0, 4000)}\n---\n` : ''
  const prompt = `Bạn là giáo viên. Viết LỜI GIẢI CHI TIẾT TỪNG BƯỚC cho bài tập sau.${context}

ĐỀ BÀI:
---
${problem}
---

Chủ đề: ${topic}

QUY TẮC: Unicode (π, ∫, x², √, ∈, ℝ). Phân số: 1/2 hoặc ½. Lời giải phải đầy đủ, logic, từng bước.
QUAN TRỌNG: Chỉ viết MỘT lần lời giải. KHÔNG lặp lại nội dung. Kết quả trả về trong trường solution phải là nội dung thuần, KHÔNG thêm tiêu đề "Lời giải"/"Đáp án".
Trả về JSON: {"solution":"Lời giải chi tiết từng bước (chuỗi văn bản thuần)"}`

  const useVision = Array.isArray(imageParts) && imageParts.length > 0
  const result = useVision ? await model.generateContent([prompt, ...imageParts]) : await model.generateContent(prompt)
  void trackFromUsageMetadata(
    result.response.usageMetadata,
    GEMINI_25_PRO.model,
    'worksheet-solve-sgk-essay-solution-pro',
    userId
  )
  const raw = result.response.text()?.trim() || ''
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
    const p = JSON.parse(cleaned) as { solution?: unknown }
    return normalizeSolutionToStr(p?.solution) || ''
  } catch {
    return ''
  }
}

export type SolveSgkEssaysParams = {
  worksheetId: string
  curriculumMarkdown?: string
}

export type SolveSgkEssaysResult = {
  worksheetId: string
  worksheetMarkdown: string
  solvedCount: number
  pendingCount: number
  totalEssayCount: number
}

export async function runSolveSgkEssays(userId: string, params: SolveSgkEssaysParams): Promise<SolveSgkEssaysResult> {
  if (!isPgConfigured()) throw new Error('DATABASE_URL chưa cấu hình')

  const worksheetId = String(params.worksheetId ?? '').trim()
  if (!worksheetId) throw new Error('Thiếu worksheetId.')

  const apiKey = process.env.GOOGLE_API_KEY?.trim()
  if (!apiKey) throw new Error('Thiếu GOOGLE_API_KEY.')

  const ws = await fetchWorksheetSheetOwnedByUserPg(worksheetId, userId)
  if (!ws) throw new Error('Không tìm thấy phiếu bài tập.')

  const questionIds = ws.question_ids
  if (questionIds.length === 0) {
    return { worksheetId, worksheetMarkdown: '', solvedCount: 0, pendingCount: 0, totalEssayCount: 0 }
  }

  let curriculumMarkdown = String(params.curriculumMarkdown ?? '').trim()
  if (!curriculumMarkdown && ws.curriculum_id) {
    curriculumMarkdown = (await fetchCurriculumContentMarkdownForVerifyPg(ws.curriculum_id)) ?? ''
  }

  const qRows = await fetchWorksheetQuestionsMarkdownRowsOrderedFromPg(questionIds)
  if (!qRows || qRows.length !== questionIds.length) {
    throw new Error('Không đọc được câu hỏi trên phiếu.')
  }

  const ordered = qRows.map((r) => ({
    id: r.id,
    type: r.type,
    content_json: r.content_json,
    difficulty: r.difficulty ?? undefined,
    source: r.source ?? undefined,
    verified_at: r.verified_at,
  }))

  const essays = ordered.filter((q) => q.type === 'essay')
  const totalEssayCount = essays.length
  if (totalEssayCount === 0) {
    const worksheetMarkdown = questionsToMarkdown(
      ordered.map((r) => ({
        type: r.type,
        content_json: r.content_json,
        difficulty: r.difficulty,
        source: r.source,
        verified_at: r.verified_at,
      }))
    )
    return { worksheetId, worksheetMarkdown, solvedCount: 0, pendingCount: 0, totalEssayCount: 0 }
  }

  const imageUrls = ws.sgk_image_urls
  const imageParts = imageUrls.length
    ? await Promise.all(
        imageUrls.slice(0, 10).map((url: string) => fetchImageAsBase64(url).then((r) => ({ inlineData: { data: r.data, mimeType: r.mimeType } })))
      )
    : []

  const topic = String(ws.topic ?? 'Phiếu bài tập')
  let solvedCount = 0

  for (const row of essays) {
    const problem = getEssayProblem(row.content_json)
    if (!problem) continue
    const solution = normalizeSolutionToStr(getEssaySolution(row.content_json))
    const isPending = !solution || solution === '(Chưa có lời giải)' || solution.trim().length < 30
    if (!isPending) continue

    const generated = await generateEssaySolution(
      problem,
      topic,
      curriculumMarkdown,
      apiKey,
      userId,
      essayNeedsImage(problem) ? imageParts : undefined
    )
    if (!generated) continue

    const content = (row.content_json && typeof row.content_json === 'object' ? row.content_json : {}) as Record<string, unknown>
    const nextContent = { ...content, problem, solution: generated }
    const ok = await updateWorksheetQuestionContentJsonPg(row.id, nextContent)
    if (ok) solvedCount++
  }

  const refreshed = await fetchWorksheetQuestionsMarkdownRowsOrderedFromPg(questionIds)
  if (!refreshed || refreshed.length !== questionIds.length) {
    throw new Error('Không đọc lại được câu sau khi sinh lời giải.')
  }
  const worksheetMarkdown = questionsToMarkdown(
    refreshed.map((r) => ({
      type: r.type,
      content_json: r.content_json,
      difficulty: r.difficulty ?? undefined,
      source: r.source ?? undefined,
      verified_at: r.verified_at,
    }))
  )
  const mdOk = await updateWorksheetSheetContentMarkdownPg(worksheetId, worksheetMarkdown)
  if (!mdOk) throw new Error('Không cập nhật markdown phiếu.')

  const pendingCount = refreshed
    .filter((q) => q.type === 'essay')
    .map((q) => normalizeSolutionToStr(getEssaySolution(q.content_json)))
    .filter((s) => !s || s === '(Chưa có lời giải)' || s.trim().length < 30).length

  return { worksheetId, worksheetMarkdown, solvedCount, pendingCount, totalEssayCount }
}
