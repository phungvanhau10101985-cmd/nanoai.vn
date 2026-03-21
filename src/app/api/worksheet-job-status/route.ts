/**
 * Lấy trạng thái job worksheet – client poll để xem kết quả.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

    const jobId = req.nextUrl.searchParams.get('jobId')
    if (!jobId) return NextResponse.json({ error: 'Thiếu jobId.' }, { status: 400 })

    const { data: job, error } = await supabase
      .from('worksheet_jobs')
      .select('id, type, status, result, error_message, created_at, updated_at')
      .eq('id', jobId)
      .eq('user_id', auth.user!.id)
      .single()

    if (error || !job) return NextResponse.json({ error: 'Không tìm thấy job.' }, { status: 404 })

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
