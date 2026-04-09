import { NextRequest, NextResponse } from 'next/server'
export const maxDuration = 120
import { getUserForAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import { fetchAllRowsFromPublicTablePaged } from '@/lib/db/admin-export-pg'
import { getProfileRoleWithFallback } from '@/lib/db/read-user-dashboard-pg'
import * as XLSX from 'xlsx'
import { PUBLIC_TABLES, type PublicTableName } from './public-tables'

const EXCEL_MAX_CELL = 32767

function truncateForExcel(s: string): string {
  if (s.length <= EXCEL_MAX_CELL) return s
  return s.slice(0, EXCEL_MAX_CELL - 3) + '...'
}

/** Chuyển options (mảng đáp án) và các jsonb/array thành chuỗi dễ đọc trong Excel */
function flattenRowForExcel(row: Record<string, unknown>): Record<string, unknown> {
  if (row._error) return row
  const out: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(row)) {
    try {
      let str: string
      if (Array.isArray(val)) {
        if (key === 'options' && val.every((x) => typeof x === 'string')) {
          str = (val as string[]).map((s, i) => `${String.fromCharCode(65 + i)}. ${s}`).join(' | ')
        } else {
          str = val.map((v) => (typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v))).join(' | ')
        }
      } else if (val !== null && typeof val === 'object') {
        str = JSON.stringify(val)
      } else {
        str = val == null ? '' : String(val)
      }
      out[key] = truncateForExcel(str)
    } catch {
      out[key] = truncateForExcel(String(val ?? ''))
    }
  }
  return out
}

async function requireAdmin() {
  const authResult = await getUserForAction()
  if ('error' in authResult) return { error: authResult.error, status: 401 }
  const { user } = authResult
  const role = await getProfileRoleWithFallback(user.id)
  if (role !== 'admin') {
    return { error: 'Chỉ quản trị viên mới được xuất dữ liệu.', status: 403 }
  }
  return { user }
}

/** GET: Danh sách bảng có thể xuất */
export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  return NextResponse.json({ tables: [...PUBLIC_TABLES] })
}

/** POST: Xuất dữ liệu theo bảng đã chọn, định dạng JSON hoặc Excel */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await req.json().catch(() => ({}))
    const tables = Array.isArray(body.tables) ? (body.tables as string[]).filter((t) => PUBLIC_TABLES.includes(t as PublicTableName)) : []
    const format = String(body.format || 'json').toLowerCase() === 'xlsx' ? 'xlsx' : 'json'

    if (tables.length === 0) {
      return NextResponse.json({ error: 'Chọn ít nhất một bảng để xuất.' }, { status: 400 })
    }

    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Chưa cấu hình cơ sở dữ liệu (DATABASE_URL).' }, { status: 503 })
    }

    const PAGE_SIZE = 1000
    const tablesData: Record<string, unknown[]> = {}
    for (const table of tables) {
      try {
        tablesData[table] = await fetchAllRowsFromPublicTablePaged(table as PublicTableName, PAGE_SIZE)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        tablesData[table] = [{ _error: msg }]
      }
    }

    const dateStr = new Date().toISOString().slice(0, 10)

    if (format === 'xlsx') {
      const wb = XLSX.utils.book_new()
      for (const [tableName, rows] of Object.entries(tablesData)) {
        const sheetName = tableName.slice(0, 31) // Excel sheet name max 31 chars
        const flatRows = (rows as Record<string, unknown>[]).map((row) => flattenRowForExcel(row))
        const ws = XLSX.utils.json_to_sheet(flatRows)
        XLSX.utils.book_append_sheet(wb, ws, sheetName)
      }
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="db-export-${dateStr}.xlsx"`,
        },
      })
    }

    const payload = { exported_at: new Date().toISOString(), tables: tablesData }
    return NextResponse.json(payload, {
      headers: {
        'Content-Disposition': `attachment; filename="db-export-${dateStr}.json"`,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[export-data]', e)
    return NextResponse.json({ error: msg || 'Lỗi xuất dữ liệu.' }, { status: 500 })
  }
}
