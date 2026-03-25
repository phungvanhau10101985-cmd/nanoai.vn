import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import {
  MONTHLY_SERVICE_CREDITS,
  MONTHLY_SERVICE_CHARGE_TYPES,
  getVietnamYearMonth,
  curriculumMonthlyEventKey,
  estimatedVndForMonthlyCredits,
  isValidYearMonth,
} from '@/lib/monthly-service-credits'
import { CREDIT_UNIT_PRICE_VND } from '@/lib/credit-unit-price'
import {
  SERVICE_FREE_TRIAL_DAYS,
  SIGNUP_BONUS_CREDITS,
  getServiceTrialEndsAt,
  getServiceFreeTrialDaysRemaining,
  isServiceFreeTrialActive,
} from '@/lib/service-free-trial'

const CURRICULUM_CREDITS = MONTHLY_SERVICE_CREDITS.curriculum
const CURRICULUM_CHARGE_TYPE = MONTHLY_SERVICE_CHARGE_TYPES.curriculum

/** Trạng thái theo phiên đăng nhập — không cache tĩnh. */
export const dynamic = 'force-dynamic'

function tryAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function readCreditBalance(admin: SupabaseClient, userId: string): Promise<number> {
  const { data, error } = await admin.from('credits').select('balance').eq('user_id', userId).maybeSingle()
  if (error) throw new Error(error.message || 'Không đọc được số dư credits.')
  return Number(data?.balance ?? 0)
}

async function hasChargedPeriod(admin: SupabaseClient, userId: string, eventKey: string): Promise<boolean> {
  const { count, error } = await admin
    .from('language_coach_credit_events')
    .select('id', { head: true, count: 'exact' })
    .eq('user_id', userId)
    .eq('event_key', eventKey)
  if (error) throw new Error(error.message || 'Không đọc được trạng thái phí tháng.')
  return (count || 0) > 0
}

async function chargeCurriculumMonthlyIdempotent(
  admin: SupabaseClient,
  input: { userId: string; yearMonth: string }
) {
  const eventKey = curriculumMonthlyEventKey(input.yearMonth, input.userId)
  const { data, error } = await admin.rpc('spend_credits_idempotent', {
    p_user_id: input.userId,
    p_amount: CURRICULUM_CREDITS,
    p_event_key: eventKey,
    p_charge_type: CURRICULUM_CHARGE_TYPE,
    p_session_id: null,
    p_metadata_json: JSON.stringify({
      kind: 'monthly_service_access',
      product: 'curriculum',
      period: input.yearMonth,
      credits: CURRICULUM_CREDITS,
    }),
  })
  if (error) throw new Error(error.message || 'Không thể trừ credits phí tháng.')
  const row = Array.isArray(data) ? data[0] : data
  return {
    ok: Boolean(row?.ok),
    alreadyApplied: Boolean(row?.already_applied),
    newBalance: Number(row?.new_balance || 0),
    error: String(row?.error || '').trim(),
    eventKey,
    amount: CURRICULUM_CREDITS,
  }
}

function curriculumProductPayload(admin: SupabaseClient, userId: string, yearMonth: string) {
  const eventKey = curriculumMonthlyEventKey(yearMonth, userId)
  return hasChargedPeriod(admin, userId, eventKey).then((chargedThisPeriod) => ({
    creditsRequired: CURRICULUM_CREDITS,
    estimatedVnd: estimatedVndForMonthlyCredits(CURRICULUM_CREDITS),
    chargedThisPeriod,
    eventKey,
  }))
}

/**
 * Chuẩn hóa POST `product`: rỗng hoặc `curriculum` → hợp lệ; `english_coach` / `englishCoach` → đã bỏ.
 */
function parseMonthlyPostProduct(raw: string): 'curriculum' | 'legacy_english' | 'invalid' {
  const v = String(raw || '').trim()
  if (v === '' || v === 'curriculum') return 'curriculum'
  if (v === 'english_coach' || v === 'englishCoach') return 'legacy_english'
  return 'invalid'
}

/**
 * GET: trạng thái phí tháng giáo trình (kỳ VN) + credit cần cho kỳ đó.
 * POST: trừ một lần / kỳ / curriculum (idempotent). English AI không có phí tháng — dùng `/api/english-coach/credits`.
 */
export async function GET() {
  try {
    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const yearMonth = getVietnamYearMonth()
    if (!isValidYearMonth(yearMonth)) {
      return NextResponse.json({ error: 'Không xác định được kỳ tháng.' }, { status: 500 })
    }

    const admin = tryAdminClient()
    if (!admin) {
      return NextResponse.json({ error: 'Cấu hình máy chủ thiếu Supabase service role.' }, { status: 503 })
    }
    const curriculum = await curriculumProductPayload(admin, auth.user.id, yearMonth)

    const createdAt = auth.user.created_at
    const freeTrialActive = isServiceFreeTrialActive(createdAt)
    const trialEndsAt = getServiceTrialEndsAt(createdAt)
    const curriculumOut = {
      ...curriculum,
      accessGranted: curriculum.chargedThisPeriod || freeTrialActive,
    }

    return NextResponse.json({
      ok: true,
      period: yearMonth,
      creditUnitVnd: CREDIT_UNIT_PRICE_VND,
      signupBonusCredits: SIGNUP_BONUS_CREDITS,
      freeTrialDays: SERVICE_FREE_TRIAL_DAYS,
      freeTrial: {
        active: freeTrialActive,
        endsAt: trialEndsAt?.toISOString() ?? null,
        daysRemaining: getServiceFreeTrialDaysRemaining(createdAt),
        userCreatedAt: createdAt ?? null,
      },
      products: {
        curriculum: curriculumOut,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { product?: string }
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
      return NextResponse.json({ error: 'Thiếu hoặc sai product (chỉ hỗ trợ curriculum).' }, { status: 400 })
    }

    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

    const yearMonth = getVietnamYearMonth()
    if (!isValidYearMonth(yearMonth)) {
      return NextResponse.json({ error: 'Không xác định được kỳ tháng.' }, { status: 500 })
    }

    const admin = tryAdminClient()
    if (!admin) {
      return NextResponse.json({ error: 'Cấu hình máy chủ thiếu Supabase service role.' }, { status: 503 })
    }

    const createdAt = auth.user.created_at
    if (isServiceFreeTrialActive(createdAt)) {
      const newBalance = await readCreditBalance(admin, auth.user.id)
      return NextResponse.json({
        ok: true,
        charged: false,
        skippedCharge: true,
        freeTrialActive: true,
        code: 'FREE_TRIAL_NO_MONTHLY_CHARGE',
        newBalance,
        period: yearMonth,
        product: 'curriculum',
        creditsWouldHaveBeen: CURRICULUM_CREDITS,
      })
    }

    const charged = await chargeCurriculumMonthlyIdempotent(admin, {
      userId: auth.user.id,
      yearMonth,
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

    return NextResponse.json({
      ok: true,
      charged: !charged.alreadyApplied,
      alreadyCharged: charged.alreadyApplied,
      newBalance: charged.newBalance,
      period: yearMonth,
      product: 'curriculum',
      credits: charged.amount,
      eventKey: charged.eventKey,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
