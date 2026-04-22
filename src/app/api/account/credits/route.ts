import { NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { getCreditBalanceByUserId } from '@/lib/db/credits-balance'
import {
  GUEST_CREDIT_TRIAL_BUDGET_CREDITS,
  getGuestCreditTrialRemainingCount,
  isGuestTrialUserId,
} from '@/lib/guest-credit-trial'

export const dynamic = 'force-dynamic'

/** GET: số dư credits — chỉ Postgres (DATABASE_URL). */
export async function GET() {
  try {
    const auth = await getUserForCreditAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const isGuestTrial = isGuestTrialUserId(auth.user.id)
    const balance = await getCreditBalanceByUserId(auth.user.id)
    const guestTrialRemaining = isGuestTrial ? await getGuestCreditTrialRemainingCount() : 0
    const visibleBalance = isGuestTrial ? 0 : balance
    return NextResponse.json({
      balance: visibleBalance,
      guestTrialRemaining,
      guestTrialBudget: isGuestTrial ? GUEST_CREDIT_TRIAL_BUDGET_CREDITS : 0,
      isGuestTrial,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
