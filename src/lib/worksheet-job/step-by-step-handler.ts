/**
 * Handler tạo câu từng bước (quiz/essay) – dùng cho worker.
 * Chỉ Postgres (DATABASE_URL).
 */
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_PRO } from '@/lib/gemini-config'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import { questionsToMarkdown } from '@/app/tao-giao-trinh/lib/questions-to-markdown'
import { normalizeSolutionToStr } from '@/app/tao-giao-trinh/lib/worksheet-content-json'
import { isPgConfigured } from '@/lib/db/pool'
import {
  fetchLatestWorksheetSheetByCurriculumIdPg,
  fetchWorksheetQuestionContentJsonByIdPg,
  fetchWorksheetQuestionIdTypesPg,
  fetchWorksheetQuestionsMarkdownRowsOrderedFromPg,
  insertWorksheetQuestionPg,
  insertWorksheetSheetSlideBuildFromPg,
  updateWorksheetSheetMarkdownQuestionIdsPg,
} from '@/lib/db/worksheet-pg'

type Difficulty = 'easy' | 'medium' | 'hard'
type EssayBloomLevel = 'nhan-biet' | 'thong-hieu' | 'van-dung-thap' | 'van-dung-cao' | 'thuc-te'

const QUIZ_SCHEMA = `{"quizzes":[{"question":"Câu hỏi?","options":["(2; +∞)","(−∞; 2)","(−∞; +∞)","(−2; 2)"],"correctIndex":0}]}`
const ESSAY_SCHEMA = `{"problem":"Đề bài (câu hỏi)","solution":"Lời giải chi tiết từng bước"}`

const DIFFICULTY_PROMPT: Record<Difficulty, string> = {
  easy: 'Độ khó DỄ: nhận biết, kiến thức cơ bản.',
  medium: 'Độ khó TRUNG BÌNH: thông hiểu, vận dụng đơn giản.',
  hard: 'Độ khó KHÓ: vận dụng cao, phân tích.',
}

const ESSAY_BLOOM_PROMPT: Record<EssayBloomLevel, string> = {
  'nhan-biet': 'Mức 1 – Nhận biết: bài tập cơ bản, áp dụng trực tiếp công thức.',
  'thong-hieu': 'Mức 2 – Thông hiểu: cần hiểu khái niệm, suy luận nhẹ.',
  'van-dung-thap': 'Mức 3 – Vận dụng thấp: áp dụng kiến thức vào bài toán quen thuộc.',
  'van-dung-cao': 'Mức 4 – Vận dụng cao: phân tích, tổng hợp, bài phức tạp hơn.',
  'thuc-te': 'Mức 4 – Vận dụng cao (Thực tế): bài toán thực tế, tình huống đời sống.',
}

function stripOptionPrefix(opt: string): string {
  return String(opt ?? '').replace(/^[A-D]\.\s*/i, '').trim() || String(opt ?? '')
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
  const eq = existingIds.filter((id) => existingTypes.get(id) === 'quiz')
  const ee = existingIds.filter((id) => existingTypes.get(id) === 'essay')
  const nq = newIds.filter((id) => newTypes.get(id) === 'quiz')
  const ne = newIds.filter((id) => newTypes.get(id) === 'essay')
  return [...eq, ...nq, ...ee, ...ne]
}

export type StepByStepParams = {
  curriculumMarkdown: string
  topic: string
  subjectId: string
  gradeLevelId: string
  curriculumId: string | null
  lessonTopics?: string[]
  count: number
  difficulty: string
  sessionQuizCountByDiff?: Record<string, number>
  sessionEssayCountByBloom?: Record<string, number>
}

export type StepByStepResult = {
  worksheetId: string | null
  worksheetMarkdown: string
  questionIds: string[]
}

async function createOneQuiz(
  userId: string,
  params: StepByStepParams,
  existingQuestions: Array<{ question: string; options?: string[] }>,
  order: number
): Promise<{ id: string } | null> {
  const { curriculumMarkdown, topic, subjectId, gradeLevelId, curriculumId, lessonTopics, difficulty } = params
  const diff = (['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'medium') as Difficulty
  const existingBlock =
    existingQuestions.length > 0
      ? `\n⚠️ ĐÃ CÓ CÁC CÂU SAU – KHÔNG tạo trùng nội dung:\n${existingQuestions.map((eq, i) => `${i + 1}. ${eq.question} (${(eq.options ?? []).slice(0, 4).join(' | ')})`).join('\n')}\n`
      : ''
  const prompt = `Bạn là giáo viên. Tạo ĐÚNG 1 câu trắc nghiệm MỚI (khác hẳn các câu đã có) từ GIÁO TRÌNH dưới đây.${existingBlock}

⚠️ QUY TẮC SỐ 1 – KHÔNG tạo câu hỏi dạng nhìn đồ thị, nhìn ảnh, nhìn hình để trả lời. Phiếu không có hình. Phải cho hàm số cụ thể hoặc bảng biến thiên bằng chữ.

${DIFFICULTY_PROMPT[diff] ?? DIFFICULTY_PROMPT.medium}

QUY TẮC: Unicode (π, ∫, x², √, ∈, ℝ), 4 đáp án A/B/C/D, correctIndex 0-3. Tiếng Việt.
options: CHỈ nội dung đáp án, KHÔNG thêm "A." "B." "C." "D." vào đầu.
Chỉ trả về JSON, không markdown.

GIÁO TRÌNH:
---
${curriculumMarkdown.slice(0, 6000)}
---

Chủ đề: ${topic}

Schema: ${QUIZ_SCHEMA}`

  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) return null

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    ...GEMINI_25_PRO,
    generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
  })
  const result = await model.generateContent(prompt)
  void trackFromUsageMetadata(
    result.response.usageMetadata,
    GEMINI_25_PRO.model,
    'worksheet-step-quiz-gemini-pro',
    userId
  )
  const raw = result.response.text()?.trim() || ''
  let quizzes: Array<{ question: string; options: string[]; correctIndex: number }> | null = null
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
    const p = JSON.parse(cleaned) as { quizzes?: Array<{ question?: string; options?: string[]; correctIndex?: number }> }
    const list = Array.isArray(p?.quizzes) ? p.quizzes : []
    const q = list[0]
    if (q?.question && Array.isArray(q.options) && q.options.length >= 4) {
      const opts = (q.options ?? []).slice(0, 4)
      const idx = Math.max(0, Math.min(q.correctIndex ?? 0, 3))
      quizzes = [{ question: q.question, options: opts, correctIndex: idx }]
    }
  } catch {
    /* */
  }
  if (!quizzes?.length) return null

  const last = quizzes[0]!
  const sanitized = last.options.map(stripOptionPrefix)
  const { options, correctIndex } = shuffleCorrectPosition(sanitized, last.correctIndex)

  const row = await insertWorksheetQuestionPg({
    userId,
    curriculumId: curriculumId || null,
    type: 'quiz',
    subjectId,
    gradeLevelId,
    topic: topic || null,
    lessonTopics,
    difficulty: diff,
    contentJson: { question: last.question, options, correctIndex },
    order,
    source: 'ai',
  })

  return row ? { id: row.id } : null
}

async function createOneEssay(
  userId: string,
  params: StepByStepParams,
  existingProblems: string[],
  order: number
): Promise<{ id: string } | null> {
  const { curriculumMarkdown, topic, subjectId, gradeLevelId, curriculumId, lessonTopics, difficulty } = params
  const diff = (['nhan-biet', 'thong-hieu', 'van-dung-thap', 'van-dung-cao', 'thuc-te'].includes(difficulty)
    ? difficulty
    : 'thong-hieu') as EssayBloomLevel
  const existingBlock =
    existingProblems.length > 0
      ? `\n⚠️ ĐÃ CÓ CÁC BÀI SAU – KHÔNG tạo trùng:\n${existingProblems.map((p, i) => `${i + 1}. ${p.slice(0, 200)}${p.length > 200 ? '...' : ''}`).join('\n')}\n`
      : ''
  const prompt = `Bạn là giáo viên. Tạo ĐÚNG 1 BÀI TỰ LUẬN MỚI (khác hẳn các bài đã có) từ GIÁO TRÌNH.${existingBlock}

${ESSAY_BLOOM_PROMPT[diff] ?? ESSAY_BLOOM_PROMPT['thong-hieu']}

QUY TẮC: Unicode, phân số 1/2, đề rõ ràng, lời giải từng bước. CẤM đề "nhìn hình". CHỈ viết MỘT lần lời giải, KHÔNG lặp lại.
Chỉ trả về JSON, không markdown.

GIÁO TRÌNH:
---
${curriculumMarkdown.slice(0, 6000)}
---

Chủ đề: ${topic}

Schema: ${ESSAY_SCHEMA}`

  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) return null

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    ...GEMINI_25_PRO,
    generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
  })
  const result = await model.generateContent(prompt)
  void trackFromUsageMetadata(
    result.response.usageMetadata,
    GEMINI_25_PRO.model,
    'worksheet-step-essay-gemini-pro',
    userId
  )
  const raw = result.response.text()?.trim() || ''
  let parsed: { problem?: string; solution?: string } | null = null
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
    const p = JSON.parse(cleaned)
    if (p?.problem && p?.solution) parsed = { problem: p.problem, solution: p.solution }
  } catch {
    /* */
  }
  if (!parsed) return null

  const solutionStr = normalizeSolutionToStr(parsed.solution) || String(parsed.solution ?? '').trim()

  const row = await insertWorksheetQuestionPg({
    userId,
    curriculumId: curriculumId || null,
    type: 'essay',
    subjectId,
    gradeLevelId,
    topic: topic || null,
    lessonTopics,
    difficulty: diff,
    contentJson: { problem: parsed.problem, solution: solutionStr },
    order,
    source: 'ai',
  })

  return row ? { id: row.id } : null
}

export async function runStepByStep(
  userId: string,
  params: StepByStepParams,
  type: 'quiz' | 'essay'
): Promise<StepByStepResult> {
  if (!isPgConfigured()) throw new Error('DATABASE_URL chưa cấu hình')

  const ids: string[] = []
  const count = Math.max(1, Math.min(params.count, type === 'quiz' ? 20 : 10))

  if (type === 'quiz') {
    const existingQuizContents: Array<{ question: string; options?: string[] }> = []
    for (let i = 0; i < count; i++) {
      const row = await createOneQuiz(userId, params, existingQuizContents, ids.length)
      if (row) {
        ids.push(row.id)
        const cj = await fetchWorksheetQuestionContentJsonByIdPg(row.id)
        const c = cj?.content_json as { question?: string; options?: string[] } | undefined
        if (c?.question) existingQuizContents.push({ question: c.question, options: (c.options ?? []).slice(0, 4) })
      }
    }
  } else {
    const existingEssayProblems: string[] = []
    for (let i = 0; i < count; i++) {
      const row = await createOneEssay(userId, params, existingEssayProblems, ids.length)
      if (row) {
        ids.push(row.id)
        const cj = await fetchWorksheetQuestionContentJsonByIdPg(row.id)
        const c = cj?.content_json as { problem?: string } | undefined
        if (c?.problem) existingEssayProblems.push(c.problem)
      }
    }
  }

  if (ids.length === 0) throw new Error('Không tạo được câu hỏi nào.')

  const { curriculumId, topic, subjectId, gradeLevelId } = params
  const newTypes = (await fetchWorksheetQuestionIdTypesPg(ids)) ?? new Map<string, string>()
  const newOrdered = await fetchWorksheetQuestionsMarkdownRowsOrderedFromPg(ids)
  if (!newOrdered || newOrdered.length !== ids.length) {
    throw new Error('Không đọc được câu vừa tạo.')
  }

  let finalIds: string[]
  let contentMarkdown: string

  if (curriculumId) {
    const existingWs = await fetchLatestWorksheetSheetByCurriculumIdPg(curriculumId)
    const existingIds = existingWs?.question_ids?.filter(Boolean) ?? []
    if (existingWs && existingIds.length > 0) {
      const existingTypes = (await fetchWorksheetQuestionIdTypesPg(existingIds)) ?? new Map<string, string>()
      finalIds = mergeQuestionIds(existingIds, existingTypes, ids, newTypes)
      const allRows = await fetchWorksheetQuestionsMarkdownRowsOrderedFromPg(finalIds)
      if (!allRows || allRows.length !== finalIds.length) throw new Error('Không ghép được danh sách câu.')
      contentMarkdown = questionsToMarkdown(
        allRows.map((r) => ({
          type: r.type,
          content_json: r.content_json,
          difficulty: r.difficulty ?? undefined,
          source: r.source ?? undefined,
          verified_at: r.verified_at,
        }))
      )
      const ok = await updateWorksheetSheetMarkdownQuestionIdsPg(existingWs.id, finalIds, contentMarkdown)
      if (!ok) throw new Error('Không cập nhật phiếu giáo trình.')
      return { worksheetId: existingWs.id, worksheetMarkdown: contentMarkdown, questionIds: ids }
    }
  }

  finalIds = ids
  contentMarkdown = questionsToMarkdown(
    newOrdered.map((r) => ({
      type: r.type,
      content_json: r.content_json,
      difficulty: r.difficulty ?? undefined,
      source: r.source ?? undefined,
      verified_at: r.verified_at,
    }))
  )
  const newSheetId = await insertWorksheetSheetSlideBuildFromPg({
    userId,
    topic,
    subjectId,
    gradeLevelId,
    contentMarkdown,
    questionIds: finalIds,
    curriculumId: curriculumId || null,
  })
  if (!newSheetId) throw new Error('Không tạo được phiếu bài tập.')
  return { worksheetId: newSheetId, worksheetMarkdown: contentMarkdown, questionIds: ids }
}
