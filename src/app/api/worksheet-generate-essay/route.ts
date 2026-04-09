import { NextRequest, NextResponse } from 'next/server'
import {
  fetchWorksheetQuestionsByCurriculumLatestSheetFromPg,
  insertWorksheetQuestionPg,
} from '@/lib/db/worksheet-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { getUserForAction } from '@/lib/auth'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_PRO } from '@/lib/gemini-config'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import { normalizeSolutionToStr } from '@/app/tao-giao-trinh/lib/worksheet-content-json'

/** 5 mức độ Bloom cho tự luận – giống phiếu tạo một lần */
type EssayBloomLevel = 'nhan-biet' | 'thong-hieu' | 'van-dung-thap' | 'van-dung-cao' | 'thuc-te'
const ESSAY_BLOOM_PROMPT: Record<EssayBloomLevel, string> = {
  'nhan-biet': 'Mức 1 – Nhận biết: bài tập cơ bản, áp dụng trực tiếp công thức.',
  'thong-hieu': 'Mức 2 – Thông hiểu: cần hiểu khái niệm, suy luận nhẹ.',
  'van-dung-thap': 'Mức 3 – Vận dụng thấp: áp dụng kiến thức vào bài toán quen thuộc.',
  'van-dung-cao': 'Mức 4 – Vận dụng cao: phân tích, tổng hợp, bài phức tạp hơn.',
  'thuc-te': 'Mức 4 – Vận dụng cao (Thực tế): bài toán thực tế, tình huống đời sống.',
}
const ESSAY_BLOOM_VALUES: EssayBloomLevel[] = ['nhan-biet', 'thong-hieu', 'van-dung-thap', 'van-dung-cao', 'thuc-te']

const ESSAY_SCHEMA = `{"problem":"Đề bài (câu hỏi)","solution":"Lời giải chi tiết từng bước"}`

function buildPrompt(curriculumMarkdown: string, topic: string, bloomLevel: EssayBloomLevel, existingProblems: string[]): string {
  const diff = ESSAY_BLOOM_PROMPT[bloomLevel] ?? ESSAY_BLOOM_PROMPT['thong-hieu']
  const existingBlock =
    existingProblems.length > 0
      ? `\n⚠️ ĐÃ CÓ CÁC BÀI SAU – KHÔNG tạo trùng:\n${existingProblems.map((p, i) => `${i + 1}. ${p.slice(0, 200)}${p.length > 200 ? '...' : ''}`).join('\n')}\n`
      : ''
  return `Bạn là giáo viên. Tạo ĐÚNG 1 BÀI TỰ LUẬN MỚI (khác hẳn các bài đã có) từ GIÁO TRÌNH.${existingBlock}

${diff}

QUY TẮC:
- Unicode: π, ∫, x², √, ∈, ℝ, ⇒. KHÔNG LaTeX $...$.
- Phân số: 1/2 hoặc ½. Căn: √(x+1).
- Đề bài rõ ràng. Lời giải từng bước, logic. Trường "solution" phải là CHUỖI văn bản thuần, không dùng mảng hay object.
- CHỈ viết MỘT lần lời giải. KHÔNG lặp lại "Lời giải" hay nội dung tương tự hai lần.
- CẤM hàm số thiếu tham số quan trọng để vẽ đồ thị (vd: y = ax⁴ + bx² + c với a, b, c chưa cho). Phải ghi rõ giá trị cụ thể.
- CẤM đề "nhìn hình", "đồ thị trong hình bên" – phiếu không có hình. Cho đủ thông tin bằng chữ.
- Chỉ trả về JSON, không markdown.

GIÁO TRÌNH:
---
${curriculumMarkdown.slice(0, 6000)}
---

Chủ đề: ${topic}

Schema: ${ESSAY_SCHEMA}`
}

/** Tạo 1 bài tự luận, lưu DB, hiển thị ngay. Verify chạy ngầm sau (qua worksheet-verify-background). */
export async function POST(req: NextRequest) {
  try {
    const auth = await getUserForAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const userId = auth.user?.id

    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Chưa cấu hình cơ sở dữ liệu.' }, { status: 503 })
    }

    const body = await req.json().catch(() => ({}))
    const curriculumMarkdown = String(body?.curriculumMarkdown ?? '').trim()
    const topic = String(body?.topic ?? '').trim()
    const subjectId = String(body?.subjectId ?? 'toan')
    const gradeLevelId = String(body?.gradeLevelId ?? 'lop-6')
    const curriculumId = (body?.curriculumId as string) || null
    const lessonTopics = Array.isArray(body?.lessonTopics) ? (body.lessonTopics as string[]).filter(Boolean) : undefined
    const difficultyRaw = String(body?.difficulty ?? 'thong-hieu').toLowerCase().replace(/\s+/g, '-')
    const difficulty: EssayBloomLevel = ESSAY_BLOOM_VALUES.includes(difficultyRaw as EssayBloomLevel)
      ? (difficultyRaw as EssayBloomLevel)
      : 'thong-hieu'
    const order = Math.max(0, Number(body?.order) ?? 0)
    let existingProblems = Array.isArray(body?.existingProblems) ? (body.existingProblems as string[]).filter((p): p is string => typeof p === 'string' && p.trim().length > 0) : []

    if (curriculumId) {
      const sessionCount = Math.max(0, Number(body?.sessionEssayCountByBloom?.[difficulty] ?? 0))
      const qRows = await fetchWorksheetQuestionsByCurriculumLatestSheetFromPg(curriculumId)
      if (qRows === null) {
        return NextResponse.json({ error: 'Lỗi đọc câu hỏi giáo trình.' }, { status: 500 })
      }

      const questionRows = qRows
      let worksheetCount = 0
      if (questionRows.length > 0) {
        const fromWorksheet = questionRows
          .filter((r: { type: string }) => r.type === 'essay')
          .map((r: { content_json?: unknown }) => (r.content_json as { problem?: string })?.problem ?? '')
          .filter(Boolean)
        existingProblems = [...fromWorksheet, ...existingProblems]
        for (const r of questionRows) {
          if (r.type === 'essay' && r.difficulty === difficulty) worksheetCount++
        }
      }
      if (worksheetCount + sessionCount >= 6)
        return NextResponse.json({ error: `Đã đủ 6 bài tự luận loại ${difficulty}.` }, { status: 400 })
    }

    if (!curriculumMarkdown) return NextResponse.json({ error: 'Thiếu giáo trình.' }, { status: 400 })

    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Thiếu GOOGLE_API_KEY.' }, { status: 500 })

    const prompt = buildPrompt(curriculumMarkdown, topic || 'Bài học', difficulty, existingProblems)
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      ...GEMINI_25_PRO,
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
    })
    const result = await model.generateContent(prompt)
    void trackFromUsageMetadata(
      result.response.usageMetadata,
      GEMINI_25_PRO.model,
      'worksheet-generate-essay-gemini-pro',
      userId ?? null
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
    if (!parsed) return NextResponse.json({ error: 'AI không tạo được bài tự luận hợp lệ.' }, { status: 500 })

    const solutionStr = normalizeSolutionToStr(parsed.solution) || String(parsed.solution ?? '').trim()
    const contentJson = { problem: parsed.problem, solution: solutionStr }

    const row = await insertWorksheetQuestionPg({
      userId: userId!,
      curriculumId,
      type: 'essay',
      subjectId,
      gradeLevelId,
      topic: topic || null,
      lessonTopics,
      difficulty,
      contentJson,
      order,
    })
    if (!row) {
      return NextResponse.json({ error: 'Lỗi lưu câu hỏi.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, question: row })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
