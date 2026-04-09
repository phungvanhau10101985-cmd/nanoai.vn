import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { getProfileRoleWithFallback } from '@/lib/db/read-user-dashboard-pg'
import { isPgConfigured } from '@/lib/db/pool'
import {
  fetchWorksheetVerifyBatchReportByIdPg,
  listWorksheetVerifyBatchReportsPg,
} from '@/lib/db/worksheet-verify-batch-pg'
import { startNewBatchReport, runBatchVerifyStep } from '@/lib/worksheet-verify/admin-batch-verify'

async function requireAdmin() {
  const auth = await getUserForAction()
  if ('error' in auth) {
    return { error: NextResponse.json({ error: auth.error }, { status: 401 }) }
  }
  const role = await getProfileRoleWithFallback(auth.user.id)
  if (role !== 'admin') {
    return { error: NextResponse.json({ error: 'Chỉ quản trị viên.' }, { status: 403 }) }
  }
  return { user: auth.user }
}

/** Danh sách báo cáo lô verify, hoặc ?id=uuid để lấy một bản ghi kèm details (JSON) */
export async function GET(req: NextRequest) {
  try {
    const gate = await requireAdmin()
    if ('error' in gate) return gate.error

    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 })
    }

    const id = req.nextUrl.searchParams.get('id')?.trim()
    if (id) {
      const data = await fetchWorksheetVerifyBatchReportByIdPg(id)
      if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json({ item: data })
    }

    const items = await listWorksheetVerifyBatchReportsPg(80)
    if (items === null) return NextResponse.json({ error: 'Query failed' }, { status: 500 })
    return NextResponse.json({ items })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/**
 * POST body:
 * - { "action": "start" } — tạo báo cáo mới + hàng đợi phiếu còn câu chưa verify
 * - { "action": "step", "reportId": "uuid", "batchSize"?: number } — xử lý thêm một lô (mặc định 1 phiếu/lần tránh timeout)
 * Một lượt verify LẠI toàn bộ phiếu đã từng chốt: chạy một lần `npx tsx scripts/run-reverify-all-once.ts` (xem script).
 */
export async function POST(req: NextRequest) {
  try {
    const gate = await requireAdmin()
    if ('error' in gate) return gate.error
    const { user } = gate

    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 })
    }

    const body = await req.json().catch(() => ({}))
    const action = (body?.action as string)?.trim()

    if (action === 'start') {
      const { reportId, worksheetsPlanned } = await startNewBatchReport(user.id)
      return NextResponse.json({ ok: true, reportId, worksheetsPlanned })
    }

    if (action === 'step') {
      const reportId = (body?.reportId as string)?.trim()
      if (!reportId) return NextResponse.json({ error: 'Thiếu reportId.' }, { status: 400 })
      const batchSize = Math.min(10, Math.max(1, Number(body?.batchSize) || 1))
      const result = await runBatchVerifyStep(reportId, batchSize)
      return NextResponse.json({ ok: true, ...result })
    }

    return NextResponse.json({ error: 'action không hợp lệ (start | step).' }, { status: 400 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[admin/worksheet-verify-batch]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
