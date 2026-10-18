import { spendCreditsIdempotent } from '@/lib/db/credits-balance'
import { rememberStudentPlanPurchase } from '@/lib/tracking/nanoai-platform-purchase-queue'
import { pgQuery } from '@/lib/db/pg-query'
import { isPgConfigured } from '@/lib/db/pool'
import { readFeatureTrialStartedAt } from '@/lib/feature-trial-start'
import {
  STUDENT_STUDY_CHARGE_TYPE,
  isStudentStudyTrialActive,
  nextStudentStudyAccessEnd,
  studentStudyPlanById,
  studentStudyPlanCredits,
  studentStudyPurchaseEventKey,
  studentStudyTrialDaysRemaining,
  studentStudyTrialEndsAt,
  type StudentStudyPlanId,
} from '@/lib/student-study-package'

const MS_PER_DAY = 86_400_000

function parseAccessEnd(metadataJson: string | null, createdAt: string): Date | null {
  if (metadataJson) {
    try {
      const parsed = JSON.parse(metadataJson) as { accessEndsAt?: unknown }
      if (typeof parsed.accessEndsAt === 'string') {
        const t = Date.parse(parsed.accessEndsAt)
        if (!Number.isNaN(t)) return new Date(t)
      }
    } catch {
      /* fall through */
    }
  }
  const created = Date.parse(createdAt)
  if (Number.isNaN(created)) return null
  return new Date(created + 30 * MS_PER_DAY)
}

export async function readPaidStudentStudyAccessEnd(userId: string): Promise<Date | null> {
  if (!isPgConfigured()) return null
  const rows = await pgQuery<{ metadata_json: string | null; created_at: string }>(
    `select metadata_json, created_at::text as created_at
     from public.language_coach_credit_events
     where user_id = $1::uuid and charge_type = $2
     order by created_at desc
     limit 40`,
    [userId, STUDENT_STUDY_CHARGE_TYPE]
  )
  let maxMs: number | null = null
  for (const row of rows) {
    const end = parseAccessEnd(row.metadata_json, row.created_at)
    if (!end) continue
    if (maxMs == null || end.getTime() > maxMs) maxMs = end.getTime()
  }
  return maxMs == null ? null : new Date(maxMs)
}

export async function hasStudentStudyAccess(input: {
  userId: string
  now?: Date
}): Promise<boolean> {
  const now = input.now ?? new Date()
  const startedAt = await readFeatureTrialStartedAt(input.userId, 'student')
  if (!startedAt) return true
  if (isStudentStudyTrialActive(startedAt, now)) return true
  const paidEnd = await readPaidStudentStudyAccessEnd(input.userId)
  return Boolean(paidEnd && paidEnd.getTime() > now.getTime())
}

export async function readStudentStudyStatus(input: {
  userId: string
  now?: Date
}): Promise<{
  accessGranted: boolean
  trialStarted: boolean
  trialActive: boolean
  trialEndsAt: string | null
  trialDaysRemaining: number
  accessEndsAt: string | null
}> {
  const now = input.now ?? new Date()
  const startedAt = await readFeatureTrialStartedAt(input.userId, 'student')
  const trialEnds = studentStudyTrialEndsAt(startedAt)
  const trialActive = isStudentStudyTrialActive(startedAt, now)
  const paidEnd = await readPaidStudentStudyAccessEnd(input.userId)
  const paidActive = Boolean(paidEnd && paidEnd.getTime() > now.getTime())
  const accessEndMs = Math.max(trialActive && trialEnds ? trialEnds.getTime() : 0, paidActive && paidEnd ? paidEnd.getTime() : 0)
  return {
    accessGranted: !startedAt || trialActive || paidActive,
    trialStarted: Boolean(startedAt),
    trialActive,
    trialEndsAt: trialEnds?.toISOString() ?? null,
    trialDaysRemaining: studentStudyTrialDaysRemaining(startedAt, now),
    accessEndsAt: accessEndMs > 0 ? new Date(accessEndMs).toISOString() : null,
  }
}

export async function purchaseStudentStudyPlan(input: {
  userId: string
  planId: StudentStudyPlanId
  now?: Date
}): Promise<
  | {
      ok: true
      alreadyApplied: boolean
      accessEndsAt: string
      newBalance: number
      credits: number
      priceVnd: number
    }
  | { ok: false; error: string; credits: number; priceVnd: number }
> {
  const plan = studentStudyPlanById(input.planId)
  if (!plan) return { ok: false, error: 'unknown_plan', credits: 0, priceVnd: 0 }
  const credits = studentStudyPlanCredits(plan.priceVnd)
  const now = input.now ?? new Date()
  const paidEndsAt = await readPaidStudentStudyAccessEnd(input.userId)
  const startedAt = await readFeatureTrialStartedAt(input.userId, 'student')
  const accessEndsAt = nextStudentStudyAccessEnd({
    paidEndsAt,
    trialEndsAt: studentStudyTrialEndsAt(startedAt),
    days: plan.days,
    now,
  })
  const eventKey = studentStudyPurchaseEventKey(input.userId, plan.id, accessEndsAt)
  const charged = await spendCreditsIdempotent({
    userId: input.userId,
    amount: credits,
    eventKey,
    chargeType: STUDENT_STUDY_CHARGE_TYPE,
    sessionId: null,
    metadataJson: JSON.stringify({
      kind: 'student_study_plan',
      plan: plan.id,
      days: plan.days,
      priceVnd: plan.priceVnd,
      credits,
      accessEndsAt: accessEndsAt.toISOString(),
    }),
  })
  if (!charged.ok) {
    return { ok: false, error: charged.error || 'charge_failed', credits, priceVnd: plan.priceVnd }
  }
  if (!charged.alreadyApplied) {
    rememberStudentPlanPurchase({ orderId: eventKey, priceVnd: plan.priceVnd })
  }
  return {
    ok: true,
    alreadyApplied: charged.alreadyApplied,
    accessEndsAt: accessEndsAt.toISOString(),
    newBalance: charged.newBalance,
    credits,
    priceVnd: plan.priceVnd,
  }
}
