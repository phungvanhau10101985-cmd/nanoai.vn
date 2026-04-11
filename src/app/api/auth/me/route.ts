import { NextResponse } from 'next/server'
import { getWalletSessionUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/** Phiên đăng nhập: JWT email (httpOnly) hoặc guest account chat đã OTP (cookie/header). */
export async function GET() {
  const user = await getWalletSessionUser()
  if (user) {
    return NextResponse.json({
      user: { id: user.id, email: user.email ?? '' },
    })
  }
  return NextResponse.json({ user: null }, { status: 401 })
}
