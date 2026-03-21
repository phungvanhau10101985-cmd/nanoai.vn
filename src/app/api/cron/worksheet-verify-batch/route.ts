import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  startNewBatchReport,
  runBatchVerifyStep,
  fetchPendingWorksheetIds,
} from '@/lib/worksheet-verify/admin-batch-verify'

/**
 * Cron / tự động: mỗi lần gọi xử lý tối đa `batchSize` phiếu (mặc định 2).
 * Bảo vệ: header Authorization: Bearer <ADMIN_WORKSHEET_VERIFY_CRON_SECRET>
 *
 * Hành vi:
 * - Nếu đang có báo cáo status=running → step tiếp
 * - Nếu không → nếu còn phiếu pending → tạo báo cáo mới (triggered_by null) rồi step
 */
export async function GET(req: NextRequest) {
  const secret = process.env.ADMIN_WORKSHEET_VERIFY_CRON_SECRET?.trim()
  if (!secret) {
    return NextResponse.json({ error: 'ADMIN_WORKSHEET_VERIFY_CRON_SECRET chưa cấu hình.' }, { status: 503 })
  }
  const auth = req.headers.get('authorization')?.trim()
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) {
    return NextResponse.json({ error: 'Thiếu Supabase service env.' }, { status: 500 })
  }

  const admin = createClient(url, key)
  const batchSize = Math.min(5, Math.max(1, Number(req.nextUrl.searchParams.get('batchSize')) || 2))

  try {
    const { data: running } = await admin
      .from('worksheet_verify_batch_reports')
      .select('id')
      .eq('status', 'running')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    let reportId = running?.id as string | undefined

    if (!reportId) {
      const pending = await fetchPendingWorksheetIds(admin)
      if (pending.length === 0) {
        return NextResponse.json({ ok: true, message: 'no_pending', processed: 0 })
      }
      const started = await startNewBatchReport(admin, null)
      reportId = started.reportId
    }

    const result = await runBatchVerifyStep(admin, reportId!, batchSize)
    return NextResponse.json({ ok: true, cron: true, ...result })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[cron/worksheet-verify-batch]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
