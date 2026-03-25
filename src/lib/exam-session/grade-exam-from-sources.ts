import type { ExamLayoutSnapshotV1 } from '@/lib/exam-session/student-exam-layout'
import type { ExamGradingMeta } from '@/lib/exam-feedback'
import {
  EXAM_ESSAY_IMAGE_RETENTION_DAYS,
  publicExamEssayImageUrlPrefix,
} from '@/lib/exam-essay-config'

const MAX_ESSAY_TEXT = 12000
const MAX_IMAGES_PER_ESSAY = 10

export type ExamQuestionGradeRow = {
  id: string
  correct_index?: unknown
  options?: unknown
  points?: unknown
}

function normalizeEssaySubmission(
  raw: unknown,
  essayQuestionIds: Set<string>,
  urlPrefix: string
): Record<string, { text: string; imageUrls: string[] }> {
  const out: Record<string, { text: string; imageUrls: string[] }> = {}
  if (!raw || typeof raw !== 'object') return out
  const o = raw as Record<string, unknown>
  for (const qid of essayQuestionIds) {
    const v = o[qid]
    if (!v || typeof v !== 'object') continue
    const rec = v as Record<string, unknown>
    const text = String(rec.text ?? '').trim().slice(0, MAX_ESSAY_TEXT)
    const urlsRaw = rec.imageUrls
    const imageUrls: string[] = []
    if (Array.isArray(urlsRaw)) {
      for (const u of urlsRaw) {
        const s = String(u ?? '').trim()
        if (!s.startsWith(urlPrefix)) continue
        if (imageUrls.length >= MAX_IMAGES_PER_ESSAY) break
        if (!imageUrls.includes(s)) imageUrls.push(s)
      }
    }
    out[qid] = { text, imageUrls }
  }
  return out
}

function essaySubmissionHasImageUrls(
  sub: Record<string, { text: string; imageUrls: string[] }>
): boolean {
  for (const v of Object.values(sub)) {
    if (v.imageUrls.length > 0) return true
  }
  return false
}

const readQuestionPoints = (row: { points?: unknown }): number => {
  const raw = row.points
  const p = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(p) || p < 0) return 1
  return Math.min(100, Math.round(p * 100) / 100)
}

export type GradeExamFromDbResult = {
  essaySubmission: Record<string, { text: string; imageUrls: string[] }>
  finalScore: number
  maxScore: number
  gradingMeta: ExamGradingMeta
  correctCount: number
}

/**
 * Chấm TN + gom TL từ đáp án đã lưu (giống luồng POST submit).
 * `layout` lấy từ snapshot đã lưu — không cần JWT.
 */
export function gradeExamFromStoredAnswers(
  questions: ExamQuestionGradeRow[],
  layout: ExamLayoutSnapshotV1,
  answers: Record<string, unknown>,
  essaySubmissionStored: unknown
): GradeExamFromDbResult | { error: string } {
  const qMap = new Map(questions.map((q) => [String(q.id), q]))
  let correctCount = 0
  const scorableQuestionIds = new Set(
    questions
      .filter((q) => {
        const opts = Array.isArray(q.options) ? q.options : []
        if (opts.length < 2) return false
        const ci = typeof q.correct_index === 'number' ? q.correct_index : Number(q.correct_index)
        return Number.isFinite(ci)
      })
      .map((q) => String(q.id))
  )
  const essayQuestionIds = new Set(
    questions.filter((q) => !scorableQuestionIds.has(String(q.id))).map((q) => String(q.id))
  )

  const urlPrefix = publicExamEssayImageUrlPrefix()
  const essaySubmission = normalizeEssaySubmission(
    essaySubmissionStored,
    essayQuestionIds,
    urlPrefix
  )
  for (const qid of essayQuestionIds) {
    const textFromAnswer =
      typeof answers[qid] === 'string' ? String(answers[qid] ?? '').trim().slice(0, MAX_ESSAY_TEXT) : ''
    if (!essaySubmission[qid]) essaySubmission[qid] = { text: '', imageUrls: [] }
    if (!essaySubmission[qid].text && textFromAnswer) essaySubmission[qid].text = textFromAnswer
  }

  const optionPerms = layout.optionPerms
  for (const qid of Array.from(scorableQuestionIds)) {
    const row = qMap.get(qid)
    const opts = row && Array.isArray(row.options) ? row.options : []
    const perm = optionPerms[qid]
    if (!perm || !Array.isArray(perm) || perm.length !== opts.length) {
      return { error: 'layout_snapshot không khớp câu hỏi.' }
    }
  }

  let quizPointsMax = 0
  let essayPointsMax = 0
  for (const rawQ of questions) {
    const qid = String(rawQ.id)
    const w = readQuestionPoints(rawQ as { points?: unknown })
    if (scorableQuestionIds.has(qid)) quizPointsMax += w
    else essayPointsMax += w
  }
  quizPointsMax = Math.round(quizPointsMax * 100) / 100
  essayPointsMax = Math.round(essayPointsMax * 100) / 100

  let quizPointsEarned = 0
  for (const qid of scorableQuestionIds) {
    const q = qMap.get(qid)
    if (!q) continue
    const userAnswer = answers[qid]
    const dbOpts = Array.isArray(q.options) ? q.options : []
    const nOpt = dbOpts.length
    const ciRaw = typeof q.correct_index === 'number' ? q.correct_index : Number(q.correct_index ?? 0)
    const safeCorrect =
      nOpt >= 2 && Number.isFinite(ciRaw)
        ? Math.max(0, Math.min(nOpt - 1, Math.floor(ciRaw)))
        : 0
    const displayIdx = typeof userAnswer === 'number' ? userAnswer : parseInt(String(userAnswer), 10)
    if (!Number.isFinite(displayIdx)) continue
    const perm = optionPerms[qid]
    let userOriginal = displayIdx
    if (perm && Array.isArray(perm) && perm.length === dbOpts.length && dbOpts.length >= 2) {
      if (displayIdx < 0 || displayIdx >= perm.length) continue
      userOriginal = perm[displayIdx]!
    }
    if (userOriginal === safeCorrect) {
      correctCount++
      quizPointsEarned += readQuestionPoints(q as { points?: unknown })
    }
  }

  const maxScore = Math.round((quizPointsMax + essayPointsMax) * 100) / 100
  const roundedEarned = Math.round(quizPointsEarned * 100) / 100
  const finalScore = Math.min(maxScore, roundedEarned)
  const gradingMeta: ExamGradingMeta = {
    quizCorrect: correctCount,
    quizTotal: scorableQuestionIds.size,
    quizPoints: roundedEarned,
    quizPointsMax,
    essayPointsMax,
    ...(essaySubmissionHasImageUrls(essaySubmission)
      ? {
          essayImageUrlsExpireAt: new Date(
            Date.now() + EXAM_ESSAY_IMAGE_RETENTION_DAYS * 86400000
          ).toISOString(),
        }
      : {}),
  }

  return { essaySubmission, finalScore, maxScore, gradingMeta, correctCount }
}
