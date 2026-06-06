import { createHash } from 'crypto'
import { CURRICULUM_UI_CREDITS } from '@/app/tao-giao-trinh/lib/curriculum-credit-costs'
import {
  isCurriculumAiCreditsDisabled,
  readUserCreditBalance,
  spendCurriculumAiCredits,
} from '@/lib/curriculum-ai-credits'
import { getVietnamDateYmd } from '@/lib/curriculum-vietnam-date'
import {
  countDailyWaivedCurriculumBodies,
  hasCurriculumAiFirstUse,
  recordCurriculumAiFirstUse,
  type CurriculumAiArtifactKind,
} from '@/lib/db/curriculum-ai-first-use-pg'

/** Số bài mới (curriculum_body) miễn phí AI mỗi ngày — từ bài thứ 4 trừ credit. */
export const CURRICULUM_DAILY_FREE_BODIES = 3

export type CurriculumAiChargeReason =
  | 'disabled'
  | 'waived_first_use'
  | 'waived_daily_quota'
  | 'charged_regenerate'
  | 'charged_daily_quota_exceeded'
  | 'insufficient_credits'
  | 'charge_failed'

export type CurriculumDailyBodyQuota = {
  usedToday: number
  limit: number
  remaining: number
  usageDate: string
}

export function getCurriculumDailyBodyQuota(usedToday: number): CurriculumDailyBodyQuota {
  const limit = CURRICULUM_DAILY_FREE_BODIES
  return {
    usedToday,
    limit,
    remaining: Math.max(0, limit - usedToday),
    usageDate: getVietnamDateYmd(),
  }
}

export async function readCurriculumDailyBodyQuota(userId: string): Promise<CurriculumDailyBodyQuota> {
  const usedToday = await countDailyWaivedCurriculumBodies(userId)
  return getCurriculumDailyBodyQuota(usedToday)
}

export function buildCurriculumBodyFingerprintKey(input: {
  subjectId: string
  gradeLevelId: string
  textbookSetId: string
  lessonNumber: string | number
  textbookVolume?: string | null
  bookIsbn?: string | null
}): string {
  const raw = [
    input.subjectId,
    input.gradeLevelId,
    input.textbookSetId,
    String(input.lessonNumber),
    String(input.textbookVolume ?? '').trim(),
    String(input.bookIsbn ?? '').trim().toLowerCase(),
  ].join('|')
  const hash = createHash('sha256').update(raw, 'utf8').digest('hex').slice(0, 24)
  return `body:fp:${hash}`
}

export function buildCurriculumBodyArtifactKey(curriculumIdOrFingerprint: string): string {
  const id = String(curriculumIdOrFingerprint || '').trim()
  return id.startsWith('body:') ? id : `body:${id}`
}

export function buildLessonSlidesArtifactKey(
  curriculumId: string,
  mode: string,
  lessonNo: number
): string {
  return `slides:${curriculumId}:${mode}:${lessonNo}`
}

export function buildInfographicArtifactKey(
  curriculumId: string,
  scope: 'curriculum' | 'lesson',
  lessonNo?: number
): string {
  if (scope === 'lesson' && lessonNo != null) {
    return `infographic:${curriculumId}:lesson:${lessonNo}`
  }
  return `infographic:${curriculumId}:curriculum`
}

type ResolveInput = {
  userId: string
  kind: CurriculumAiArtifactKind
  artifactKey: string
  listPrice: number
  isRegenerate: boolean
}

type ResolveResult =
  | { action: 'skip'; reason: 'disabled' }
  | { action: 'waive'; reason: 'first_use' | 'daily_quota' }
  | { action: 'charge'; amount: number; reason: 'regenerate' | 'daily_quota_exceeded' }

export async function resolveCurriculumAiCharge(input: ResolveInput): Promise<ResolveResult> {
  if (isCurriculumAiCreditsDisabled()) {
    return { action: 'skip', reason: 'disabled' }
  }

  const hadFirst = await hasCurriculumAiFirstUse(input.userId, input.artifactKey)
  if (input.isRegenerate || hadFirst) {
    return {
      action: 'charge',
      amount: input.listPrice,
      reason: 'regenerate',
    }
  }

  if (input.kind === 'curriculum_body') {
    const usedToday = await countDailyWaivedCurriculumBodies(input.userId)
    if (usedToday >= CURRICULUM_DAILY_FREE_BODIES) {
      return {
        action: 'charge',
        amount: input.listPrice,
        reason: 'daily_quota_exceeded',
      }
    }
    return { action: 'waive', reason: 'daily_quota' }
  }

  return { action: 'waive', reason: 'first_use' }
}

export type ApplyCurriculumAiChargeInput = {
  userId: string
  kind: CurriculumAiArtifactKind
  artifactKey: string
  listPrice: number
  chargeType: string
  isRegenerate: boolean
  eventKey: string
  metadata?: Record<string, unknown>
}

export type ApplyCurriculumAiChargeResult =
  | {
      ok: true
      creditsCharged: boolean
      amount: number
      chargeReason: CurriculumAiChargeReason
      newBalance?: number
      dailyQuota: CurriculumDailyBodyQuota
    }
  | {
      ok: false
      code: 'INSUFFICIENT_CREDITS' | 'CHARGE_FAILED'
      error: string
      balance?: number
      required?: number
      dailyQuota: CurriculumDailyBodyQuota
    }

export async function applyCurriculumAiCharge(
  input: ApplyCurriculumAiChargeInput
): Promise<ApplyCurriculumAiChargeResult> {
  const dailyQuota = await readCurriculumDailyBodyQuota(input.userId)
  const decision = await resolveCurriculumAiCharge(input)

  if (decision.action === 'skip') {
    return {
      ok: true,
      creditsCharged: false,
      amount: 0,
      chargeReason: 'disabled',
      dailyQuota,
    }
  }

  if (decision.action === 'waive') {
    await recordCurriculumAiFirstUse({
      userId: input.userId,
      artifactKey: input.artifactKey,
      artifactKind: input.kind,
      waived: true,
      metadata: input.metadata,
    })
    const refreshed = await readCurriculumDailyBodyQuota(input.userId)
    return {
      ok: true,
      creditsCharged: false,
      amount: 0,
      chargeReason: decision.reason === 'daily_quota' ? 'waived_daily_quota' : 'waived_first_use',
      dailyQuota: refreshed,
    }
  }

  const balance = await readUserCreditBalance(input.userId)
  if (balance < decision.amount) {
    return {
      ok: false,
      code: 'INSUFFICIENT_CREDITS',
      error: 'insufficient_credits',
      balance,
      required: decision.amount,
      dailyQuota,
    }
  }

  const spend = await spendCurriculumAiCredits({
    userId: input.userId,
    amount: decision.amount,
    chargeType: input.chargeType,
    eventKey: input.eventKey,
    metadata: {
      ...(input.metadata ?? {}),
      chargeReason: decision.reason,
    },
  })

  if (!spend.ok) {
    return {
      ok: false,
      code: 'CHARGE_FAILED',
      error: spend.error || 'charge_failed',
      dailyQuota,
    }
  }

  const hadFirst = await hasCurriculumAiFirstUse(input.userId, input.artifactKey)
  if (!hadFirst) {
    await recordCurriculumAiFirstUse({
      userId: input.userId,
      artifactKey: input.artifactKey,
      artifactKind: input.kind,
      waived: false,
      creditsCharged: decision.amount,
      metadata: input.metadata,
    })
  }

  const refreshed = await readCurriculumDailyBodyQuota(input.userId)
  return {
    ok: true,
    creditsCharged: true,
    amount: decision.amount,
    chargeReason:
      decision.reason === 'daily_quota_exceeded' ? 'charged_daily_quota_exceeded' : 'charged_regenerate',
    newBalance: spend.newBalance,
    dailyQuota: refreshed,
  }
}

/** Số credit tối đa có thể cần cho precheck (khi chưa biết waive hay charge). */
export async function estimateCurriculumAiPrecheckAmount(input: ResolveInput): Promise<number> {
  const decision = await resolveCurriculumAiCharge(input)
  if (decision.action === 'charge') return decision.amount
  return 0
}

export const CURRICULUM_CHARGE_LIST_PRICES = {
  fromImage: CURRICULUM_UI_CREDITS.createOrFromImage,
  lessonSlideGenerate: CURRICULUM_UI_CREDITS.lessonSlideGenerate,
  slideInfographic2K: CURRICULUM_UI_CREDITS.slideInfographic2K,
} as const
