/**
 * Lấy trạng thái job worksheet – client poll để xem kết quả.
 */
import { NextRequest, NextResponse } from 'next/server'
import { fetchWorksheetJobForUserFromPg } from '@/lib/db/worksheet-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { getUserForAction } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const auth = await getUserForAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

    const jobId = req.nextUrl.searchParams.get('jobId')
    if (!jobId) return NextResponse.json({ error: 'Thiếu jobId.' }, { status: 400 })

    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Chưa cấu hình cơ sở dữ liệu.' }, { status: 503 })
    }

    const uid = auth.user!.id
    const job = await fetchWorksheetJobForUserFromPg(jobId, uid)
    if (!job) return NextResponse.json({ error: 'Không tìm thấy job.' }, { status: 404 })

    return NextResponse.json({
      jobId: job.id,
      type: job.type,
      status: job.status,
      result: job.result,
      error: job.error_message,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
