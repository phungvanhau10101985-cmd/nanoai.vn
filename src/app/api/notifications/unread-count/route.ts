import { NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { countUnreadNotificationsForUser } from '@/lib/db/notifications-repo'

/** Số thông báo chưa đọc */
export async function GET() {
  try {
    const authResult = await getUserForAction()
    if ('error' in authResult) return NextResponse.json({ count: 0 })

    const count = await countUnreadNotificationsForUser(authResult.user!.id)
    return NextResponse.json({ count })
  } catch {
    return NextResponse.json({ count: 0 })
  }
}
