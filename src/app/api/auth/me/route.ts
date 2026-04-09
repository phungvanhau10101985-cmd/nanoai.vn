import { NextResponse } from 'next/server'
import { getEmailSessionUser } from '@/lib/auth/email-session-user'

export const dynamic = 'force-dynamic'

/** Phiên đăng nhập: JWT email (httpOnly). */
export async function GET() {
  const emailUser = await getEmailSessionUser()
  if (emailUser) {
    return NextResponse.json({
      user: { id: emailUser.id, email: emailUser.email ?? '' },
    })
  }
  return NextResponse.json({ user: null }, { status: 401 })
}
