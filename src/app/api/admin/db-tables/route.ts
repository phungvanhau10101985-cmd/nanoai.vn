import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { getProfileRoleWithFallback } from '@/lib/db/read-user-dashboard-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { fetchAdminTablePage, listAdminBaseTables } from '@/lib/db/admin-table-browser-pg'

export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const authResult = await getUserForAction()
  if ('error' in authResult) return { error: authResult.error, status: 401 as const }
  const { user } = authResult
  const role = await getProfileRoleWithFallback(user.id)
  if (role !== 'admin') {
    return { error: 'Chỉ quản trị viên mới được truy cập.', status: 403 as const }
  }
  return { user }
}

/**
 * GET /api/admin/db-tables — danh sách bảng
 * GET /api/admin/db-tables?schema=public&table=profiles&page=1&limit=50 — một trang dữ liệu
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Chưa cấu hình DATABASE_URL.' }, { status: 503 })
  }

  const { searchParams } = new URL(req.url)
  const schema = searchParams.get('schema')?.trim() ?? ''
  const table = searchParams.get('table')?.trim() ?? ''

  if (!schema || !table) {
    try {
      const tables = await listAdminBaseTables()
      return NextResponse.json({ tables })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  }

  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50))
  const offset = (page - 1) * limit

  try {
    const result = await fetchAdminTablePage(schema, table, limit, offset)
    return NextResponse.json({
      schema,
      table,
      page,
      ...result,
      rowCount: result.rows.length,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
