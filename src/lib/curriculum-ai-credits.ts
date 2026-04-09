/**
 * Trừ credit cho tính năng giáo trình/phiếu khi **thật sự gọi AI**.
 * Quy tắc: đọc DB / cache trước — chỉ gọi spend khi pipeline AI chạy (không áp cho fromCache).
 *
 * @see CURRICULUM_CREDIT_RULES trong `@/app/tao-giao-trinh/lib/curriculum-credit-costs`
 */
import { createHash } from 'crypto'
import { CURRICULUM_UI_CREDITS } from '@/app/tao-giao-trinh/lib/curriculum-credit-costs'
import { getCreditBalanceByUserId, spendCreditsIdempotent } from '@/lib/db/credits-balance'

export const CURRICULUM_AI_CHARGE_TYPES = {
  /** POST /api/curriculum-from-image — tạo giáo trình từ ảnh (+ slide trong cùng pipeline) */
  fromImage: 'curriculum_from_image',
  /** Server action verify đề xuất sửa/bổ sung slide (nút Kiểm tra AI). */
  slideProposalVerify: 'curriculum_slide_proposal_verify',
  /** Server action tạo slide cho một tiết khi mở tiết. */
  lessonSlideGenerate: 'curriculum_lesson_slide_generate',
} as const

/** Tắt trừ credit (local / debug): CURRICULUM_AI_CREDITS_DISABLED=1 */
export function isCurriculumAiCreditsDisabled(): boolean {
  const v = process.env.CURRICULUM_AI_CREDITS_DISABLED
  return v === '1' || v === 'true'
}

export async function readUserCreditBalance(userId: string): Promise<number> {
  return getCreditBalanceByUserId(userId)
}

export type SpendCurriculumAiResult = {
  ok: boolean
  alreadyApplied: boolean
  newBalance: number
  error: string
}

/**
 * Mỗi lần gọi AI thực sự dùng event_key **unique** (UUID) — không idempotent theo curriculum
 * để lần tạo slide sau (sau khi xóa DB) vẫn trừ đúng.
 */
export async function spendCurriculumAiCredits(input: {
  userId: string
  amount: number
  chargeType: string
  eventKey: string
  metadata?: Record<string, unknown>
}): Promise<SpendCurriculumAiResult> {
  const r = await spendCreditsIdempotent({
    userId: input.userId,
    amount: input.amount,
    eventKey: input.eventKey,
    chargeType: input.chargeType,
    sessionId: null,
    metadataJson: JSON.stringify(input.metadata ?? {}),
  })
  return {
    ok: r.ok,
    alreadyApplied: r.alreadyApplied,
    newBalance: r.newBalance,
    error: r.error,
  }
}

export const FROM_IMAGE_CREDIT_COST = CURRICULUM_UI_CREDITS.createOrFromImage
export const LESSON_SLIDE_GENERATE_CREDIT_COST = CURRICULUM_UI_CREDITS.lessonSlideGenerate

/** Hash nội dung giáo trình — dùng metadata thống nhất cho from-image charge event. */
export function curriculumMarkdownCreditHash(markdown: string): string {
  return createHash('sha256').update(markdown.trim(), 'utf8').digest('hex')
}
