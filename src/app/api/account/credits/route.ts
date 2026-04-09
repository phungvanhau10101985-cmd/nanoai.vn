import { NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { getCreditBalanceByUserId } from '@/lib/db/credits-balance'

export const dynamic = 'force-dynamic'

/** GET: số dư credits — chỉ Postgres (DATABASE_URL). */
export async function GET() {
  try {
    const auth = await getUserForAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const balance = await getCreditBalanceByUserId(auth.user.id)
    return NextResponse.json({ balance })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
