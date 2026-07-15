import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { pgListHubMultiTaskPlans } from '@/lib/db/hub-chat-pg'

export async function GET(request: NextRequest) {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const status = request.nextUrl.searchParams.get('status')
  const plans = await pgListHubMultiTaskPlans(auth.user.id, {
    status: status === 'active' ? 'active' : status === 'completed' ? 'completed' : 'active_only',
    limit: 30,
  })

  return NextResponse.json({ ok: true, plans })
}
