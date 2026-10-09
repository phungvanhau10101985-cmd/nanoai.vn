import { NextRequest, NextResponse } from 'next/server'

import { getUserForCreditAction } from '@/lib/auth'
import { notifyNanoAiAdminsHubFeatureRequest } from '@/lib/hub-chat/hub-feature-request-admin'

export async function POST(request: NextRequest) {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  let body: { message?: string } = {}
  try {
    body = (await request.json()) as { message?: string }
  } catch {
    body = {}
  }
  const message = String(body.message ?? '').trim()
  if (message.length < 2) {
    return NextResponse.json({ error: 'Nhập ít nhất 2 ký tự.' }, { status: 400 })
  }
  if (message.length > 800) {
    return NextResponse.json({ error: 'Góp ý tối đa 800 ký tự.' }, { status: 400 })
  }

  const sent = await notifyNanoAiAdminsHubFeatureRequest({
    userId: auth.user.id,
    message,
    kind: 'feedback',
  })
  if (!sent) {
    return NextResponse.json({ error: 'Chưa gửi được góp ý. Thử lại sau.' }, { status: 503 })
  }
  return NextResponse.json({ ok: true })
}
