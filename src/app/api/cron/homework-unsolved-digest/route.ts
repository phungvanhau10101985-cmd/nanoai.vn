import { NextRequest, NextResponse } from 'next/server'
import { isPgConfigured } from '@/lib/db/pool'
import { emailUnsolvedHomeworkDigest } from '@/lib/homework-help/homework-help-unsolved'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('authorization')?.trim()
  if (!auth?.startsWith('Bearer ')) return false
  const token = auth.slice('Bearer '.length).trim()
  return [process.env.CRON_SECRET, process.env.MESSAGING_PARTNER_AI_CRON_SECRET]
    .map((item) => item?.trim())
    .filter(Boolean)
    .includes(token)
}

/** 8:30 giờ VN mỗi ngày. Không có bài mới thì không gửi mail. */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  if (!isPgConfigured()) {
    return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503 })
  }
  const digest = await emailUnsolvedHomeworkDigest()
  return NextResponse.json({ ok: true, digest })
}

export async function GET(request: NextRequest) {
  return POST(request)
}
