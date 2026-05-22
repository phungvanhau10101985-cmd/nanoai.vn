import { NextResponse } from 'next/server'
import { getUserForCreditAction, getWalletSessionUser } from '@/lib/auth'
import { getCreditBalanceByUserId } from '@/lib/db/credits-balance'
import {
  GUEST_CREDIT_TRIAL_BUDGET_CREDITS,
  getGuestCreditTrialRemainingCount,
  getGuestTrialUserIdFromCookie,
  isGuestTrialUser,
} from '@/lib/guest-credit-trial'

export const dynamic = 'force-dynamic'

/** GET: số dư credits — chỉ Postgres (DATABASE_URL). */
export async function GET() {
  try {
    const walletUser = await getWalletSessionUser()
    if (walletUser) {
      const isGuestTrial = await isGuestTrialUser(walletUser.id)
      const balance = await getCreditBalanceByUserId(walletUser.id)
      const guestTrialRemaining = isGuestTrial ? await getGuestCreditTrialRemainingCount() : 0
      const visibleBalance = isGuestTrial ? 0 : balance
      return NextResponse.json({
        balance: visibleBalance,
        guestTrialRemaining,
        guestTrialBudget: isGuestTrial ? GUEST_CREDIT_TRIAL_BUDGET_CREDITS : 0,
        isGuestTrial,
      })
    }

    const guestTrialUserId = getGuestTrialUserIdFromCookie()
    if (guestTrialUserId) {
      return NextResponse.json({
        balance: 0,
        guestTrialRemaining: await getGuestCreditTrialRemainingCount(),
        guestTrialBudget: GUEST_CREDIT_TRIAL_BUDGET_CREDITS,
        isGuestTrial: true,
      })
    }

    const auth = await getUserForCreditAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const isGuestTrial = await isGuestTrialUser(auth.user.id)
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
