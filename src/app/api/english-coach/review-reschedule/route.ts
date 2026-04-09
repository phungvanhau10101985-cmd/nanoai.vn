import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import { rescheduleReviewQueueWordsPg } from '@/lib/db/language-coach-misc-pg'

type ReschedulePayload = {
  words: Array<{ word: string; targetLanguage?: string }>
}

/** Đặt due_at = now cho các từ cần ôn lại (từ gợi ý mới gõ được) */
export async function POST(request: NextRequest) {
  try {
    const auth = await getUserForAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth

    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Server database is not configured.' }, { status: 503 })
    }

    const payload = (await request.json().catch(() => ({}))) as ReschedulePayload
    const words = Array.isArray(payload.words) ? payload.words : []
    if (words.length === 0) return NextResponse.json({ ok: true, updated: 0 })

    const updated = await rescheduleReviewQueueWordsPg(user.id, words)
    return NextResponse.json({ ok: true, updated })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
