/**
 * Chạy verify các câu trên một phiếu bài tập (dùng chung API ngầm + admin batch).
 * Mặc định chỉ câu chưa có verified_at; `reverifyAll` thì chạy lại cả câu đã verify.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  verifyQuizWithDeepSeek,
  verifyEssayWithDeepSeek,
  verifyQuizWithGemini,
  verifyEssayWithGemini,
  verifyQuizWithGeminiVision,
  verifyEssayWithGeminiVision,
} from '@/app/tao-giao-trinh/lib/worksheet-verify-oneshot'
import { fixQuizWhenVerifyFailed, fixEssayWhenVerifyFailed } from '@/app/tao-giao-trinh/lib/worksheet-regenerate'
import { getEssaySolution, normalizeSolutionToStr } from '@/app/tao-giao-trinh/lib/worksheet-content-json'
import { questionsToMarkdown } from '@/app/tao-giao-trinh/lib/questions-to-markdown'

export type RunWorksheetVerifyStats = {
  /** Số lần cập nhật content_json thành công */
  contentUpdates: number
  /** Số lần đóng verified_at thành công */
  markedVerified: number
  /** Câu bỏ qua (thiếu dữ liệu hợp lệ) */
  skippedInvalid: number
  errors: string[]
}

/**
 * @param supabase Client có quyền update worksheet_questions + worksheet_worksheets (user hoặc service role)
 */
export async function runWorksheetVerifyForSheet(
  supabase: SupabaseClient,
  worksheetId: string,
  options?: { curriculumMarkdownOverride?: string; reverifyAll?: boolean }
): Promise<RunWorksheetVerifyStats> {
  const stats: RunWorksheetVerifyStats = {
    contentUpdates: 0,
    markedVerified: 0,
    skippedInvalid: 0,
    errors: [],
  }

  if (!process.env.GOOGLE_API_KEY?.trim()) {
    stats.errors.push('GOOGLE_API_KEY chưa cấu hình')
    return stats
  }

  const { data: ws, error: wsErr } = await supabase
    .from('worksheet_worksheets')
    .select('id, user_id, curriculum_id, topic, question_ids, sgk_image_urls')
    .eq('id', worksheetId)
    .single()

  if (wsErr || !ws) {
    stats.errors.push(wsErr?.message || 'Không tìm thấy phiếu bài tập')
    return stats
  }

  const questionIds = ((ws.question_ids ?? []) as string[]).filter(Boolean)
  if (questionIds.length === 0) return stats

  let curriculumMarkdown = (options?.curriculumMarkdownOverride ?? '').trim()
  if (!curriculumMarkdown && ws.curriculum_id) {
    const { data: cur } = await supabase
      .from('worksheet_curricula')
      .select('content_markdown')
      .eq('id', ws.curriculum_id)
      .single()
    curriculumMarkdown = (cur?.content_markdown as string) ?? ''
  }
  const topic = (ws.topic as string) || 'Phiếu bài tập'
  const fullContent = topic ? `## ${topic}\n\n${curriculumMarkdown}` : curriculumMarkdown

  const { data: qRows, error: qErr } = await supabase
    .from('worksheet_questions')
    .select('id, type, content_json, difficulty, source, verified_at')
    .in('id', questionIds)

  if (qErr) {
    stats.errors.push(qErr.message)
    return stats
  }

  const ordered = questionIds.map((id) => qRows?.find((r) => r.id === id)).filter(Boolean) as Array<{
    id: string
    type: string
    content_json: unknown
    source?: string
    verified_at?: string | null
  }>

  const reverifyAll = options?.reverifyAll === true

  const sgkImageUrls = ((ws?.sgk_image_urls ?? []) as string[]).filter(Boolean)
  let imagePartsCache: Array<{ inlineData: { data: string; mimeType: string } }> | null = null

  async function getSgkImageParts(): Promise<Array<{ inlineData: { data: string; mimeType: string } }>> {
    if (imagePartsCache) return imagePartsCache
    if (sgkImageUrls.length === 0) return []
    const parts: Array<{ inlineData: { data: string; mimeType: string } }> = []
    for (const url of sgkImageUrls.slice(0, 10)) {
      try {
        const res = await fetch(url)
        if (!res.ok) continue
        const buf = Buffer.from(await res.arrayBuffer())
        const mime = res.headers.get('content-type') || 'image/png'
        parts.push({ inlineData: { data: buf.toString('base64'), mimeType: mime } })
      } catch {
        /* skip */
      }
    }
    imagePartsCache = parts
    return parts
  }

  for (const row of ordered) {
    if (!reverifyAll && row.verified_at) continue
    if (row.type === 'quiz') {
      const c = row.content_json as { question?: string; options?: string[]; correctIndex?: number }
      const q = {
        question: c?.question ?? '',
        options: (c?.options ?? []).slice(0, 4),
        correctIndex: Math.max(0, Math.min(c?.correctIndex ?? 0, 3)),
      }
      if (!q.question || q.options.length < 4) {
        stats.skippedInvalid++
        continue
      }

      let finalQ = q
      let needsUpdate = false
      /** SGK + có ảnh: verify vision trước để không bỏ qua đề đọc đồ thị */
      let skipTextVerifyPipeline = false
      if (row.source === 'sgk' && sgkImageUrls.length > 0) {
        const imageParts = await getSgkImageParts()
        if (imageParts.length > 0) {
          const visionFirst = await verifyQuizWithGeminiVision(fullContent, q, imageParts)
          if (visionFirst?.verified) {
            skipTextVerifyPipeline = true
          } else if (
            visionFirst &&
            !visionFirst.verified &&
            (visionFirst.correctIndex != null || visionFirst.question || visionFirst.options)
          ) {
            if (visionFirst.question) finalQ = { ...finalQ, question: visionFirst.question }
            if (visionFirst.options) finalQ = { ...finalQ, options: visionFirst.options }
            if (typeof visionFirst.correctIndex === 'number' && visionFirst.correctIndex >= 0 && visionFirst.correctIndex <= 3) {
              finalQ = { ...finalQ, correctIndex: visionFirst.correctIndex }
            }
            needsUpdate = true
            skipTextVerifyPipeline = true
          }
        }
      }

      if (skipTextVerifyPipeline) {
        /* đã xử lý bằng vision */
      } else {
      const deepSeekResult = await verifyQuizWithDeepSeek(fullContent, q)
      if (deepSeekResult && !deepSeekResult.verified) {
        let geminiResult: { verified: boolean; correctIndex?: number; question?: string; options?: string[] } | null = null
        if (deepSeekResult.needsImage && sgkImageUrls.length > 0 && row.source === 'sgk') {
          const imageParts = await getSgkImageParts()
          if (imageParts.length > 0) geminiResult = await verifyQuizWithGeminiVision(fullContent, q, imageParts)
        }
        if (!geminiResult) geminiResult = await verifyQuizWithGemini(fullContent, q)
        const verifyResult = geminiResult ?? deepSeekResult
        if (verifyResult.question || verifyResult.options || typeof verifyResult.correctIndex === 'number') {
          if (verifyResult.question) finalQ = { ...finalQ, question: verifyResult.question }
          if (verifyResult.options) finalQ = { ...finalQ, options: verifyResult.options }
          if (typeof verifyResult.correctIndex === 'number' && verifyResult.correctIndex >= 0 && verifyResult.correctIndex <= 3) {
            finalQ = { ...finalQ, correctIndex: verifyResult.correctIndex }
          }
          needsUpdate = true
        } else {
          const fixed = await fixQuizWhenVerifyFailed(fullContent, q)
          if (fixed) {
            finalQ = fixed
            needsUpdate = true
          }
        }
      }
      }
      if (needsUpdate) {
        const { error: upErr } = await supabase
          .from('worksheet_questions')
          .update({ content_json: { question: finalQ.question, options: finalQ.options, correctIndex: finalQ.correctIndex } })
          .eq('id', row.id)
        if (!upErr) stats.contentUpdates++
        else stats.errors.push(`quiz update ${row.id}: ${upErr.message}`)
      }
      const { error: markErr } = await supabase
        .from('worksheet_questions')
        .update({ verified_at: new Date().toISOString() })
        .eq('id', row.id)
      if (!markErr) stats.markedVerified++
      else stats.errors.push(`quiz verify mark ${row.id}: ${markErr.message}`)
    } else if (row.type === 'essay') {
      const c = row.content_json as { problem?: string; solution?: unknown }
      const problem = (c?.problem ?? '').trim()
      const solution = normalizeSolutionToStr(c?.solution) || getEssaySolution(c) || ''
      if (!problem || !solution) {
        stats.skippedInvalid++
        continue
      }

      let finalE = { problem, solution }
      let needsUpdate = false
      /** SGK + có ảnh: luôn verify vision trước — bắt lời giải chỉ đạo hàm khi đề yêu cầu đọc đồ thị */
      let skipTextVerifyPipeline = false
      if (row.source === 'sgk' && sgkImageUrls.length > 0) {
        const imageParts = await getSgkImageParts()
        if (imageParts.length > 0) {
          const visionFirst = await verifyEssayWithGeminiVision(fullContent, problem, solution, imageParts)
          if (visionFirst?.verified) {
            skipTextVerifyPipeline = true
          } else if (visionFirst && !visionFirst.verified && (visionFirst.problem || visionFirst.solution)) {
            if (visionFirst.problem) finalE = { ...finalE, problem: visionFirst.problem }
            if (visionFirst.solution) finalE = { ...finalE, solution: visionFirst.solution }
            needsUpdate = true
            skipTextVerifyPipeline = true
          }
        }
      }

      if (!skipTextVerifyPipeline) {
      const deepSeekResult = await verifyEssayWithDeepSeek(fullContent, problem, solution)
      if (deepSeekResult && !deepSeekResult.verified) {
        let geminiResult: { verified: boolean; problem?: string; solution?: string } | null = null
        if (deepSeekResult.needsImage && sgkImageUrls.length > 0 && row.source === 'sgk') {
          const imageParts = await getSgkImageParts()
          if (imageParts.length > 0) geminiResult = await verifyEssayWithGeminiVision(fullContent, problem, solution, imageParts)
        }
        if (!geminiResult) geminiResult = await verifyEssayWithGemini(fullContent, problem, solution)
        const verifyResult = geminiResult ?? deepSeekResult
        if (verifyResult.problem || verifyResult.solution) {
          if (verifyResult.problem) finalE = { ...finalE, problem: verifyResult.problem }
          if (verifyResult.solution) finalE = { ...finalE, solution: verifyResult.solution }
          needsUpdate = true
        } else {
          const fixed = await fixEssayWhenVerifyFailed(fullContent, { problem, solution })
          if (fixed) {
            finalE = fixed
            needsUpdate = true
          }
        }
      }
      }
      if (needsUpdate) {
        const solutionStr = normalizeSolutionToStr(finalE.solution) || String(finalE.solution ?? '').trim()
        const { error: upErr } = await supabase
          .from('worksheet_questions')
          .update({ content_json: { problem: finalE.problem, solution: solutionStr } })
          .eq('id', row.id)
        if (!upErr) stats.contentUpdates++
        else stats.errors.push(`essay update ${row.id}: ${upErr.message}`)
      }
      const { error: markErr } = await supabase
        .from('worksheet_questions')
        .update({ verified_at: new Date().toISOString() })
        .eq('id', row.id)
      if (!markErr) stats.markedVerified++
      else stats.errors.push(`essay verify mark ${row.id}: ${markErr.message}`)
    }
  }

  if (stats.contentUpdates > 0 || stats.markedVerified > 0) {
    const { data: freshRows } = await supabase
      .from('worksheet_questions')
      .select('id, type, content_json, difficulty, source, verified_at')
      .in('id', questionIds)
    const freshOrdered = questionIds
      .map((id) => freshRows?.find((r) => r.id === id))
      .filter(Boolean) as Array<{
        id: string
        type: string
        content_json: unknown
        difficulty?: string
        source?: string
        verified_at?: string | null
      }>
    if (freshOrdered.length > 0) {
      const newMarkdown = questionsToMarkdown(freshOrdered)
      const { error: mdErr } = await supabase.from('worksheet_worksheets').update({ content_markdown: newMarkdown }).eq('id', worksheetId)
      if (mdErr) stats.errors.push(`markdown: ${mdErr.message}`)
    }
  }

  return stats
}
