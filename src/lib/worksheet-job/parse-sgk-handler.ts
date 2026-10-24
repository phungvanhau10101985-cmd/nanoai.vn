/**
 * Handler parse SGK – dùng chung cho API route và worker.
 * Chấp nhận imageUrls (từ storage) thay vì File.
 */
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_PRO } from '@/lib/gemini-config'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import { questionsToMarkdown } from '@/app/tao-giao-trinh/lib/questions-to-markdown'
import { normalizeSolutionToStr } from '@/app/tao-giao-trinh/lib/worksheet-content-json'
import {
  findCurriculumMathFailures,
  isCurriculumMathSubject,
  stripCurriculumMathCheckComments,
} from '@/app/tao-giao-trinh/lib/curriculum-math-check'
import { isPgConfigured } from '@/lib/db/pool'
import { beginSgkExtractBilling } from '@/lib/db/worksheet-ai-quota-pg'
import { removeTryOnStorageFromPublicUrls } from '@/lib/storage/try-on-public-upload'
import {
  fetchLatestWorksheetSheetByCurriculumIdPg,
  fetchWorksheetCurriculumTopicLessonTopicsPg,
  fetchWorksheetQuestionIdTypesPg,
  fetchWorksheetQuestionsIdTypeContentJsonPg,
  fetchWorksheetQuestionsMarkdownRowsOrderedFromPg,
  fetchWorksheetSheetIdQuestionIdsPg,
  insertWorksheetQuestionPg,
  insertWorksheetSheetSlideBuildFromPg,
  updateWorksheetSheetMarkdownQuestionIdsPg,
} from '@/lib/db/worksheet-pg'

function stripOptionPrefix(opt: string): string {
  return String(opt ?? '').replace(/^[A-D]\.\s*/i, '').trim() || String(opt ?? '')
}

function acceptedMathSolution(problem: string, solution: string, subjectId: string): string | null {
  if (!isCurriculumMathSubject(subjectId)) return solution
  const markdown = `### Bài\n\n${problem}\n\n**Lời giải:**\n\n${solution}`
  const failures = findCurriculumMathFailures(markdown, { subjectId })
  if (failures.length > 0) return null
  return stripCurriculumMathCheckComments(solution)
}

function shuffleCorrectPosition(options: string[], correctIndex: number): { options: string[]; correctIndex: number } {
  const correct = options[correctIndex]
  const rest = options.filter((_, i) => i !== correctIndex)
  const insertAt = Math.floor(Math.random() * (rest.length + 1))
  const shuffled = [...rest.slice(0, insertAt), correct, ...rest.slice(insertAt)]
  return { options: shuffled, correctIndex: insertAt }
}

function mergeQuestionIds(
  existingIds: string[],
  existingTypes: Map<string, string>,
  newIds: string[],
  newTypes: Map<string, string>
): string[] {
  const existingQuizzes = existingIds.filter((id) => existingTypes.get(id) === 'quiz')
  const existingEssays = existingIds.filter((id) => existingTypes.get(id) === 'essay')
  const newQuizzes = newIds.filter((id) => newTypes.get(id) === 'quiz')
  const newEssays = newIds.filter((id) => newTypes.get(id) === 'essay')
  return [...existingQuizzes, ...newQuizzes, ...existingEssays, ...newEssays]
}

async function generateEssaySolution(
  problem: string,
  topic: string,
  curriculumMarkdown: string,
  apiKey: string,
  userId: string
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

QUY TẮC: Unicode (π, ∫, x², √, ∈, ℝ). Phân số: 1/2 hoặc ½. Lời giải phải đầy đủ, logic, từng bước, do bạn viết cho đề này.
QUAN TRỌNG: Chỉ viết MỘT lần lời giải. KHÔNG lặp lại nội dung. Kết quả trả về trong trường solution phải là nội dung thuần, KHÔNG thêm tiêu đề "Lời giải"/"Đáp án". Không chép lời giải in sẵn.
Trả về JSON: {"solution":"Lời giải chi tiết từng bước (chuỗi văn bản thuần)"}`

  const result = await model.generateContent(prompt)
  void trackFromUsageMetadata(
    result.response.usageMetadata,
    GEMINI_25_PRO.model,
    'worksheet-parse-sgk-essay-solution-pro',
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

async function fetchImageAsBase64(url: string): Promise<{ data: string; mimeType: string }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Fetch image failed: ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const contentType = res.headers.get('content-type') || 'image/png'
  const mimeType = contentType.split(';')[0]?.trim() || 'image/png'
  return { data: buf.toString('base64'), mimeType }
}

export type ParseSgkParams = {
  imageUrls: string[]
  curriculumId: string | null
  worksheetId: string | null
  topic: string
  subjectId: string
  gradeLevelId: string
  curriculumMarkdown: string
}

export type ParseSgkOptions = {
  solveMissingEssaySolutions?: boolean
}

export type ParseSgkResult = {
  worksheetId: string | null
  worksheetMarkdown: string
  addedCount: number
  quizCount: number
  essayCount: number
}

async function runParseSgkWork(
  userId: string,
  params: ParseSgkParams,
  options?: ParseSgkOptions
): Promise<ParseSgkResult> {
  if (!isPgConfigured()) {
    throw new Error('DATABASE_URL chưa cấu hình — worker cần Postgres.')
  }

  const { imageUrls, curriculumId, worksheetId, topic, subjectId, gradeLevelId, curriculumMarkdown } = params
  const solveMissingEssaySolutions = options?.solveMissingEssaySolutions ?? true
  if (!imageUrls?.length) throw new Error('Thiếu ảnh.')

  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) throw new Error('Thiếu GOOGLE_API_KEY.')

  const existingQuestions: Array<{ question: string; options?: string[] }> = []
  const existingProblems: string[] = []
  let existingIds: string[] = []
  const existingTypes = new Map<string, string>()
  let existingWorksheetId: string | null = null
  let resolvedTopic = (topic ?? '').trim()
  let resolvedLessonTopics: string[] | null = null

  if (curriculumId) {
    const curriculumRow = await fetchWorksheetCurriculumTopicLessonTopicsPg(curriculumId)
    const cTopic = String(curriculumRow?.topic ?? '').trim()
    if (cTopic) resolvedTopic = cTopic
    const rawLessonTopics = curriculumRow?.lesson_topics
    if (Array.isArray(rawLessonTopics)) {
      const normalized = rawLessonTopics.map((x) => String(x ?? '').trim()).filter(Boolean)
      resolvedLessonTopics = normalized.length > 0 ? normalized : null
    }
    if (!resolvedLessonTopics && resolvedTopic) resolvedLessonTopics = [resolvedTopic]
  }

  if (curriculumId || worksheetId) {
    const ws = worksheetId
      ? await fetchWorksheetSheetIdQuestionIdsPg(worksheetId)
      : curriculumId
        ? await fetchLatestWorksheetSheetByCurriculumIdPg(curriculumId)
        : null
    const qIds = ws?.question_ids ?? []
    if (ws?.id) existingWorksheetId = ws.id
    if (qIds.length > 0) {
      existingIds = qIds
      const qRows = await fetchWorksheetQuestionsIdTypeContentJsonPg(qIds)
      for (const r of qRows ?? []) {
        existingTypes.set(r.id, r.type)
        const c = r.content_json as { question?: string; options?: string[]; problem?: string }
        if (r.type === 'quiz' && c?.question) existingQuestions.push({ question: c.question, options: (c.options ?? []).slice(0, 4) })
        if (r.type === 'essay' && c?.problem) existingProblems.push(c.problem)
      }
    }
  }

  const existingBlock =
    existingQuestions.length > 0 || existingProblems.length > 0
      ? `\n⚠️ ĐÃ CÓ CÁC CÂU SAU TRONG PHIẾU – KHÔNG tạo trùng:\n${
          existingQuestions.map((eq, i) => `${i + 1}. [Quiz] ${eq.question}`).join('\n')
        }${existingProblems.length > 0 ? '\n' + existingProblems.map((p, i) => `${existingQuestions.length + i + 1}. [Essay] ${p.slice(0, 150)}...`).join('\n') : ''}\n`
      : ''

  const imageParts = await Promise.all(imageUrls.map((url) => fetchImageAsBase64(url).then((r) => ({ inlineData: { data: r.data, mimeType: r.mimeType } }))))

  const prompt = `Ảnh này chỉ để nhận DẠNG bài và kiến thức đang luyện. Nhiệm vụ: viết BÀI TẬP MỚI cùng dạng, không chép trang sách.
${existingBlock}

QUY TẮC:
- Nhìn ảnh để biết kỹ năng đang luyện và khoảng bao nhiêu câu. Sau đó đặt câu mới.
- Không giữ câu chữ của sách rồi chỉ đổi một số. Đổi tình huống, số liệu, tên điểm và hình mô tả ngay trong đề.
- Không chép đề, số liệu, hình, đáp án hay lời giải in trong ảnh. Không điền số bài của sách.
- Nếu dạng bài cần đồ thị hoặc hình, hãy nêu hàm hoặc dữ liệu mới ngay trong đề để học sinh làm được mà không cần ảnh sách.
- Môn Toán: cuối lời giải thêm đúng một dòng <!-- check {"kind":"expr","expr":"2+3","shown":5} -->. expr chỉ gồm số và + - * / ^ ( ). shown là kết quả đã viết trong lời giải.
- Mỗi câu = 1 item. Trắc nghiệm: 4 đáp án. Tự luận: đề mới + lời giải do bạn viết.
- Trắc nghiệm: difficulty = easy | medium | hard.
- Tự luận: difficulty = nhan-biet | thong-hieu | van-dung-thap | van-dung-cao | thuc-te.
- Unicode: π, ∫, x², √, ∈, ℝ. KHÔNG LaTeX. options: CHỈ nội dung, KHÔNG thêm "A." "B." vào đầu.
- KHÔNG tạo câu trùng với danh sách đã có ở trên.
- Lời giải tự luận viết đủ bước cho chính đề mới. Không để solution rỗng. Không thêm tiêu đề "Lời giải:" hay "Đáp án:".

Trả về JSON:
{
  "quizzes": [ { "question": "...", "options": ["...","...","...","..."], "correctIndex": 0-3, "difficulty": "easy|medium|hard" } ],
  "essays": [ { "problem": "...", "solution": "...", "difficulty": "nhan-biet|thong-hieu|van-dung-thap|van-dung-cao|thuc-te" } ]
}

Chỉ trả về JSON, không markdown.`

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    ...GEMINI_25_PRO,
    generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
  })
  const result = await model.generateContent([prompt, ...imageParts])
  void trackFromUsageMetadata(
    result.response.usageMetadata,
    GEMINI_25_PRO.model,
    'worksheet-parse-sgk-gemini-pro',
    userId
  )
  const raw = result.response.text()?.trim() || ''
  if (!raw) throw new Error('AI không trả về nội dung.')

  let parsed: {
    quizzes?: Array<{ question?: string; options?: string[]; correctIndex?: number; difficulty?: string; exerciseNumber?: string }>
    essays?: Array<{ problem?: string; solution?: unknown; difficulty?: string; exerciseNumber?: string }>
  } = {}
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
    parsed = JSON.parse(cleaned) as typeof parsed
  } catch {
    throw new Error('AI trả về JSON không hợp lệ.')
  }

  const quizzes = Array.isArray(parsed?.quizzes) ? parsed.quizzes : []
  const essays = Array.isArray(parsed?.essays) ? parsed.essays : []
  const questionIds: string[] = []
  let order = existingIds.length

  for (const q of quizzes) {
    if (!q?.question || !Array.isArray(q.options) || q.options.length < 4) continue
    const opts = q.options.slice(0, 4).map(stripOptionPrefix)
    const idx = Math.max(0, Math.min(q.correctIndex ?? 0, 3))
    const diff = ['easy', 'medium', 'hard'].includes(String(q.difficulty ?? '')) ? q.difficulty : 'medium'
    const { options, correctIndex } = shuffleCorrectPosition(opts, idx)
    const ins = await insertWorksheetQuestionPg({
      userId,
      curriculumId: curriculumId || null,
      type: 'quiz',
      subjectId,
      gradeLevelId,
      topic: resolvedTopic || null,
      lessonTopics: resolvedLessonTopics ?? undefined,
      difficulty: diff ?? 'medium',
      contentJson: { question: q.question, options, correctIndex },
      source: 'sgk',
      order: order++,
    })
    if (ins?.id) questionIds.push(ins.id)
  }

  for (const e of essays) {
    if (!e?.problem) continue
    let solution = normalizeSolutionToStr(e.solution) || ''
    const isEmpty = !solution || solution === '(Chưa có lời giải)' || solution.trim().length < 30
    if (isEmpty && apiKey && solveMissingEssaySolutions) {
      const generated = await generateEssaySolution(
        e.problem,
        resolvedTopic,
        curriculumMarkdown,
        apiKey,
        userId
      )
      if (generated) solution = generated
    }
    if (!solution || solution === '(Chưa có lời giải)') continue
    const checked = acceptedMathSolution(e.problem, solution, subjectId)
    if (!checked) continue
    solution = checked
    const diff = ['nhan-biet', 'thong-hieu', 'van-dung-thap', 'van-dung-cao', 'thuc-te'].includes(String(e.difficulty ?? '')) ? e.difficulty : 'thong-hieu'
    const insEssay = await insertWorksheetQuestionPg({
      userId,
      curriculumId: curriculumId || null,
      type: 'essay',
      subjectId,
      gradeLevelId,
      topic: resolvedTopic || null,
      lessonTopics: resolvedLessonTopics ?? undefined,
      difficulty: diff ?? 'thong-hieu',
      contentJson: { problem: e.problem, solution },
      source: 'sgk',
      order: order++,
    })
    if (insEssay?.id) questionIds.push(insEssay.id)
  }

  if (questionIds.length === 0) throw new Error('Không tạo được bài tập mới cùng dạng.')

  const newTypesFull = await fetchWorksheetQuestionIdTypesPg(questionIds)
  if (!newTypesFull) throw new Error('Không đọc được loại câu mới.')
  const newTypesMap = newTypesFull

  let finalIds: string[]
  let finalMarkdown: string
  let targetWorksheetId: string | null = null

  if (existingWorksheetId) {
    targetWorksheetId = existingWorksheetId
    finalIds = mergeQuestionIds(existingIds, existingTypes, questionIds, newTypesMap)
    const orderedRows = await fetchWorksheetQuestionsMarkdownRowsOrderedFromPg(finalIds)
    if (!orderedRows || orderedRows.length !== finalIds.length) {
      throw new Error('Không tải được nội dung câu để cập nhật phiếu.')
    }
    finalMarkdown = questionsToMarkdown(
      orderedRows.map((r) => ({
        type: r.type,
        content_json: r.content_json,
        difficulty: r.difficulty ?? undefined,
        source: r.source ?? undefined,
        verified_at: r.verified_at,
      }))
    )
    const upOk = await updateWorksheetSheetMarkdownQuestionIdsPg(existingWorksheetId, finalIds, finalMarkdown)
    if (!upOk) throw new Error('Không cập nhật được phiếu bài tập.')
  } else {
    finalIds = questionIds
    const orderedRows = await fetchWorksheetQuestionsMarkdownRowsOrderedFromPg(finalIds)
    if (!orderedRows || orderedRows.length !== finalIds.length) {
      throw new Error('Không tải được nội dung câu cho phiếu mới.')
    }
    finalMarkdown = questionsToMarkdown(
      orderedRows.map((r) => ({
        type: r.type,
        content_json: r.content_json,
        difficulty: r.difficulty ?? undefined,
        source: r.source ?? undefined,
        verified_at: r.verified_at,
      }))
    )
    const newSheetId = await insertWorksheetSheetSlideBuildFromPg({
      userId,
      topic: resolvedTopic || topic,
      subjectId,
      gradeLevelId,
      contentMarkdown: finalMarkdown,
      questionIds: finalIds,
      curriculumId: curriculumId || null,
    })
    if (!newSheetId) throw new Error('Không tạo được phiếu bài tập.')
    targetWorksheetId = newSheetId
  }

  return {
    worksheetId: targetWorksheetId,
    worksheetMarkdown: finalMarkdown,
    addedCount: questionIds.length,
    quizCount: questionIds.filter((id) => newTypesMap.get(id) === 'quiz').length,
    essayCount: questionIds.filter((id) => newTypesMap.get(id) === 'essay').length,
  }
}

/** Đọc dạng bài từ ảnh rồi xóa file ảnh. Phiếu chỉ nhận câu mới. */
export async function runParseSgk(
  userId: string,
  params: ParseSgkParams,
  options?: ParseSgkOptions
): Promise<ParseSgkResult> {
  const billing = await beginSgkExtractBilling(userId, params.curriculumId)
  try {
    const result = await runParseSgkWork(userId, params, options)
    if (result.addedCount > 0) await billing.commit()
    else await billing.rollback()
    return result
  } catch (error) {
    await billing.rollback()
    throw error
  } finally {
    try {
      await removeTryOnStorageFromPublicUrls(params.imageUrls ?? [])
    } catch (e) {
      console.warn('[parse-sgk] không xóa được ảnh tạm', e)
    }
  }
}
