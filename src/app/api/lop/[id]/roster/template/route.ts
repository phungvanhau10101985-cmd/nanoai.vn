import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { getUserForAction } from '@/lib/auth'
import { teacherCanTeachInClassPg } from '@/lib/db/classes-pg'
import { tutoringClassFeatureBlock } from '@/lib/db/tutoring-package-pg'
import { getServerDictionary } from '@/lib/i18n/server'
import { rosterTemplateRows } from '@/lib/lop/class-roster'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: classId } = await params
  const auth = await getUserForAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
  const featureBlock = await tutoringClassFeatureBlock(classId)
  if (featureBlock === 'dissolved' || featureBlock === 'missing') {
    const { t } = getServerDictionary()
    return NextResponse.json({ error: t.classes.tutoringClassDissolved }, { status: 404 })
  }
  const allowed = await teacherCanTeachInClassPg(classId, auth.user.id)
  if (allowed !== true) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const ws = XLSX.utils.aoa_to_sheet(rosterTemplateRows())
  ws['!cols'] = [{ wch: 8 }, { wch: 28 }, { wch: 16 }, { wch: 20 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Danh sach')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="mau-danh-sach-lop.xlsx"',
    },
  })
}
