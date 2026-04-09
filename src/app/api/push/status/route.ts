import { NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { countPushSubscriptionsForUser } from '@/lib/db/push-subscriptions-repo'

/** Có ít nhất một subscription push cho user hiện tại không. */
export async function GET() {
  try {
    const auth = await getUserForAction()
    if ('error' in auth) {
      return NextResponse.json({ subscribed: false }, { status: 401 })
    }

    const n = await countPushSubscriptionsForUser(auth.user.id)
    return NextResponse.json({ subscribed: n > 0 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ subscribed: false, error: msg }, { status: 500 })
  }
}
