import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import {
  startNewBatchReport,
  runBatchVerifyStep,
} from '@/lib/worksheet-verify/admin-batch-verify'

function getAdminServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) return null
  return createClient(url, key)
}

async function requireAdmin() {
  const supabase = createServerClient()
  const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in auth) {
    return { error: NextResponse.json({ error: auth.error }, { status: 401 }) }
  }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single()
  if (profile?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Chỉ quản trị viên.' }, { status: 403 }) }
  }
  return { user: auth.user, supabase }
}

/** Danh sách báo cáo lô verify, hoặc ?id=uuid để lấy một bản ghi kèm details (JSON) */
export async function GET(req: NextRequest) {
  try {
    const gate = await requireAdmin()
    if ('error' in gate) return gate.error
    const { supabase } = gate

    const id = req.nextUrl.searchParams.get('id')?.trim()
    if (id) {
      const { data, error } = await supabase.from('worksheet_verify_batch_reports').select('*').eq('id', id).single()
      if (error) return NextResponse.json({ error: error.message }, { status: 404 })
      return NextResponse.json({ item: data })
    }

    const { data, error } = await supabase
      .from('worksheet_verify_batch_reports')
      .select(
        'id, created_at, updated_at, finished_at, status, triggered_by, worksheets_planned, worksheets_processed, questions_marked_verified, questions_content_updated, questions_skipped_invalid, error_summary'
      )
      .order('created_at', { ascending: false })
      .limit(80)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ items: data ?? [] })
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

    const admin = getAdminServiceClient()
    if (!admin) {
      return NextResponse.json({ error: 'Thiếu SUPABASE_SERVICE_ROLE_KEY hoặc NEXT_PUBLIC_SUPABASE_URL.' }, { status: 500 })
    }

    const body = await req.json().catch(() => ({}))
    const action = (body?.action as string)?.trim()

    if (action === 'start') {
      const { reportId, worksheetsPlanned } = await startNewBatchReport(admin, user.id)
      return NextResponse.json({ ok: true, reportId, worksheetsPlanned })
    }

    if (action === 'step') {
      const reportId = (body?.reportId as string)?.trim()
      if (!reportId) return NextResponse.json({ error: 'Thiếu reportId.' }, { status: 400 })
      const batchSize = Math.min(10, Math.max(1, Number(body?.batchSize) || 1))
      const result = await runBatchVerifyStep(admin, reportId, batchSize)
      return NextResponse.json({ ok: true, ...result })
    }

    return NextResponse.json({ error: 'action không hợp lệ (start | step).' }, { status: 400 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[admin/worksheet-verify-batch]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
