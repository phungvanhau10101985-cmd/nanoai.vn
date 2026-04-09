/**
 * Verify phiếu bài tập ngầm – chạy sau khi tạo phiếu từng câu.
 * Giai đoạn 2: verify từng câu, cập nhật DB nếu cần sửa.
 */
import { NextRequest, NextResponse } from 'next/server'
import { worksheetSheetExistsByIdFromPg } from '@/lib/db/worksheet-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { getUserForAction } from '@/lib/auth'
import { runWorksheetVerifyForSheet } from '@/lib/worksheet-verify/run-worksheet-verify-for-sheet'
import { recordBackgroundVerifyReport } from '@/lib/worksheet-verify/record-background-verify-report'

export async function POST(req: NextRequest) {
  try {
    const auth = await getUserForAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const worksheetId = (body?.worksheetId as string)?.trim()
    const curriculumMarkdownParam = (body?.curriculumMarkdown as string)?.trim()
    if (!worksheetId) return NextResponse.json({ error: 'Thiếu worksheetId.' }, { status: 400 })

    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 })
    }

    if (!process.env.GOOGLE_API_KEY?.trim()) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'GOOGLE_API_KEY chưa cấu hình' })
    }

    const ex = await worksheetSheetExistsByIdFromPg(worksheetId)
    if (ex === false) {
      return NextResponse.json({ error: 'Không tìm thấy phiếu bài tập.' }, { status: 404 })
    }
    if (ex === null) {
      return NextResponse.json({ error: 'Không đọc được phiếu bài tập.' }, { status: 500 })
    }

    const t0 = Date.now()
    const stats = await runWorksheetVerifyForSheet(worksheetId, {
      curriculumMarkdownOverride: curriculumMarkdownParam,
    })
    const durationMs = Date.now() - t0

    try {
      await recordBackgroundVerifyReport({
        worksheetId,
        triggeredBy: auth.user.id,
        stats,
        durationMs,
      })
    } catch (auditErr) {
      console.error('[worksheet-verify-background] recordBackgroundVerifyReport', auditErr)
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
