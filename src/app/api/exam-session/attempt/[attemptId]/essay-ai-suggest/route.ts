import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { parseExamGradingMeta } from '@/lib/exam-feedback'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'
import { isPublicExamEssayImageUrl } from '@/lib/exam-essay-config'
import { getEssaySolution } from '@/app/tao-giao-trinh/lib/worksheet-content-json'

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

const MAX_TOTAL_INLINE_IMAGES = 14
const MAX_IMAGES_PER_QUESTION = 8
const MAX_IMAGE_BYTES = 4_800_000

type InlineImagePart = { inlineData: { mimeType: string; data: string } }

async function fetchImageAsInlinePart(url: string): Promise<InlineImagePart | null> {
  if (!isPublicExamEssayImageUrl(url)) return null
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(25_000), cache: 'no-store' })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length <= 0 || buf.length > MAX_IMAGE_BYTES) return null
    let mime = (res.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase() || ''
    if (!mime.startsWith('image/')) mime = 'image/jpeg'
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) mime = 'image/jpeg'
    return { inlineData: { mimeType: mime, data: buf.toString('base64') } }
  } catch {
    return null
  }
}

function safeParseAi(text: string): { suggestedPoints: number; rationale: string } | null {
  const cleaned = String(text || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```/i, '')
    .replace(/```$/i, '')
    .trim()
  try {
    const o = JSON.parse(cleaned) as { suggestedPoints?: unknown; rationale?: unknown }
    const sp = Number(o.suggestedPoints)
    const rationale = String(o.rationale ?? '').trim()
    if (!Number.isFinite(sp) || !rationale) return null
    return { suggestedPoints: sp, rationale }
  } catch {
    return null
  }
}

type ExamQuestionRow = {
  id: string
  question_text: string
  options: unknown
  order: number
  worksheet_question_id: string | null
  points: number | string | null
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const { attemptId } = await params
    if (!attemptId || !/^[0-9a-f-]{36}$/i.test(attemptId)) {
      return NextResponse.json({ error: 'Thiếu mã bài làm.' }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Chưa cấu hình GOOGLE_API_KEY.' }, { status: 500 })
    }

    const supabase = createClient()
    const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
    if ('error' in authResult) return NextResponse.json({ error: authResult.error }, { status: 401 })
    const { user } = authResult

    const db = admin()
    const { data: att, error: aErr } = await db
      .from('exam_attempts')
      .select('id, session_id, essay_submission, answers, grading_meta')
      .eq('id', attemptId)
      .maybeSingle()

    if (aErr || !att) return NextResponse.json({ error: 'Không tìm thấy bài làm.' }, { status: 404 })

    const { data: session, error: sErr } = await db
      .from('exam_sessions')
      .select('teacher_id')
      .eq('id', att.session_id)
      .maybeSingle()

    if (sErr || !session) return NextResponse.json({ error: 'Không tìm thấy phiên thi.' }, { status: 404 })
    if (String(session.teacher_id ?? '') !== user.id) {
      return NextResponse.json({ error: 'Bạn không có quyền.' }, { status: 403 })
    }

    const meta = parseExamGradingMeta(att.grading_meta)
    if (!meta || meta.essayPointsMax <= 0) {
      return NextResponse.json({ error: 'Không có tự luận.' }, { status: 400 })
    }

    const { data: questions } = await db
      .from('exam_questions')
      .select('id, question_text, options, "order", worksheet_question_id, points')
      .eq('session_id', att.session_id)
      .order('order', { ascending: true })

    const essaySubmission =
      att.essay_submission && typeof att.essay_submission === 'object'
        ? (att.essay_submission as Record<string, { text?: string; imageUrls?: string[] }>)
        : {}
    const answers = att.answers && typeof att.answers === 'object' ? (att.answers as Record<string, unknown>) : {}

    const essayQs = (questions ?? []).filter((q) => {
      const opts = Array.isArray(q.options) ? q.options : []
      return opts.length < 2
    }) as ExamQuestionRow[]

    if (essayQs.length === 0) {
      return NextResponse.json({ error: 'Không tìm thấy câu tự luận.' }, { status: 400 })
    }

    const wqIds = [
      ...new Set(
        essayQs.map((q) => (q.worksheet_question_id ? String(q.worksheet_question_id) : '')).filter(Boolean)
      ),
    ]

    const wqById = new Map<string, { content_json: unknown }>()
    if (wqIds.length > 0) {
      const { data: wqRows } = await db.from('worksheet_questions').select('id, content_json').in('id', wqIds)
      for (const r of wqRows ?? []) {
        wqById.set(String((r as { id: string }).id), {
          content_json: (r as { content_json: unknown }).content_json,
        })
      }
    }

    let sumPerQuestionCaps = 0
    for (const q of essayQs) {
      const p = Number(q.points)
      sumPerQuestionCaps += Number.isFinite(p) && p > 0 ? p : 0
    }

    const intro = `Bạn là giáo viên chấm bài tự luận.

Bạn nhận được theo thứ tự: (1) phần hướng dẫn này, (2) với mỗi câu — đoạn text mô tả đề, lời giải tham khảo, điểm tối đa câu, bài làm text (nếu có), rồi các ẢNH bài làm của học sinh cho đúng câu đó (nếu có).

Nhiệm vụ:
- Đọc chữ viết tay / nội dung trong ảnh (nếu có ảnh). Học sinh có thể chỉ nộp ảnh, không có text — vẫn phải chấm dựa trên ảnh.
- So sánh bài làm (ảnh và/hoặc text) với ĐỀ và với LỜI GIẢI THAM KHẢO trong hệ thống (nếu có). Nếu ghi "(chưa có lời giải trong ngân hàng)", hãy đánh giá theo đề và mức hoàn thành hợp lý từ ảnh.
- Phân bổ điểm theo độ đúng / đầy đủ so với lời giải tham khảo và yêu cầu đề.

Tổng điểm tối đa cho toàn bộ phần tự luận: ${meta.essayPointsMax} điểm (chuẩn hệ thống).
Tổng trần theo từng câu (cộng các mức tối đa từng câu dưới đây): khoảng ${sumPerQuestionCaps || meta.essayPointsMax} điểm — hãy tham chiếu khi phân bổ; số điểm đề xuất cuối cùng không được vượt quá ${meta.essayPointsMax}.

Trả về ĐÚNG một JSON, không markdown, không text ngoài JSON:
{"suggestedPoints": <number>, "rationale": "<string ngắn gọn tiếng Việt, nêu rõ từng câu (nếu nhiều câu)>"}`

    const parts: Array<string | InlineImagePart> = [intro]

    let totalImagesAttached = 0
    let skippedImages = 0

    for (let i = 0; i < essayQs.length; i++) {
      const q = essayQs[i]!
      const qid = String(q.id)
      const stem = String(q.question_text ?? '').trim()
      const sub = essaySubmission[qid]
      const text = String(sub?.text ?? (typeof answers[qid] === 'string' ? answers[qid] : '') ?? '').trim()
      const rawUrls = Array.isArray(sub?.imageUrls) ? sub.imageUrls : []
      const urls = rawUrls.filter((u): u is string => typeof u === 'string' && isPublicExamEssayImageUrl(u.trim()))
      const pq = Math.max(0, Number(q.points))
      const cap = Number.isFinite(pq) && pq > 0 ? pq : meta.essayPointsMax / essayQs.length

      const wqKey = q.worksheet_question_id ? String(q.worksheet_question_id) : ''
      const wq = wqKey ? wqById.get(wqKey) : null
      const refSolution = wq ? getEssaySolution(wq.content_json).trim() : ''

      parts.push(
        `\n--- Câu ${i + 1} / ${essayQs.length} — tối đa khoảng ${Math.round(cap * 100) / 100} điểm ---\nĐề:\n${stem || '(trống)'}\n\nLời giải / đáp án tham khảo (ngân hàng câu hỏi):\n${
          refSolution || '(chưa có lời giải trong ngân hàng — chấm theo đề và nội dung ảnh)'
        }\n\nBài làm dạng text (nếu học sinh gõ):\n${text || '(không có — chỉ xem ảnh đính kèm ngay sau đây, nếu có)'}\n\nẢnh bài làm cho câu ${i + 1} (${urls.length} file hợp lệ; tối đa ${MAX_IMAGES_PER_QUESTION} ảnh/câu, tối đa ${MAX_TOTAL_INLINE_IMAGES} ảnh toàn bài):`
      )

      let usedThisQ = 0
      for (const u of urls) {
        if (totalImagesAttached >= MAX_TOTAL_INLINE_IMAGES || usedThisQ >= MAX_IMAGES_PER_QUESTION) {
          skippedImages++
          continue
        }
        const inline = await fetchImageAsInlinePart(u.trim())
        if (inline) {
          parts.push(inline)
          totalImagesAttached++
          usedThisQ++
        } else {
          skippedImages++
        }
      }
    }

    if (skippedImages > 0) {
      parts.push(
        `\n(Lưu ý: ${skippedImages} ảnh không đưa được vào prompt — do giới hạn số lượng/kích thước hoặc lỗi tải.)`
      )
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel(GEMINI_25_FLASH_NO_THINKING)
    const result = await model.generateContent(parts)
    const outText = result.response.text()
    const parsed = safeParseAi(outText)
    if (!parsed) {
      return NextResponse.json({ error: 'AI không trả về định dạng hợp lệ.' }, { status: 502 })
    }
    const clamped = Math.max(0, Math.min(meta.essayPointsMax, Math.round(parsed.suggestedPoints * 100) / 100))
    return NextResponse.json({
      suggestedPoints: clamped,
      rationale: parsed.rationale,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
