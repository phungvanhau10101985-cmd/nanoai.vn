import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { listNotificationsForUser } from '@/lib/db/notifications-repo'

/** Lấy danh sách thông báo của user */
export async function GET(req: NextRequest) {
  try {
    const authResult = await getUserForAction()
    if ('error' in authResult) return NextResponse.json({ error: authResult.error }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const limit = Math.min(Number(searchParams.get('limit')) || 20, 50)
    const unreadOnly = searchParams.get('unread') === '1'

    const items = await listNotificationsForUser(authResult.user!.id, { limit, unreadOnly })
    return NextResponse.json({ items })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[notifications] GET:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
