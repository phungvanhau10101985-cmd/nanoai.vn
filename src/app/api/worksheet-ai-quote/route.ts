import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import { readWorksheetAiQuotaSnapshot } from '@/lib/db/worksheet-ai-quota-pg'

/** Suất miễn phí còn lại cho nút tạo từng câu và tách ảnh SGK. */
export async function GET(req: NextRequest) {
  try {
    const auth = await getUserForAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 })
    }

    const curriculumId = new URL(req.url).searchParams.get('curriculumId')?.trim() || null
    const snapshot = await readWorksheetAiQuotaSnapshot(auth.user.id, curriculumId)
    return NextResponse.json({ ok: true, ...snapshot })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
