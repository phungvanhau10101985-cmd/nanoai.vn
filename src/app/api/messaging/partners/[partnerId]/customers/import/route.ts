import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { importPartnerShopMembersFromPg } from '@/lib/db/messaging-partner-customers-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { parseShopMemberUpload } from '@/lib/messaging/partner-shop-member-import'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  if (!isPgConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'website_customers')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Chọn file CSV hoặc Excel.' }, { status: 400 })
  const filename = file.name || ''
  if (!filename.toLowerCase().match(/\.(csv|xlsx|xls)$/)) {
    return NextResponse.json({ error: 'Chỉ hỗ trợ .csv, .xlsx hoặc .xls' }, { status: 400 })
  }
  const content = Buffer.from(await file.arrayBuffer())
  if (!content.length) return NextResponse.json({ error: 'File trống.' }, { status: 400 })
  if (content.length > 8 * 1024 * 1024) {
    return NextResponse.json({ error: 'File quá lớn.' }, { status: 400 })
  }

  let parsed
  try {
    parsed = parseShopMemberUpload(filename, content)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Không đọc được file'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const importable = parsed.rows.filter((row) => row.email)
  if (!importable.length) {
    return NextResponse.json(
      { error: 'Không có dòng hợp lệ — cần ít nhất email đúng định dạng.' },
      { status: 400 }
    )
  }

  const result = await importPartnerShopMembersFromPg({ partnerId: pid, rows: parsed.rows })
  const corrections = parsed.rows
    .filter((row) => row.email && row.emailCorrected)
    .slice(0, 100)
    .map((row) => ({ row: row.rowNumber, original: row.emailOriginal, fixed: row.email, fixes: row.emailFixes }))
  const invalidRows = parsed.rows
    .filter((row) => !row.email)
    .slice(0, 100)
    .map((row) => ({
      row: row.rowNumber,
      email: row.emailOriginal,
      name: row.name,
      reason: row.invalidReason || 'Thiếu email hoặc trùng dữ liệu',
    }))
  let message = `Import xong: ${result.created} thành viên mới, ${result.updated} cập nhật hồ sơ, ${result.skipped} không đổi / bỏ qua, ${parsed.invalidCount} không hợp lệ.`
  if (parsed.correctedCount) message += ` Đã sửa ${parsed.correctedCount} email gõ nhầm.`
  return NextResponse.json({
    created: result.created,
    updated: result.updated,
    skipped: result.skipped,
    invalid: parsed.invalidCount,
    corrected: parsed.correctedCount,
    duplicateInFile: parsed.duplicateInFile,
    totalInput: parsed.totalInput,
    corrections,
    invalidRows,
    message,
  })
}
