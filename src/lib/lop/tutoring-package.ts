/** Gói lớp học thêm. 1 credit = 6.000₫. Hết hạn thì 30 ngày chỉ xem danh sách, rồi lớp giải tán. */

export const TUTORING_TRIAL_DAYS = 7
export const TUTORING_TRIAL_SLOTS = 1
export const TUTORING_DISSOLVE_AFTER_DAYS = 30
/** Hiện lời nhắc trên danh sách lớp khi gói còn không quá bấy nhiêu ngày. */
export const TUTORING_ENDING_SOON_DAYS = 7
export const TUTORING_SLOT_MIN = 1
export const TUTORING_SLOT_MAX = 30
export const TUTORING_PACKAGE_CHARGE_TYPE = 'tutoring_class_package'

const VN_OFFSET_MS = 7 * 60 * 60 * 1000
const DAY_MS = 86_400_000

export const TUTORING_PACKAGE_PLANS = [
  { id: 'month', days: 30, priceVndPerClass: 60_000, creditsPerClass: 10 },
  { id: 'quarter', days: 90, priceVndPerClass: 162_000, creditsPerClass: 27 },
  { id: 'year', days: 365, priceVndPerClass: 576_000, creditsPerClass: 96 },
] as const

export type TutoringPackagePlanId = (typeof TUTORING_PACKAGE_PLANS)[number]['id']
export type TutoringPackagePhase = 'none' | 'active' | 'grace' | 'lapsed'

const PLAN_BY_ID = new Map(TUTORING_PACKAGE_PLANS.map((plan) => [plan.id, plan]))

export function tutoringPackagePlanById(id: string): (typeof TUTORING_PACKAGE_PLANS)[number] | null {
  return PLAN_BY_ID.get(id as TutoringPackagePlanId) ?? null
}

export function parseTutoringSlots(raw: unknown): number | null {
  const slots = typeof raw === 'number' ? raw : Number(String(raw ?? '').trim())
  if (!Number.isInteger(slots) || slots < TUTORING_SLOT_MIN || slots > TUTORING_SLOT_MAX) return null
  return slots
}

export function tutoringPackageQuote(planId: string, slots: number): { priceVnd: number; credits: number; days: number } | null {
  const plan = tutoringPackagePlanById(planId)
  if (!plan || !Number.isInteger(slots) || slots < TUTORING_SLOT_MIN || slots > TUTORING_SLOT_MAX) return null
  return {
    priceVnd: plan.priceVndPerClass * slots,
    credits: plan.creditsPerClass * slots,
    days: plan.days,
  }
}

function vnDayIndex(date: Date): number {
  const shifted = new Date(date.getTime() + VN_OFFSET_MS)
  return Math.floor(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) / DAY_MS)
}

/** 00:00 giờ Việt Nam, đúng 30 ngày lịch sau ngày hết hạn. */
export function tutoringDissolveAt(accessEndsAt: Date): Date {
  const shifted = new Date(accessEndsAt.getTime() + VN_OFFSET_MS)
  const utcMidnight = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate() + TUTORING_DISSOLVE_AFTER_DAYS
  )
  return new Date(utcMidnight - VN_OFFSET_MS)
}

export function tutoringPackagePhase(accessEndsAt: Date | null, now: Date): TutoringPackagePhase {
  if (!accessEndsAt) return 'none'
  if (now.getTime() < accessEndsAt.getTime()) return 'active'
  if (now.getTime() < tutoringDissolveAt(accessEndsAt).getTime()) return 'grace'
  return 'lapsed'
}

/** Số ngày lịch còn lại đến ngày giải tán. Trong ngày hết hạn là 30. */
export function tutoringGraceDaysLeft(accessEndsAt: Date, now: Date): number {
  return Math.max(0, vnDayIndex(tutoringDissolveAt(accessEndsAt)) - vnDayIndex(now))
}

/** Số ngày lịch còn lại đến đúng ngày hết hạn gói. Cùng ngày là 0. */
export function tutoringAccessDaysLeft(accessEndsAt: Date, now: Date): number {
  return Math.max(0, vnDayIndex(accessEndsAt) - vnDayIndex(now))
}

export function nextTutoringAccessEnd(currentEndsAt: Date | null, days: number, now: Date): Date {
  const base = currentEndsAt && currentEndsAt.getTime() > now.getTime() ? currentEndsAt.getTime() : now.getTime()
  return new Date(base + days * DAY_MS)
}

export function tutoringTrialEndsAt(now: Date): Date {
  return new Date(now.getTime() + TUTORING_TRIAL_DAYS * DAY_MS)
}
