import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import { pgHasLanguageCoachEventKey } from '@/lib/db/language-coach-credits-read'
import {
  MONTHLY_SERVICE_CREDITS,
  MONTHLY_SERVICE_CHARGE_TYPES,
  getVietnamYearMonth,
  monthlyServiceEventKey,
  estimatedVndForMonthlyCredits,
  isValidYearMonth,
  type MonthlyServiceProduct,
} from '@/lib/monthly-service-credits'
import { readFeatureTrialStartedAt } from '@/lib/feature-trial-start'
import { purchaseStudentStudyPlan, readStudentStudyStatus } from '@/lib/student-study-access'
import { STUDENT_STUDY_PLANS, studentStudyPlanById, studentStudyPlanCredits } from '@/lib/student-study-package'
import { CREDIT_UNIT_PRICE_VND } from '@/lib/credit-unit-price'
import { rememberCurriculumPurchase } from '@/lib/tracking/nanoai-platform-purchase-queue'
import { getCreditBalanceByUserId, spendCreditsIdempotent } from '@/lib/db/credits-balance'
import {
  SERVICE_FREE_TRIAL_DAYS,
  SIGNUP_BONUS_CREDITS,
  getServiceTrialEndsAt,
  getServiceFreeTrialDaysRemaining,
  isServiceFreeTrialActive,
} from '@/lib/service-free-trial'

/** Trạng thái theo phiên đăng nhập — không cache tĩnh. */
export const dynamic = 'force-dynamic'

async function readCreditBalance(userId: string): Promise<number> {
  return getCreditBalanceByUserId(userId)
}

async function hasChargedPeriod(userId: string, eventKey: string): Promise<boolean> {
  return pgHasLanguageCoachEventKey(userId, eventKey)
}

async function chargeMonthlyIdempotent(input: {
  userId: string
  yearMonth: string
  product: MonthlyServiceProduct
}) {
  const amount = MONTHLY_SERVICE_CREDITS[input.product]
  const eventKey = monthlyServiceEventKey(input.product, input.yearMonth, input.userId)
  const r = await spendCreditsIdempotent({
    userId: input.userId,
    amount,
    eventKey,
    chargeType: MONTHLY_SERVICE_CHARGE_TYPES[input.product],
    sessionId: null,
    metadataJson: JSON.stringify({
      kind: 'monthly_service_access',
      product: input.product,
      period: input.yearMonth,
      credits: amount,
    }),
  })
  return {
    ok: r.ok,
    alreadyApplied: r.alreadyApplied,
    newBalance: r.newBalance,
    error: r.error,
    eventKey,
    amount,
  }
}

function productPayload(userId: string, yearMonth: string, product: MonthlyServiceProduct) {
  const creditsRequired = MONTHLY_SERVICE_CREDITS[product]
  const eventKey = monthlyServiceEventKey(product, yearMonth, userId)
  return hasChargedPeriod(userId, eventKey).then((chargedThisPeriod) => ({
    creditsRequired,
    estimatedVnd: estimatedVndForMonthlyCredits(creditsRequired),
    chargedThisPeriod,
    eventKey,
  }))
}

/**
 * POST `product`: rỗng hoặc `curriculum` → gói giáo viên.
 * `student` kèm `plan` (`month` | `quarter` | `year`) → gói học sinh.
 * `english_coach` đã bỏ — học ngoại ngữ trả theo buổi.
 */
function parseMonthlyPostProduct(raw: string): 'curriculum' | 'student' | 'legacy_english' | 'invalid' {
  const v = String(raw || '').trim()
  if (v === '' || v === 'curriculum') return 'curriculum'
  if (v === 'student') return 'student'
  if (v === 'english_coach' || v === 'englishCoach') return 'legacy_english'
  return 'invalid'
}

/**
 * GET: phí tháng giáo trình và trạng thái gói học sinh (chữa bài + gia sư).
 * POST: trừ phí tháng giáo trình, hoặc mua gói học sinh theo `plan`.
 */
export async function GET() {
  try {
    const auth = await getUserForAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const yearMonth = getVietnamYearMonth()
    if (!isValidYearMonth(yearMonth)) {
      return NextResponse.json({ error: 'Không xác định được kỳ tháng.' }, { status: 500 })
    }

    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Cấu hình máy chủ thiếu DATABASE_URL.' }, { status: 503 })
    }
    const curriculum = await productPayload(auth.user.id, yearMonth, 'curriculum')

    const trialStartedAt = await readFeatureTrialStartedAt(auth.user.id, 'curriculum')
    const freeTrialActive = isServiceFreeTrialActive(trialStartedAt)
    const trialEndsAt = getServiceTrialEndsAt(trialStartedAt)
    const curriculumOut = {
      ...curriculum,
      accessGranted: curriculum.chargedThisPeriod || freeTrialActive || !trialStartedAt,
    }
    const studentStatus = await readStudentStudyStatus({
      userId: auth.user.id,
    })

    return NextResponse.json({
      ok: true,
      period: yearMonth,
      creditUnitVnd: CREDIT_UNIT_PRICE_VND,
      signupBonusCredits: SIGNUP_BONUS_CREDITS,
      freeTrialDays: SERVICE_FREE_TRIAL_DAYS,
      freeTrial: {
        started: Boolean(trialStartedAt),
        startedAt: trialStartedAt,
        active: freeTrialActive,
        endsAt: trialEndsAt?.toISOString() ?? null,
        daysRemaining: getServiceFreeTrialDaysRemaining(trialStartedAt),
      },
      products: {
        curriculum: curriculumOut,
        student: {
          ...studentStatus,
          plans: STUDENT_STUDY_PLANS.map((plan) => ({
            id: plan.id,
            days: plan.days,
            priceVnd: plan.priceVnd,
            credits: studentStudyPlanCredits(plan.priceVnd),
          })),
        },
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { product?: string; plan?: string }
    const resolved = parseMonthlyPostProduct(String(body.product ?? ''))
    if (resolved === 'legacy_english') {
      return NextResponse.json(
        {
          error:
            'Học tiếng Anh AI không còn phí tháng; credit chỉ trừ theo từng buổi/bài (API english-coach/credits).',
          code: 'ENGLISH_NO_MONTHLY_PRODUCT',
        },
        { status: 400 }
      )
    }
    if (resolved === 'invalid') {
      return NextResponse.json(
        { error: 'Thiếu hoặc sai product (curriculum hoặc student).' },
        { status: 400 }
      )
    }

    const auth = await getUserForAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

    const yearMonth = getVietnamYearMonth()
    if (!isValidYearMonth(yearMonth)) {
      return NextResponse.json({ error: 'Không xác định được kỳ tháng.' }, { status: 500 })
    }

    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Cấu hình máy chủ thiếu DATABASE_URL.' }, { status: 503 })
    }

    if (resolved === 'student') {
      const plan = studentStudyPlanById(String(body.plan ?? ''))
      if (!plan) {
        return NextResponse.json({ error: 'Thiếu hoặc sai plan (month, quarter, year).' }, { status: 400 })
      }
      const bought = await purchaseStudentStudyPlan({
        userId: auth.user.id,
        planId: plan.id,
      })
      if (!bought.ok) {
        if (bought.error === 'insufficient_credits') {
          return NextResponse.json(
            {
              error: `Không đủ credits. Cần ${bought.credits} credit (${bought.priceVnd}₫).`,
              requiredCredits: bought.credits,
              priceVnd: bought.priceVnd,
              code: 'INSUFFICIENT_CREDITS',
            },
            { status: 402 }
          )
        }
        return NextResponse.json({ error: bought.error || 'Không thể trừ credits.' }, { status: 500 })
      }
      return NextResponse.json({
        ok: true,
        charged: !bought.alreadyApplied,
        alreadyCharged: bought.alreadyApplied,
        newBalance: bought.newBalance,
        product: 'student',
        plan: plan.id,
        credits: bought.credits,
        priceVnd: bought.priceVnd,
        accessEndsAt: bought.accessEndsAt,
      })
    }

    const trialStartedAt = await readFeatureTrialStartedAt(auth.user.id, 'curriculum')
    const freeTrialActive = isServiceFreeTrialActive(trialStartedAt)
    if (!trialStartedAt || freeTrialActive) {
      const newBalance = await readCreditBalance(auth.user.id)
      return NextResponse.json({
        ok: true,
        charged: false,
        skippedCharge: true,
        freeTrialActive,
        code: 'FREE_TRIAL_NO_MONTHLY_CHARGE',
        newBalance,
        period: yearMonth,
        product: resolved,
        creditsWouldHaveBeen: MONTHLY_SERVICE_CREDITS[resolved],
      })
    }

    const charged = await chargeMonthlyIdempotent({
      userId: auth.user.id,
      yearMonth,
      product: resolved,
    })

    if (!charged.ok) {
      if (charged.error === 'insufficient_credits') {
        return NextResponse.json(
          {
            error: `Không đủ credits. Cần ${charged.amount} credit cho phí tháng này.`,
            requiredCredits: charged.amount,
            code: 'INSUFFICIENT_CREDITS',
            period: yearMonth,
          },
          { status: 402 }
        )
      }
      return NextResponse.json({ error: charged.error || 'Không thể trừ credits.' }, { status: 500 })
    }

    if (!charged.alreadyApplied) {
      rememberCurriculumPurchase({
        orderId: charged.eventKey,
        priceVnd: estimatedVndForMonthlyCredits(charged.amount),
      })
    }
    return NextResponse.json({
      ok: true,
      charged: !charged.alreadyApplied,
      alreadyCharged: charged.alreadyApplied,
      newBalance: charged.newBalance,
      period: yearMonth,
      product: resolved,
      credits: charged.amount,
      eventKey: charged.eventKey,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
