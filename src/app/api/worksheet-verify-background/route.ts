/**
 * Verify phiếu bài tập ngầm – chạy sau khi tạo phiếu từng câu.
 * Giai đoạn 2: verify từng câu, cập nhật DB nếu cần sửa.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { runWorksheetVerifyForSheet } from '@/lib/worksheet-verify/run-worksheet-verify-for-sheet'
import { recordBackgroundVerifyReport } from '@/lib/worksheet-verify/record-background-verify-report'

/** Client có quyền ghi verified_at / content_json bất kể owner – bắt buộc vì RLS worksheet_questions không cho UPDATE qua JWT nếu không có policy đủ rộng. */
function getVerifySupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (url && serviceKey) {
    return createSupabaseJsClient(url, serviceKey)
  }
  return createClient()
}

export async function POST(req: NextRequest) {
  try {
    const supabaseAuth = createClient()
    const auth = await getUserForAction(() => supabaseAuth.auth.getUser(), 'Vui lòng đăng nhập.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

    const supabase = getVerifySupabaseClient()

    const body = await req.json().catch(() => ({}))
    const worksheetId = (body?.worksheetId as string)?.trim()
    const curriculumMarkdownParam = (body?.curriculumMarkdown as string)?.trim()
    if (!worksheetId) return NextResponse.json({ error: 'Thiếu worksheetId.' }, { status: 400 })

    if (!process.env.GOOGLE_API_KEY?.trim()) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'GOOGLE_API_KEY chưa cấu hình' })
    }

    const { data: ws, error: wsErr } = await supabase
      .from('worksheet_worksheets')
      .select('id')
      .eq('id', worksheetId)
      .single()

    if (wsErr || !ws) return NextResponse.json({ error: 'Không tìm thấy phiếu bài tập.' }, { status: 404 })

    const t0 = Date.now()
    const stats = await runWorksheetVerifyForSheet(supabase, worksheetId, {
      curriculumMarkdownOverride: curriculumMarkdownParam,
    })
    const durationMs = Date.now() - t0

    /** Ghi báo cáo cho trang admin (cùng bảng batch). Chỉ khi API dùng service role — user JWT không INSERT được qua RLS. */
    if (process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
      try {
        await recordBackgroundVerifyReport(supabase, {
          worksheetId,
          triggeredBy: auth.user.id,
          stats,
          durationMs,
        })
      } catch (auditErr) {
        console.error('[worksheet-verify-background] recordBackgroundVerifyReport', auditErr)
      }
    }

    if (stats.errors.length > 0 && stats.markedVerified === 0 && stats.contentUpdates === 0) {
      const onlyKey = stats.errors.length === 1 && stats.errors[0].includes('GOOGLE_API_KEY')
      if (onlyKey) {
        return NextResponse.json({ ok: true, skipped: true, reason: stats.errors[0] })
      }
    }

    return NextResponse.json({
      ok: true,
      updated: stats.contentUpdates + stats.markedVerified,
      skippedInvalid: stats.skippedInvalid,
      errors: stats.errors.length > 0 ? stats.errors : undefined,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
