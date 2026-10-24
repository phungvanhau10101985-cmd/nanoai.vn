/**
 * Hạn mức tạo phiếu bằng AI, tính theo giáo trình.
 * - 5 trắc nghiệm và 5 tự luận đầu của giáo trình miễn phí, dùng chung mọi giáo viên.
 * - Câu thêm: 0,5 credit, trừ người bấm.
 * - Tách ảnh SGK: một lần miễn phí trên giáo trình. Tách lại: 1 credit.
 * Đếm số lần tạo thành công, kể cả câu đã xóa. Không tách theo độ khó hay theo giáo viên.
 */

export const WORKSHEET_FREE_PER_SCOPE = 5
export const WORKSHEET_EXTRA_QUESTION_CREDIT = 0.5
export const SGK_EXTRACT_REPEAT_CREDIT = 1

export type QuestionBatchQuote = {
  free: number
  paid: number
  credits: number
}

export type SgkExtractQuote = {
  waived: boolean
  credits: number
}

function room(limit: number, used: number): number {
  const n = Number(used)
  const safe = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
  return Math.max(0, limit - safe)
}

export function quoteWorksheetQuestionBatch(input: {
  requested: number
  curriculumCreated: number
  hasCurriculum: boolean
}): QuestionBatchQuote {
  const requestedRaw = Number(input.requested)
  const requested = Number.isFinite(requestedRaw) ? Math.max(0, Math.floor(requestedRaw)) : 0
  if (!input.hasCurriculum) {
    return { free: 0, paid: requested, credits: requested * WORKSHEET_EXTRA_QUESTION_CREDIT }
  }
  const free = Math.min(requested, room(WORKSHEET_FREE_PER_SCOPE, input.curriculumCreated))
  const paid = requested - free
  return {
    free,
    paid,
    credits: paid * WORKSHEET_EXTRA_QUESTION_CREDIT,
  }
}

export function quoteSgkExtract(input: {
  curriculumExtracts: number
  hasCurriculum: boolean
}): SgkExtractQuote {
  if (input.hasCurriculum && room(1, input.curriculumExtracts) > 0) {
    return { waived: true, credits: 0 }
  }
  return { waived: false, credits: SGK_EXTRACT_REPEAT_CREDIT }
}
