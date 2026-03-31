import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_PRO } from '@/lib/gemini-config'
import { trackFromUsageMetadata, trackOpenAiStyleCompletionUsage } from '@/lib/track-ai-usage'

const QUIZ_CREATE_MODEL = GEMINI_25_PRO
const GPT_RETRY_MODEL = process.env.EDUCATIONAL_RETRY_MODEL?.trim() || 'gpt-4o'
const QUIZ_SCHEMA = `{"quizzes":[{"question":"Câu hỏi?","options":["(2; +∞)","(−∞; 2)","(−∞; +∞)","(−2; 2)"],"correctIndex":0}]}`

function stripOptionPrefix(opt: string): string {
  return String(opt ?? '').replace(/^[A-D]\.\s*/i, '').trim() || String(opt ?? '')
}

/** Xáo trộn vị trí đáp án đúng để tránh luôn ở A. */
function shuffleCorrectPosition(options: string[], correctIndex: number): { options: string[]; correctIndex: number } {
  const correct = options[correctIndex]
  const rest = options.filter((_, i) => i !== correctIndex)
  const insertAt = Math.floor(Math.random() * (rest.length + 1))
  const shuffled = [...rest.slice(0, insertAt), correct, ...rest.slice(insertAt)]
  return { options: shuffled, correctIndex: insertAt }
}

type Difficulty = 'easy' | 'medium' | 'hard'
const DIFFICULTY_PROMPT: Record<Difficulty, string> = {
  easy: 'Độ khó DỄ: nhận biết, kiến thức cơ bản.',
  medium: 'Độ khó TRUNG BÌNH: thông hiểu, vận dụng đơn giản.',
  hard: 'Độ khó KHÓ: vận dụng cao, phân tích.',
}

function buildPrompt(curriculumMarkdown: string, topic: string, difficulty: Difficulty, existingQuestions: Array<{ question: string; options?: string[] }>): string {
  const diff = DIFFICULTY_PROMPT[difficulty] ?? DIFFICULTY_PROMPT.medium
  const existingBlock =
    existingQuestions.length > 0
      ? `\n⚠️ ĐÃ CÓ CÁC CÂU SAU – KHÔNG tạo trùng nội dung:\n${existingQuestions.map((eq, i) => `${i + 1}. ${eq.question} (${(eq.options ?? []).slice(0, 4).join(' | ')})`).join('\n')}\n`
      : ''
  return `Bạn là giáo viên. Tạo ĐÚNG 1 câu trắc nghiệm MỚI (khác hẳn các câu đã có) từ GIÁO TRÌNH dưới đây.${existingBlock}

⚠️ QUY TẮC SỐ 1 – KHÔNG tạo câu hỏi dạng nhìn đồ thị, nhìn ảnh, nhìn hình để trả lời. Phiếu không có hình. Phải cho hàm số cụ thể hoặc bảng biến thiên bằng chữ.

${diff}

QUY TẮC: Unicode (π, ∫, x², √, ∈, ℝ), 4 đáp án A/B/C/D, correctIndex 0-3. Tiếng Việt.
options: CHỈ nội dung đáp án, KHÔNG thêm "A." "B." "C." "D." vào đầu (vd: "(2; +∞)" không phải "A. (2; +∞)").
BẮT BUỘC phân bổ đáp án đúng – KHÔNG để correctIndex luôn là 0 (A). Xoay vòng A/B/C/D (câu 1→A, 2→B, 3→C, 4→D, 5→A...) hoặc chọn ngẫu nhiên 0-3.
KHÔNG tạo câu trắc nghiệm thiếu phần mở đầu và phần đặt câu hỏi. Mỗi câu phải có: (1) phần mở đầu/ngữ cảnh (Cho hàm số..., Cho bảng...), (2) phần đặt câu hỏi rõ ràng (Giá trị cực đại là?, Số điểm cực trị là?). CẤM mở đầu bằng bảng/số.
CẤM hàm số ax⁴+bx²+c chưa cho a,b,c – phải ghi rõ giá trị cụ thể.
Chỉ trả về JSON, không markdown.

GIÁO TRÌNH:
---
${curriculumMarkdown.slice(0, 6000)}
---

Chủ đề: ${topic}

Schema: ${QUIZ_SCHEMA}`
}

function parseQuizzes(raw: string): Array<{ question: string; options: string[]; correctIndex: number }> | null {
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
    const p = JSON.parse(cleaned) as { quizzes?: Array<{ question?: string; options?: string[]; correctIndex?: number }> }
    const list = Array.isArray(p?.quizzes) ? p.quizzes : []
    const q = list[0]
    if (!q?.question || !Array.isArray(q.options) || q.options.length < 4) return null
    const opts = (q.options ?? []).slice(0, 4)
    const idx = Math.max(0, Math.min(q.correctIndex ?? 0, 3))
    return [{ question: q.question, options: opts, correctIndex: idx }]
  } catch {
    return null
  }
}

/** Tạo 1 câu trắc nghiệm, lưu DB, hiển thị ngay. Verify chạy ngầm sau (qua worksheet-verify-background). */
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const userId = auth.user?.id

    const body = await req.json().catch(() => ({}))
    const curriculumMarkdown = String(body?.curriculumMarkdown ?? '').trim()
    const topic = String(body?.topic ?? '').trim()
    const subjectId = String(body?.subjectId ?? 'toan')
    const gradeLevelId = String(body?.gradeLevelId ?? 'lop-6')
    const curriculumId = (body?.curriculumId as string) || null
    const lessonTopics = Array.isArray(body?.lessonTopics) ? (body.lessonTopics as string[]).filter(Boolean) : undefined
    const difficultyRaw = String(body?.difficulty ?? 'medium').toLowerCase()
    const difficulty: Difficulty = ['easy', 'medium', 'hard'].includes(difficultyRaw) ? (difficultyRaw as Difficulty) : 'medium'
    const order = Math.max(0, Number(body?.order) ?? 0)
    const fromClient = Array.isArray(body?.existingQuestions) ? (body.existingQuestions as Array<{ question?: string; options?: string[] }>).filter((eq) => eq?.question).map((eq) => ({ question: String(eq.question), options: Array.isArray(eq.options) ? eq.options : [] })) : []
    let existingQuestions = fromClient

    if (curriculumId) {
      const { data: ws } = await supabase.from('worksheet_worksheets').select('question_ids').eq('curriculum_id', curriculumId).order('created_at', { ascending: false }).limit(1).maybeSingle()
      const qIds = ((ws?.question_ids ?? []) as string[]).filter(Boolean)
      const sessionCount = Math.max(0, Number(body?.sessionQuizCountByDiff?.[difficulty] ?? 0))
      let worksheetCount = 0
      if (qIds.length > 0) {
        const { data: qRows } = await supabase.from('worksheet_questions').select('id, type, content_json, difficulty').in('id', qIds)
        const fromWorksheet = (qRows ?? []).filter((r) => r.type === 'quiz').map((r) => {
          const c = r.content_json as { question?: string; options?: string[] }
          return { question: c?.question ?? '', options: (c?.options ?? []).slice(0, 4) }
        }).filter((eq) => eq.question)
        existingQuestions = [...fromWorksheet, ...fromClient]
        for (const r of qRows ?? []) {
          if (r.type === 'quiz' && (r.difficulty === difficulty || (!r.difficulty && difficulty === 'medium'))) worksheetCount++
        }
      }
      if (worksheetCount + sessionCount >= 10) return NextResponse.json({ error: `Đã đủ 10 câu trắc nghiệm mức ${difficulty === 'easy' ? 'Dễ' : difficulty === 'medium' ? 'Trung bình' : 'Khó'}.` }, { status: 400 })
    }

    if (!curriculumMarkdown) return NextResponse.json({ error: 'Thiếu giáo trình.' }, { status: 400 })

    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Thiếu GOOGLE_API_KEY.' }, { status: 500 })

    const prompt = buildPrompt(curriculumMarkdown, topic || 'Bài học', difficulty, existingQuestions)
    const genAI = new GoogleGenerativeAI(apiKey)

    const model = genAI.getGenerativeModel({
      ...QUIZ_CREATE_MODEL,
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
    })
    const result = await model.generateContent(prompt)
    void trackFromUsageMetadata(
      result.response.usageMetadata,
      QUIZ_CREATE_MODEL.model,
      'worksheet-quiz-generate-gemini-pro',
      userId ?? null
    )
    const raw = result.response.text()?.trim() || ''
    let quizzes = parseQuizzes(raw)

    if (!quizzes?.length && process.env.OPENAI_API_KEY) {
      const systemLine = 'Trả về đúng JSON.'
      const gpt = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: GPT_RETRY_MODEL,
          temperature: 0.1,
          response_format: { type: 'json_object' },
          messages: [{ role: 'system', content: systemLine }, { role: 'user', content: prompt }],
        }),
      })
      if (gpt.ok) {
        const g = (await gpt.json().catch(() => ({}))) as {
          choices?: Array<{ message?: { content?: string } }>
          usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
        }
        const gptRaw = String(g?.choices?.[0]?.message?.content ?? '')
        trackOpenAiStyleCompletionUsage({
          userId: userId ?? null,
          model: GPT_RETRY_MODEL,
          feature: 'worksheet-quiz-generate-openai-retry',
          usage: g.usage,
          fallbackPromptChars: systemLine.length + prompt.length,
          fallbackOutputChars: gptRaw.length,
        })
        quizzes = parseQuizzes(gptRaw)
      }
    }

    if (!quizzes?.length) return NextResponse.json({ error: 'AI không tạo được câu hỏi hợp lệ.' }, { status: 500 })

    const lastQuiz = quizzes[0]!
    const sanitizedOpts = lastQuiz.options.map(stripOptionPrefix)
    const { options: shuffledOpts, correctIndex: shuffledCorrect } = shuffleCorrectPosition(sanitizedOpts, lastQuiz.correctIndex)

    const { data: row, error } = await supabase
      .from('worksheet_questions')
      .insert({
        user_id: userId,
        curriculum_id: curriculumId || null,
        type: 'quiz',
        subject_id: subjectId,
        grade_level_id: gradeLevelId,
        topic: topic || null,
        lesson_topics: lessonTopics || null,
        difficulty,
        content_json: { question: lastQuiz.question, options: shuffledOpts, correctIndex: shuffledCorrect },
        source: 'ai',
        order,
      })
      .select('id, content_json, created_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, question: row })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
