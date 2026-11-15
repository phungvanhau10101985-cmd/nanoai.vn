import { NextResponse } from 'next/server'
import { getWalletSessionUser } from '@/lib/auth'
import { claimGuestCreationsForUser, parseGuestCreationClaimItems } from '@/lib/auth/claim-guest-creations'
import { isGuestTrialUser } from '@/lib/guest-credit-trial'

export const dynamic = 'force-dynamic'

/** Đổ ảnh và bản tạo đang nằm trên trình duyệt vào tài khoản vừa đăng nhập. */
export async function POST(request: Request) {
  const user = await getWalletSessionUser()
  if (!user || (await isGuestTrialUser(user.id))) {
    return NextResponse.json({ error: 'login_required' }, { status: 401 })
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  const items = parseGuestCreationClaimItems(body)
  if (!items.length) return NextResponse.json({ ok: true, moved: 0, inserted: 0 })
  try {
    const result = await claimGuestCreationsForUser(user.id, items)
    return NextResponse.json({ ok: true, ...result })
  } catch {
    return NextResponse.json({ error: 'claim_failed' }, { status: 500 })
  }
}
