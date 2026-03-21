/**
 * Handler parse SGK – dùng chung cho API route và worker.
 * Chấp nhận imageUrls (từ storage) thay vì File.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_PRO } from '@/lib/gemini-config'
import { questionsToMarkdown } from '@/app/tao-giao-trinh/lib/questions-to-markdown'
import { normalizeSolutionToStr } from '@/app/tao-giao-trinh/lib/worksheet-content-json'

function stripOptionPrefix(opt: string): string {
  return String(opt ?? '').replace(/^[A-D]\.\s*/i, '').trim() || String(opt ?? '')
}

/** Số hiệu bài SGK từ AI (vd: "1.3 1") — chỉ lưu khi chuỗi hợp lệ. */
function pickExerciseNumber(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const t = raw.replace(/\s+/g, ' ').trim().slice(0, 48)
  return t || undefined
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
  const raw = result.response.text()?.trim() || ''
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
    const p = JSON.parse(cleaned) as { solution?: unknown }
    return normalizeSolutionToStr(p?.solution) || ''
  } catch {
    return ''
  }
}

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

export async function runParseSgk(
  supabase: SupabaseClient,
  userId: string,
  params: ParseSgkParams,
  options?: ParseSgkOptions
): Promise<ParseSgkResult> {
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

  if (curriculumId || worksheetId) {
    const q = worksheetId
      ? await supabase.from('worksheet_worksheets').select('id, question_ids').eq('id', worksheetId).single()
      : await supabase.from('worksheet_worksheets').select('id, question_ids').eq('curriculum_id', curriculumId!).order('created_at', { ascending: false }).limit(1).maybeSingle()
    const ws = Array.isArray(q.data) ? q.data[0] : q.data
    const qIds = ((ws?.question_ids ?? []) as string[]).filter(Boolean)
    if (ws?.id) existingWorksheetId = ws.id
    if (qIds.length > 0) {
      existingIds = qIds
      const { data: qRows } = await supabase.from('worksheet_questions').select('id, type, content_json').in('id', qIds)
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

  const prompt = `Đây là ảnh trang bài tập sách giáo khoa. Nhiệm vụ: TÁCH TỪNG CÂU BÀI TẬP thành JSON.
${existingBlock}

QUY TẮC:
- Mỗi câu = 1 item. Trắc nghiệm: có 4 đáp án A/B/C/D. Tự luận: có đề bài + lời giải.
- Trắc nghiệm: difficulty = easy | medium | hard (Dễ/Trung bình/Khó).
- Tự luận: difficulty = nhan-biet | thong-hieu | van-dung-thap | van-dung-cao | thuc-te (Bloom).
- Unicode: π, ∫, x², √, ∈, ℝ. KHÔNG LaTeX. options: CHỈ nội dung, KHÔNG thêm "A." "B." vào đầu.
- KHÔNG tạo câu trùng với danh sách đã có ở trên.
- BÀI TỰ LUẬN: BẮT BUỘC trích xuất ĐẦY ĐỦ lời giải từ SGK nếu có trong ảnh. Nếu sách có phần "Đáp án", "Lời giải", "Hướng dẫn" thì copy toàn bộ vào trường solution. Không được để solution rỗng nếu có trong ảnh. CHỈ đưa MỘT lần lời giải, KHÔNG lặp lại nội dung. Trường solution CHỈ chứa nội dung lời giải thuần, KHÔNG thêm tiêu đề như "Lời giải:", "**Lời giải:**", "Đáp án:".

TÁCH Ý (a)(b)(c) — BẮT BUỘC áp dụng đúng:
- Nếu một số bài có nhiều ý (a), (b), (c)... mà MỖI Ý LÀ MỘT YÊU CẦU ĐỘC LẬP (ví dụ: mỗi ý cho một hàm số/biểu thức khác nhau cùng dạng bài; mỗi ý một phương trình riêng; các câu không dùng chung kết quả của nhau) → tách thành NHIỀU phần tử riêng trong "essays" (hoặc "quizzes" nếu là TN), mỗi phần tử một problem/question + solution/đáp án tương ứng CHỈ của ý đó.
- Với mỗi phần tử đã tách, BẮT BUỘC thêm trường "exerciseNumber" dạng "X.Y 1", "X.Y 2", "X.Y 3"... trong đó X.Y là số bài gốc trên SGK (ví dụ 1.3), số sau dấu cách là thứ tự ý đã tách. Ví dụ bài 1.3 có (a)(b) độc lập → hai item essays: exerciseNumber "1.3 1" và "1.3 2". Trong "problem" của từng item: có thể lặp lại câu dẫn chung (nếu có) + nội dung đúng một ý (a) hoặc (b) và lời giải tương ứng trong "solution".
- Nếu các ý PHỤ THUỘC LẪN NHAU hoặc cùng một bài toán nhiều bước (ví dụ: (a) chứng minh, (b) dùng kết quả (a); (b) tiếp nối ngữ cảnh (a); "từ (a) suy ra (b)"; các câu trong cùng một tình huống không tách được) → GIỮ MỘT phần tử duy nhất, "problem" ghi đầy đủ cả bài kèm các ý. Khi đó "exerciseNumber" chỉ cần "X.Y" hoặc có thể bỏ qua trường này.
- Cùng quy tắc với trắc nghiệm: nhiều câu TN độc lập trong cùng khung số bài → tách nhiều quiz, mỗi cái có exerciseNumber "1.1 1", "1.1 2" nếu cần.

Trả về JSON:
{
  "quizzes": [ { "question": "...", "options": ["...","...","...","..."], "correctIndex": 0-3, "difficulty": "easy|medium|hard", "exerciseNumber": "1.1 1 (tùy chọn, khi tách ý hoặc số SGK)" } ],
  "essays": [ { "problem": "...", "solution": "...", "difficulty": "nhan-biet|thong-hieu|van-dung-thap|van-dung-cao|thuc-te", "exerciseNumber": "1.3 1 (tùy chọn)" } ]
}

Chỉ trả về JSON, không markdown.`

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    ...GEMINI_25_PRO,
    generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
  })
  const result = await model.generateContent([prompt, ...imageParts])
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
    const exNum = pickExerciseNumber(q.exerciseNumber)
    const { data: row, error } = await supabase
      .from('worksheet_questions')
      .insert({
        user_id: userId,
        curriculum_id: curriculumId || null,
        type: 'quiz',
        subject_id: subjectId,
        grade_level_id: gradeLevelId,
        topic: topic || null,
        difficulty: diff,
        content_json: { question: q.question, options, correctIndex, ...(exNum ? { exerciseNumber: exNum } : {}) },
        source: 'sgk',
        order: order++,
      })
      .select('id')
      .single()
    if (!error && row?.id) questionIds.push(row.id)
  }

  for (const e of essays) {
    if (!e?.problem) continue
    let solution = normalizeSolutionToStr(e.solution) || ''
    const isEmpty = !solution || solution === '(Chưa có lời giải)' || solution.trim().length < 30
    if (isEmpty && apiKey && solveMissingEssaySolutions) {
      const generated = await generateEssaySolution(
        e.problem,
        topic,
        curriculumMarkdown,
        apiKey,
        essayNeedsImage(e.problem) ? imageParts : undefined
      )
      if (generated) solution = generated
    }
    if (!solution) solution = '(Chưa có lời giải)'
    const diff = ['nhan-biet', 'thong-hieu', 'van-dung-thap', 'van-dung-cao', 'thuc-te'].includes(String(e.difficulty ?? '')) ? e.difficulty : 'thong-hieu'
    const exNum = pickExerciseNumber(e.exerciseNumber)
    const { data: row, error } = await supabase
      .from('worksheet_questions')
      .insert({
        user_id: userId,
        curriculum_id: curriculumId || null,
        type: 'essay',
        subject_id: subjectId,
        grade_level_id: gradeLevelId,
        topic: topic || null,
        difficulty: diff,
        content_json: { problem: e.problem, solution, ...(exNum ? { exerciseNumber: exNum } : {}) },
        source: 'sgk',
        order: order++,
      })
      .select('id')
      .single()
    if (!error && row?.id) questionIds.push(row.id)
  }

  if (questionIds.length === 0) throw new Error('Không tách được câu nào từ ảnh.')

  const { data: newRows } = await supabase.from('worksheet_questions').select('id, type').in('id', questionIds)
  const newTypesMap = new Map((newRows ?? []).map((r) => [r.id, r.type]))

  let finalIds: string[]
  let finalMarkdown: string
  let targetWorksheetId: string | null = null

  if (existingWorksheetId) {
    targetWorksheetId = existingWorksheetId
    finalIds = mergeQuestionIds(existingIds, existingTypes, questionIds, newTypesMap)
    const { data: allRows } = await supabase.from('worksheet_questions').select('id, type, content_json, difficulty, source, verified_at').in('id', finalIds)
    const ordered = finalIds.map((id) => allRows?.find((r) => r.id === id)).filter(Boolean) as Array<{ id: string; type: string; content_json: unknown; difficulty?: string; source?: string }>
    finalMarkdown = questionsToMarkdown(ordered)
    const { error: upErr } = await supabase.from('worksheet_worksheets').update({ content_markdown: finalMarkdown, question_ids: finalIds }).eq('id', existingWorksheetId)
    if (upErr) throw new Error(upErr.message)
  } else {
    finalIds = questionIds
    const { data: allRows } = await supabase.from('worksheet_questions').select('id, type, content_json, difficulty, source, verified_at').in('id', finalIds)
    const ordered = finalIds.map((id) => allRows?.find((r) => r.id === id)).filter(Boolean) as Array<{ id: string; type: string; content_json: unknown; difficulty?: string; source?: string }>
    finalMarkdown = questionsToMarkdown(ordered)
    const { data: ins } = await supabase
      .from('worksheet_worksheets')
      .insert({ user_id: userId, curriculum_id: curriculumId, topic, subject_id: subjectId, grade_level_id: gradeLevelId, content_markdown: finalMarkdown, question_ids: finalIds })
      .select('id')
      .single()
    targetWorksheetId = ins?.id ?? null
  }

  // sgk_image_urls – dùng luôn imageUrls từ params (đã upload ở submit API)
  if (targetWorksheetId && imageUrls.length > 0) {
    const { data: ws } = await supabase.from('worksheet_worksheets').select('sgk_image_urls').eq('id', targetWorksheetId).single()
    const existing = ((ws?.sgk_image_urls ?? []) as string[]).filter(Boolean)
    const merged = [...existing, ...imageUrls]
    await supabase.from('worksheet_worksheets').update({ sgk_image_urls: merged }).eq('id', targetWorksheetId)
  }

  return {
    worksheetId: targetWorksheetId,
    worksheetMarkdown: finalMarkdown,
    addedCount: questionIds.length,
    quizCount: questionIds.filter((id) => newTypesMap.get(id) === 'quiz').length,
    essayCount: questionIds.filter((id) => newTypesMap.get(id) === 'essay').length,
  }
}
