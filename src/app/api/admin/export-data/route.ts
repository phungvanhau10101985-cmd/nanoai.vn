import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 120
import { getUserForAction } from '@/lib/auth'
import { createClient as createAdminClient } from '@supabase/supabase-js'
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
  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in authResult) return { error: authResult.error, status: 401 }
  const { user } = authResult
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
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

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    const PAGE_SIZE = 1000
    const tablesData: Record<string, unknown[]> = {}
    for (const table of tables) {
      const allRows: unknown[] = []
      let offset = 0
      let hasMore = true
      while (hasMore) {
        const { data, error } = await admin.from(table).select('*').range(offset, offset + PAGE_SIZE - 1)
        if (error) {
          tablesData[table] = [{ _error: error.message }]
          break
        }
        const rows = data ?? []
        allRows.push(...rows)
        hasMore = rows.length === PAGE_SIZE
        offset += PAGE_SIZE
      }
      if (!tablesData[table]) tablesData[table] = allRows
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
