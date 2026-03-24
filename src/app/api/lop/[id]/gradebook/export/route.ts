import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { fetchClassGradebookData } from '@/lib/lop/class-gradebook'
import { getServerDictionary } from '@/lib/i18n/server'

function slugFileBase(name: string): string {
  const s = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 60)
  return s || 'lop'
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: classId } = await params
  const supabase = createClient()
  const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const result = await fetchClassGradebookData(supabase, classId, auth.user.id)
  if (!result.ok) {
    const status = result.error === 'not_found' ? 404 : 403
    return NextResponse.json({ error: result.error }, { status })
  }

  const { t } = getServerDictionary()
  const tc = t.classes
  const { className, columns, rows } = result.data
  const dateStr = new Date().toISOString().slice(0, 10)

  const headerRow: string[] = [
    tc.gradebookColNo,
    tc.gradebookColName,
    tc.gradebookColDob,
    ...columns.map((c) =>
      c.kind === 'worksheet'
        ? `${tc.gradebookKindWorksheet}: ${c.header}`
        : `${tc.gradebookKindExam}: ${c.header}`
    ),
    tc.gradebookColTotal,
  ]

  const dataRows = rows.map((r, i) => [
    String(i + 1),
    r.displayName,
    r.dob === '—' ? '' : r.dob,
    ...columns.map((c) => r.cells[c.key] ?? '—'),
    r.total10,
  ])

  const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'So diem')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const fname = `bang_diem_${slugFileBase(className)}_${dateStr}.xlsx`

  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fname}"`,
    },
  })
}
