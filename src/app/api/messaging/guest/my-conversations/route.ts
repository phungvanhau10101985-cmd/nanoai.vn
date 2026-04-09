import { NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { listWidgetChatsForLinkedUser } from '@/lib/messaging/list-widget-chats-for-linked-user'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await getUserForAction('Unauthorized')
  if ('error' in auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const user = auth.user

  const { items, error } = await listWidgetChatsForLinkedUser(user.id)
  if (error) {
    return NextResponse.json({ error }, { status: 500 })
  }

  return NextResponse.json({ conversations: items })
}
