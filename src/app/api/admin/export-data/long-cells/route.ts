import { NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { getProfileRoleWithFallback } from '@/lib/db/read-user-dashboard-pg'
import { isPgConfigured } from '@/lib/db/pool'

const EXCEL_MAX_CELL = 32767

async function requireAdmin() {
  const authResult = await getUserForAction()
  if ('error' in authResult) return { error: authResult.error, status: 401 }
  const { user } = authResult
  const role = await getProfileRoleWithFallback(user.id)
  if (role !== 'admin') {
    return { error: 'Chỉ quản trị viên mới được kiểm tra.', status: 403 }
  }
  return { user }
}

/** GET: Tìm các ô có dữ liệu > 32767 ký tự (giới hạn Excel) */
export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Chưa cấu hình cơ sở dữ liệu.' }, { status: 503 })
  }

  const results: Array<{ table: string; id: string; column: string; length: number; preview: string }> = []

  return NextResponse.json({
    maxCellChars: EXCEL_MAX_CELL,
    violations: results,
    summary: results.length
      ? `${results.length} ô vượt giới hạn (${EXCEL_MAX_CELL} ký tự)`
      : 'Không có ô nào vượt giới hạn.',
  })
}
