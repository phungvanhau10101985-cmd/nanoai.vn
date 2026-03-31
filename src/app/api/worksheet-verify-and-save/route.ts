/**
 * Giáo viên sửa tay câu hỏi → AI (DeepSeek) kiểm tra → nếu OK lưu vào worksheet_questions.
 * Dùng khi câu hỏi không qua kiểm tra sau 3 lần thử.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { verifyQuizWithDeepSeek, verifyEssayWithDeepSeek } from '@/app/tao-giao-trinh/lib/worksheet-verify-oneshot'
import { fixQuizWhenVerifyFailed, fixEssayWhenVerifyFailed } from '@/app/tao-giao-trinh/lib/worksheet-regenerate'
import { normalizeSolutionToStr } from '@/app/tao-giao-trinh/lib/worksheet-content-json'
import { questionsToMarkdown } from '@/app/tao-giao-trinh/lib/questions-to-markdown'

async function getQuestionsToMarkdown(supabase: ReturnType<typeof createClient>, questionIds: string[]) {
  const { data: rows } = await supabase
    .from('worksheet_questions')
    .select('id, type, content_json, difficulty, source, verified_at')
    .in('id', questionIds)
  const ordered = questionIds.map((id) => rows?.find((r) => r.id === id)).filter(Boolean) as Array<{ id: string; type: string; content_json: unknown; difficulty?: string; source?: string; verified_at?: string | null }>
  return questionsToMarkdown(ordered)
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const userId = auth.user?.id

    const body = await req.json().catch(() => ({}))
    const type = String(body?.type ?? '').trim() as 'quiz' | 'essay'
    const curriculumMarkdown = String(body?.curriculumMarkdown ?? '').trim()
    const worksheetId = (body?.worksheetId as string) || null
    const curriculumId = (body?.curriculumId as string) || null
    const topic = String(body?.topic ?? '').trim() || 'Phiếu bài tập'
    const subjectId = String(body?.subjectId ?? 'toan').trim() || 'toan'
    const gradeLevelId = String(body?.gradeLevelId ?? 'lop-6').trim() || 'lop-6'

    if (!curriculumMarkdown) return NextResponse.json({ error: 'Thiếu giáo trình.' }, { status: 400 })
    if (type !== 'quiz' && type !== 'essay') return NextResponse.json({ error: 'Thiếu type (quiz hoặc essay).' }, { status: 400 })

    const fullContent = topic ? `## ${topic}\n\n${curriculumMarkdown}` : curriculumMarkdown

    if (type === 'quiz') {
      const q = body?.content as { question?: string; options?: string[]; correctIndex?: number }
      if (!q?.question || !Array.isArray(q.options) || q.options.length < 4) {
        return NextResponse.json({ error: 'Thiếu nội dung câu trắc nghiệm (question, options).' }, { status: 400 })
      }
      const opts = q.options.slice(0, 4)
      const correctIndex = Math.max(0, Math.min(q.correctIndex ?? 0, 3))
      const quiz = { question: q.question, options: opts, correctIndex }

      const verifyResult = await verifyQuizWithDeepSeek(fullContent, quiz, userId ?? null)
      let finalQuiz = quiz
      if (verifyResult && !verifyResult.verified && (verifyResult.question || verifyResult.options || typeof verifyResult.correctIndex === 'number')) {
        if (verifyResult.question) finalQuiz = { ...finalQuiz, question: verifyResult.question }
        if (verifyResult.options) finalQuiz = { ...finalQuiz, options: verifyResult.options }
        if (typeof verifyResult.correctIndex === 'number' && verifyResult.correctIndex >= 0 && verifyResult.correctIndex <= 3) {
          finalQuiz = { ...finalQuiz, correctIndex: verifyResult.correctIndex }
        }
      } else if (verifyResult && !verifyResult.verified) {
        const fixed = await fixQuizWhenVerifyFailed(fullContent, quiz, userId ?? null)
        if (fixed) finalQuiz = fixed
        else
          return NextResponse.json({
            success: false,
            verified: false,
            error: 'Câu hỏi chưa đúng. AI không sửa được. Vui lòng sửa tay và thử lại.',
            reason: verifyResult?.correctIndex != null ? `Đáp án đúng có thể là ${String.fromCharCode(65 + verifyResult.correctIndex)}` : undefined,
          })
      } else if (!verifyResult?.verified) {
        return NextResponse.json({
          success: false,
          verified: false,
          error: 'Không kiểm tra được. Vui lòng thử lại.',
        })
      } else if (verifyResult?.verified && typeof verifyResult.correctIndex === 'number' && verifyResult.correctIndex >= 0 && verifyResult.correctIndex <= 3) {
        finalQuiz = { ...finalQuiz, correctIndex: verifyResult.correctIndex }
      }

      const { data: qRow, error: qErr } = await supabase
        .from('worksheet_questions')
        .insert({
          user_id: userId,
          curriculum_id: curriculumId || null,
          type: 'quiz',
          subject_id: subjectId,
          grade_level_id: gradeLevelId,
          topic: topic || null,
          difficulty: 'medium',
          content_json: { question: finalQuiz.question, options: finalQuiz.options, correctIndex: finalQuiz.correctIndex },
          source: 'ai',
          order: 0,
          verified_at: verifyResult?.verified ? new Date().toISOString() : null,
        })
        .select('id')
        .single()

      if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })

      if (worksheetId) {
        const { data: ws, error: wsErr } = await supabase.from('worksheet_worksheets').select('user_id, question_ids').eq('id', worksheetId).single()
        if (wsErr || !ws) return NextResponse.json({ error: 'Không tìm thấy phiếu bài tập.' }, { status: 404 })
        if (ws.user_id !== userId) return NextResponse.json({ error: 'Bạn không có quyền sửa phiếu này.' }, { status: 403 })
        const existingIds = (ws.question_ids ?? []) as string[]
        const newIds = [...existingIds, qRow!.id]
        const newMarkdown = await getQuestionsToMarkdown(supabase, newIds)
        const { error: updateErr } = await supabase.from('worksheet_worksheets').update({ question_ids: newIds, content_markdown: newMarkdown }).eq('id', worksheetId)
        if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, verified: true, questionId: qRow?.id })
    }

    const e = body?.content as { problem?: string; solution?: unknown }
    const problem = (e?.problem ?? '').trim()
    const solution = normalizeSolutionToStr(e?.solution) || String(e?.solution ?? '').trim()
    if (!problem || !solution) {
      return NextResponse.json({ error: 'Thiếu nội dung bài tự luận (problem, solution).' }, { status: 400 })
    }

    const verifyResult = await verifyEssayWithDeepSeek(fullContent, problem, solution)
    let finalEssay = { problem, solution }
    if (verifyResult && !verifyResult.verified && (verifyResult.problem || verifyResult.solution)) {
      if (verifyResult.problem) finalEssay = { ...finalEssay, problem: verifyResult.problem }
      if (verifyResult.solution) finalEssay = { ...finalEssay, solution: normalizeSolutionToStr(verifyResult.solution) || verifyResult.solution }
    } else if (verifyResult && !verifyResult.verified) {
      const fixed = await fixEssayWhenVerifyFailed(fullContent, { problem, solution }, userId ?? null)
      if (fixed) finalEssay = fixed
      else
        return NextResponse.json({
          success: false,
          verified: false,
          error: 'Bài tự luận chưa đúng. AI không sửa được. Vui lòng sửa tay và thử lại.',
          reason: verifyResult?.reason,
        })
    } else if (!verifyResult?.verified) {
      return NextResponse.json({
        success: false,
        verified: false,
        error: 'Không kiểm tra được. Vui lòng thử lại.',
      })
    }

    const { data: eRow, error: eErr } = await supabase
      .from('worksheet_questions')
      .insert({
        user_id: userId,
        curriculum_id: curriculumId || null,
        type: 'essay',
        subject_id: subjectId,
        grade_level_id: gradeLevelId,
        topic: topic || null,
        difficulty: 'medium',
        content_json: { problem: finalEssay.problem, solution: normalizeSolutionToStr(finalEssay.solution) || finalEssay.solution },
        source: 'ai',
        order: 0,
        verified_at: verifyResult?.verified ? new Date().toISOString() : null,
      })
      .select('id')
      .single()

    if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 })

    if (worksheetId) {
      const { data: ws, error: wsErr } = await supabase.from('worksheet_worksheets').select('user_id, question_ids').eq('id', worksheetId).single()
      if (wsErr || !ws) return NextResponse.json({ error: 'Không tìm thấy phiếu bài tập.' }, { status: 404 })
      if (ws.user_id !== userId) return NextResponse.json({ error: 'Bạn không có quyền sửa phiếu này.' }, { status: 403 })
      const existingIds = (ws.question_ids ?? []) as string[]
      const newIds = [...existingIds, eRow!.id]
      const newMarkdown = await getQuestionsToMarkdown(supabase, newIds)
      const { error: updateErr } = await supabase.from('worksheet_worksheets').update({ question_ids: newIds, content_markdown: newMarkdown }).eq('id', worksheetId)
      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, verified: true, questionId: eRow?.id })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
