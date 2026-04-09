/**
 * Chạy verify các câu trên một phiếu bài tập (dùng chung API ngầm + admin batch).
 * Mặc định chỉ câu chưa có verified_at; `reverifyAll` thì chạy lại cả câu đã verify.
 */
import {
  fetchCurriculumContentMarkdownForVerifyPg,
  fetchWorksheetQuestionsByIdsForVerifyPg,
  fetchWorksheetSheetForVerifyPg,
  updateWorksheetQuestionContentJsonPg,
  updateWorksheetQuestionVerifiedAtNowPg,
  updateWorksheetSheetContentMarkdownPg,
} from '@/lib/db/worksheet-verify-run-pg'
import { isPgConfigured } from '@/lib/db/pool'
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
 * Verify một phiếu — chỉ Postgres (DATABASE_URL).
 */
export async function runWorksheetVerifyForSheet(
  worksheetId: string,
  options?: { curriculumMarkdownOverride?: string; reverifyAll?: boolean }
): Promise<RunWorksheetVerifyStats> {
  const stats: RunWorksheetVerifyStats = {
    contentUpdates: 0,
    markedVerified: 0,
    skippedInvalid: 0,
    errors: [],
  }

  if (!isPgConfigured()) {
    stats.errors.push('DATABASE_URL chưa cấu hình')
    return stats
  }

  if (!process.env.GOOGLE_API_KEY?.trim()) {
    stats.errors.push('GOOGLE_API_KEY chưa cấu hình')
    return stats
  }

  const ws = await fetchWorksheetSheetForVerifyPg(worksheetId)
  if (!ws) {
    stats.errors.push('Không tìm thấy phiếu bài tập')
    return stats
  }

  const questionIds = (ws.question_ids ?? []).filter(Boolean)
  if (questionIds.length === 0) return stats

  let curriculumMarkdown = (options?.curriculumMarkdownOverride ?? '').trim()
  if (!curriculumMarkdown && ws.curriculum_id) {
    curriculumMarkdown = (await fetchCurriculumContentMarkdownForVerifyPg(ws.curriculum_id)) ?? ''
  }
  const topic = ws.topic || 'Phiếu bài tập'
  const fullContent = topic ? `## ${topic}\n\n${curriculumMarkdown}` : curriculumMarkdown
  const sheetUserId = ws.user_id || null

  const qRowsRaw = await fetchWorksheetQuestionsByIdsForVerifyPg(questionIds)
  if (qRowsRaw === null) {
    stats.errors.push('Không đọc được câu hỏi từ DB')
    return stats
  }

  const ordered = questionIds.map((id) => qRowsRaw.find((r) => r.id === id)).filter(Boolean) as Array<{
    id: string
    type: string
    content_json: unknown
    source?: string
    verified_at?: string | null
  }>

  const reverifyAll = options?.reverifyAll === true

  const sgkImageUrls = (Array.isArray(ws.sgk_image_urls) ? ws.sgk_image_urls : []).filter(
    (x): x is string => typeof x === 'string' && x.length > 0
  )
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

  const nowIso = () => new Date().toISOString()

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
      let skipTextVerifyPipeline = false
      if (row.source === 'sgk' && sgkImageUrls.length > 0) {
        const imageParts = await getSgkImageParts()
        if (imageParts.length > 0) {
          const visionFirst = await verifyQuizWithGeminiVision(fullContent, q, imageParts, sheetUserId)
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

      if (!skipTextVerifyPipeline) {
        const deepSeekResult = await verifyQuizWithDeepSeek(fullContent, q, sheetUserId)
        if (deepSeekResult && !deepSeekResult.verified) {
          let geminiResult: { verified: boolean; correctIndex?: number; question?: string; options?: string[] } | null = null
          if (deepSeekResult.needsImage && sgkImageUrls.length > 0 && row.source === 'sgk') {
            const imageParts = await getSgkImageParts()
            if (imageParts.length > 0) geminiResult = await verifyQuizWithGeminiVision(fullContent, q, imageParts, sheetUserId)
          }
          if (!geminiResult) geminiResult = await verifyQuizWithGemini(fullContent, q, sheetUserId)
          const verifyResult = geminiResult ?? deepSeekResult
          if (verifyResult.question || verifyResult.options || typeof verifyResult.correctIndex === 'number') {
            if (verifyResult.question) finalQ = { ...finalQ, question: verifyResult.question }
            if (verifyResult.options) finalQ = { ...finalQ, options: verifyResult.options }
            if (typeof verifyResult.correctIndex === 'number' && verifyResult.correctIndex >= 0 && verifyResult.correctIndex <= 3) {
              finalQ = { ...finalQ, correctIndex: verifyResult.correctIndex }
            }
            needsUpdate = true
          } else {
            const fixed = await fixQuizWhenVerifyFailed(fullContent, q, sheetUserId)
            if (fixed) {
              finalQ = fixed
              needsUpdate = true
            }
          }
        }
      }
      if (needsUpdate) {
        const ok = await updateWorksheetQuestionContentJsonPg(row.id, {
          question: finalQ.question,
          options: finalQ.options,
          correctIndex: finalQ.correctIndex,
        })
        if (ok) stats.contentUpdates++
        else stats.errors.push(`quiz update ${row.id}`)
      }
      const okMark = await updateWorksheetQuestionVerifiedAtNowPg(row.id, nowIso())
      if (okMark) stats.markedVerified++
      else stats.errors.push(`quiz verify mark ${row.id}`)
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
      let skipTextVerifyPipeline = false
      if (row.source === 'sgk' && sgkImageUrls.length > 0) {
        const imageParts = await getSgkImageParts()
        if (imageParts.length > 0) {
          const visionFirst = await verifyEssayWithGeminiVision(fullContent, problem, solution, imageParts, sheetUserId)
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
        const deepSeekResult = await verifyEssayWithDeepSeek(fullContent, problem, solution, sheetUserId)
        if (deepSeekResult && !deepSeekResult.verified) {
          let geminiResult: { verified: boolean; problem?: string; solution?: string } | null = null
          if (deepSeekResult.needsImage && sgkImageUrls.length > 0 && row.source === 'sgk') {
            const imageParts = await getSgkImageParts()
            if (imageParts.length > 0) geminiResult = await verifyEssayWithGeminiVision(fullContent, problem, solution, imageParts, sheetUserId)
          }
          if (!geminiResult) geminiResult = await verifyEssayWithGemini(fullContent, problem, solution, sheetUserId)
          const verifyResult = geminiResult ?? deepSeekResult
          if (verifyResult.problem || verifyResult.solution) {
            if (verifyResult.problem) finalE = { ...finalE, problem: verifyResult.problem }
            if (verifyResult.solution) finalE = { ...finalE, solution: verifyResult.solution }
            needsUpdate = true
          } else {
            const fixed = await fixEssayWhenVerifyFailed(fullContent, { problem, solution }, sheetUserId)
            if (fixed) {
              finalE = fixed
              needsUpdate = true
            }
          }
        }
      }
      if (needsUpdate) {
        const solutionStr = normalizeSolutionToStr(finalE.solution) || String(finalE.solution ?? '').trim()
        const ok = await updateWorksheetQuestionContentJsonPg(row.id, { problem: finalE.problem, solution: solutionStr })
        if (ok) stats.contentUpdates++
        else stats.errors.push(`essay update ${row.id}`)
      }
      const okMark = await updateWorksheetQuestionVerifiedAtNowPg(row.id, nowIso())
      if (okMark) stats.markedVerified++
      else stats.errors.push(`essay verify mark ${row.id}`)
    }
  }

  if (stats.contentUpdates > 0 || stats.markedVerified > 0) {
    const freshRows = await fetchWorksheetQuestionsByIdsForVerifyPg(questionIds)
    if (freshRows && freshRows.length > 0) {
      const freshOrdered = questionIds
        .map((id) => freshRows.find((r) => r.id === id))
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
        const mdOk = await updateWorksheetSheetContentMarkdownPg(worksheetId, newMarkdown)
        if (!mdOk) stats.errors.push('markdown: không cập nhật được content_markdown phiếu')
      }
    }
  }

  return stats
}
