import { NextRequest, NextResponse } from 'next/server'
import { getWalletSessionUser } from '@/lib/auth'
import { readGuestSessionIdFromRequestStrictOrLoose } from '@/lib/messaging/guest-auth-session'
import { syncBrowserGuestSessionToUser } from '@/lib/messaging/sync-browser-guest-session-to-user'

export const dynamic = 'force-dynamic'

/** Phiên đăng nhập: JWT email (httpOnly) hoặc guest account chat đã OTP (cookie/header). */
export async function GET(request: NextRequest) {
  const user = await getWalletSessionUser()
  if (user) {
    await syncBrowserGuestSessionToUser({
      guestSessionId: readGuestSessionIdFromRequestStrictOrLoose(request),
      userId: user.id,
      email: user.email,
    })
    return NextResponse.json({
      user: { id: user.id, email: user.email ?? '' },
    })
  }
  return NextResponse.json({ user: null }, { status: 401 })
}
