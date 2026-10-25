import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import { listMatchingExamPresetsPg } from '@/lib/db/exam-preset-pg'

export async function GET(req: NextRequest) {
  try {
    const auth = await getUserForAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Chưa cấu hình cơ sở dữ liệu.' }, { status: 503 })
    }
    const url = new URL(req.url)
    const subjectId = String(url.searchParams.get('subjectId') ?? '').trim()
    const gradeLevelId = String(url.searchParams.get('gradeLevelId') ?? '').trim()
    const durationMinutes = Math.floor(Number(url.searchParams.get('durationMinutes') ?? 0))
    const topics = String(url.searchParams.get('topics') ?? '')
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean)
    if (!subjectId || !gradeLevelId || durationMinutes <= 0 || topics.length === 0) {
      return NextResponse.json({ items: [] })
    }
    const items = await listMatchingExamPresetsPg({
      subjectId,
      gradeLevelId,
      durationMinutes,
      topics,
    })
    if (items === null) {
      return NextResponse.json({ error: 'Không đọc được đề dựng sẵn.' }, { status: 500 })
    }
    return NextResponse.json({ items })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
