import { NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { fetchPartnerOrderEventsForLinkedUserFromPg } from '@/lib/db/messaging-partner-orders-pg'
import { isValidUuidString } from '@/lib/validate-uuid'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, ctx: { params: Promise<{ orderId: string }> }) {
  const auth = await getUserForAction('Unauthorized')
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }
  const { orderId: raw } = await ctx.params
  const orderId = String(raw ?? '').trim()
  if (!isValidUuidString(orderId)) {
    return NextResponse.json({ error: 'Invalid order id.' }, { status: 400 })
  }
  const rows = await fetchPartnerOrderEventsForLinkedUserFromPg({
    linkedUserId: auth.user.id,
    orderId,
    limit: 100,
  })
  if (rows === null) {
    return NextResponse.json({ error: 'Failed to load events.' }, { status: 500 })
  }
  return NextResponse.json({ rows })
}
