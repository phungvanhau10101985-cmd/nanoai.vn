import { NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { getPaymentByIdForUser } from '@/lib/db/payments-repo'

export const dynamic = 'force-dynamic'

type RouteCtx = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteCtx) {
  try {
    const auth = await getUserForAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { id } = await context.params
    const paymentId = String(id || '').trim()
    if (!paymentId) return NextResponse.json({ error: 'Thiếu id.' }, { status: 400 })

    const payment = await getPaymentByIdForUser(paymentId, auth.user.id)
    if (!payment) return NextResponse.json({ error: 'Không tìm thấy.' }, { status: 404 })
    return NextResponse.json({ payment })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
