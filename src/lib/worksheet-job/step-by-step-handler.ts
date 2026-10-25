/**
 * Handler tạo câu từng bước (quiz/essay) – dùng cho worker.
 * Chỉ Postgres (DATABASE_URL).
 */
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_PRO } from '@/lib/gemini-config'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import {
  beginQuestionTurn,
  chargeWorksheetQuestion,
  discardWorksheetQuestion,
  WorksheetCreditsError,
} from '@/lib/db/worksheet-ai-quota-pg'
import { questionsToMarkdown } from '@/app/tao-giao-trinh/lib/questions-to-markdown'
import { THINKING_GUIDE_RULE, cleanThinkingGuide, normalizeSolutionToStr, thinkingGuideIsUsable } from '@/app/tao-giao-trinh/lib/worksheet-content-json'
import { QUIZ_SOLUTION_RULE, cleanQuizSolution, quizSolutionIsDetailed } from '@/app/tao-giao-trinh/lib/worksheet-quiz-solution'
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

const QUIZ_SCHEMA = `{"quizzes":[{"question":"Câu hỏi?","options":["(2; +∞)","(−∞; 2)","(−∞; +∞)","(−2; 2)"],"correctIndex":0,"thinkingGuide":"Nhớ tập xác định. Tính đạo hàm rồi xét dấu. Khoảng đồng biến là nơi đạo hàm dương.","solution":"Tập xác định là ℝ. Xét dấu f'(x). f'(x) > 0 khi x > 2. Vậy hàm đồng biến trên khoảng đó."}]}`
const ESSAY_SCHEMA = `{"problem":"Đề bài (câu hỏi)","thinkingGuide":"Xác định dữ kiện đã cho. Chọn công thức liên quan. Làm bước đầu trước khi tính kết quả.","solution":"Lời giải chi tiết từng bước"}`

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

class InvalidModelDraftError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidModelDraftError'
  }
}

function draftExcerpt(raw: string): string {
  const excerpt = raw.replace(/\s+/g, ' ').trim().slice(0, 500)
  return excerpt ? ` Mẫu: ${excerpt}` : ''
}

function readQuizCandidate(value: unknown): { question: string; options: string[]; correctIndex: number; thinkingGuide: string; solution: string } | null {
  if (!value || typeof value !== 'object') return null
  const row = value as { question?: unknown; options?: unknown; correctIndex?: unknown; thinkingGuide?: unknown; solution?: unknown }
  if (typeof row.question !== 'string' || !row.question.trim()) return null
  if (!Array.isArray(row.options) || row.options.length < 4) return null
  const solution = cleanQuizSolution(row.solution)
  const thinkingGuide = cleanThinkingGuide(row.thinkingGuide)
  if (!quizSolutionIsDetailed(solution) || !thinkingGuideIsUsable(thinkingGuide)) return null
  const options = row.options.slice(0, 4).map((item) => String(item ?? ''))
  const correctIndex = Math.max(0, Math.min(Number(row.correctIndex ?? 0) || 0, 3))
  return { question: row.question.trim(), options, correctIndex, thinkingGuide, solution }
}

function readQuizDraft(raw: string): { question: string; options: string[]; correctIndex: number; thinkingGuide: string; solution: string } | null {
  const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
  const parsed = JSON.parse(cleaned) as { quizzes?: unknown }
  if (parsed && typeof parsed === 'object' && Array.isArray(parsed.quizzes)) {
    return readQuizCandidate(parsed.quizzes[0])
  }
  return readQuizCandidate(parsed)
}

function explainQuizDraft(raw: string): string {
  if (!raw.trim()) return 'Gemini không trả nội dung.'
  let parsed: unknown
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
    parsed = JSON.parse(cleaned)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'JSON hỏng'
    return `Gemini trả JSON không đọc được (${message}).${draftExcerpt(raw)}`
  }
  if (!parsed || typeof parsed !== 'object') return `Gemini không trả object JSON.${draftExcerpt(raw)}`
  const body = parsed as { quizzes?: unknown }
  if (!Array.isArray(body.quizzes)) {
    const keys = Object.keys(parsed as object).slice(0, 8).join(', ')
    return `Gemini không trả mảng quizzes (các khóa: ${keys || 'không có'}).${draftExcerpt(raw)}`
  }
  if (body.quizzes.length === 0) return `Gemini trả quizzes rỗng.${draftExcerpt(raw)}`
  const first = body.quizzes[0] as { question?: unknown; options?: unknown; thinkingGuide?: unknown; solution?: unknown }
  const optionCount = Array.isArray(first?.options) ? first.options.length : 0
  if (typeof first?.question !== 'string' || !first.question.trim()) return `Gemini thiếu đề câu.${draftExcerpt(raw)}`
  if (optionCount < 4) return `Gemini trả ${optionCount} đáp án, cần đủ 4.${draftExcerpt(raw)}`
  if (!thinkingGuideIsUsable(first?.thinkingGuide)) return `Gemini thiếu hướng tư duy cho học sinh.${draftExcerpt(raw)}`
  if (!quizSolutionIsDetailed(first?.solution)) return `Gemini thiếu lời giải chi tiết trước đáp án.${draftExcerpt(raw)}`
  return `Gemini trả câu không đọc được.${draftExcerpt(raw)}`
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
  createdIn?: 'exam' | 'worksheet'
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
${THINKING_GUIDE_RULE}
${QUIZ_SOLUTION_RULE}
Chỉ trả về JSON, không markdown.

GIÁO TRÌNH:
---
${curriculumMarkdown.slice(0, 6000)}
---

Chủ đề: ${topic}

Schema: ${QUIZ_SCHEMA}`

  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) throw new InvalidModelDraftError('Thiếu GOOGLE_API_KEY.')

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
  let last: { question: string; options: string[]; correctIndex: number; thinkingGuide: string; solution: string } | null = null
  try {
    last = readQuizDraft(raw)
  } catch {
    last = null
  }
  if (!last) throw new InvalidModelDraftError(explainQuizDraft(raw))
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
    contentJson: {
      question: last.question,
      options,
      correctIndex,
      thinkingGuide: last.thinkingGuide,
      solution: last.solution,
      createdIn: params.createdIn === 'exam' ? 'exam' : 'worksheet',
    },
    order,
    source: 'ai',
  })

  if (!row) throw new InvalidModelDraftError('Đã có câu hợp lệ nhưng không ghi được vào database.')
  return { id: row.id }
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
${THINKING_GUIDE_RULE}
Ba phần bắt buộc: problem là đề, thinkingGuide là hướng tư duy, solution là lời giải.
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
  let parsed: { problem?: string; thinkingGuide?: unknown; solution?: string } | null = null
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
    const p = JSON.parse(cleaned)
    if (p?.problem && p?.solution) parsed = { problem: p.problem, thinkingGuide: p.thinkingGuide, solution: p.solution }
  } catch {
    /* */
  }
  if (!parsed) throw new InvalidModelDraftError('Gemini không trả bài tự luận hợp lệ.')
  const thinkingGuide = cleanThinkingGuide(parsed.thinkingGuide)
  if (!thinkingGuideIsUsable(thinkingGuide)) {
    throw new InvalidModelDraftError('Gemini thiếu hướng tư duy cho học sinh.')
  }

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
    contentJson: {
      problem: parsed.problem,
      thinkingGuide,
      solution: solutionStr,
      createdIn: params.createdIn === 'exam' ? 'exam' : 'worksheet',
    },
    order,
    source: 'ai',
  })

  return row ? { id: row.id } : null
}

/** Giữ suất miễn phí hoặc trừ 0,5 credit sau khi câu tạo xong. Trả false khi phải dừng vòng. */
async function acceptQuestionTurn(
  userId: string,
  curriculumId: string | null,
  kind: 'quiz' | 'essay',
  ids: string[],
  stoppedForCredits: { value: boolean; balance: number; required: number },
  rejectedDraft: { reason: string },
  create: () => Promise<string | null>
): Promise<boolean> {
  const turn = await beginQuestionTurn(userId, curriculumId, kind)
  if (turn.action === 'stop') {
    stoppedForCredits.value = true
    stoppedForCredits.balance = turn.balance
    stoppedForCredits.required = turn.required
    return false
  }
  let questionId: string | null = null
  try {
    questionId = await create()
  } catch (error) {
    if (turn.action === 'free') await turn.undo()
    if (error instanceof InvalidModelDraftError) {
      rejectedDraft.reason = error.message
      return true
    }
    throw error
  }
  if (!questionId) {
    if (turn.action === 'free') await turn.undo()
    return true
  }
  if (turn.action === 'pay') {
    const charged = await chargeWorksheetQuestion({ userId, curriculumId, kind, questionId })
    if (!charged.ok) {
      await discardWorksheetQuestion(questionId)
      stoppedForCredits.value = true
      return false
    }
  }
  ids.push(questionId)
  return true
}

export async function runStepByStep(
  userId: string,
  params: StepByStepParams,
  type: 'quiz' | 'essay'
): Promise<StepByStepResult> {
  if (!isPgConfigured()) throw new Error('DATABASE_URL chưa cấu hình')

  const ids: string[] = []
  const count = Math.max(1, Math.min(params.count, type === 'quiz' ? 20 : 10))

  const stoppedForCredits = { value: false, balance: 0, required: 0.5 }
  const rejectedDraft = { reason: '' }
  if (type === 'quiz') {
    const existingQuizContents: Array<{ question: string; options?: string[] }> = []
    for (let i = 0; i < count; i++) {
      const accepted = await acceptQuestionTurn(userId, params.curriculumId, 'quiz', ids, stoppedForCredits, rejectedDraft, async () => {
        const row = await createOneQuiz(userId, params, existingQuizContents, ids.length)
        if (!row) return null
        const cj = await fetchWorksheetQuestionContentJsonByIdPg(row.id)
        const c = cj?.content_json as { question?: string; options?: string[] } | undefined
        if (c?.question) existingQuizContents.push({ question: c.question, options: (c.options ?? []).slice(0, 4) })
        return row.id
      })
      if (!accepted) break
    }
  } else {
    const existingEssayProblems: string[] = []
    for (let i = 0; i < count; i++) {
      const accepted = await acceptQuestionTurn(userId, params.curriculumId, 'essay', ids, stoppedForCredits, rejectedDraft, async () => {
        const row = await createOneEssay(userId, params, existingEssayProblems, ids.length)
        if (!row) return null
        const cj = await fetchWorksheetQuestionContentJsonByIdPg(row.id)
        const c = cj?.content_json as { problem?: string } | undefined
        if (c?.problem) existingEssayProblems.push(c.problem)
        return row.id
      })
      if (!accepted) break
    }
  }

  if (ids.length === 0) {
    if (stoppedForCredits.value) {
      throw new WorksheetCreditsError(stoppedForCredits.required, stoppedForCredits.balance, 0)
    }
    throw new Error(rejectedDraft.reason || 'Không tạo được câu hỏi nào.')
  }

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
