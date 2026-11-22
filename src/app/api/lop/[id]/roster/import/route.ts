import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { getUserForAction } from '@/lib/auth'
import { teacherCanTeachInClassPg } from '@/lib/db/classes-pg'
import { importClassRosterPg } from '@/lib/db/class-roster-pg'
import { tutoringClassFeatureBlock } from '@/lib/db/tutoring-package-pg'
import { parseRosterMatrix } from '@/lib/lop/class-roster'
import { getServerDictionary } from '@/lib/i18n/server'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

const MAX_BYTES = 2_000_000

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'file' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'file' }, { status: 400 })

  const workbook = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: 'buffer', cellDates: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0] ?? '']
  if (!sheet) return NextResponse.json({ error: 'file' }, { status: 400 })
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' }) as unknown[][]
  const parsed = parseRosterMatrix(matrix.slice(0, 501))
  if (parsed.errors.some((item) => item.code === 'missing_code_column')) {
    return NextResponse.json({ error: 'missing_code_column' }, { status: 422 })
  }
  if (parsed.rows.length === 0) {
    return NextResponse.json({ inserted: 0, updated: 0, errors: parsed.errors.slice(0, 20) }, { status: 422 })
  }

  const saved = await importClassRosterPg(classId, parsed.rows)
  if (saved === 'schema') {
    const { t } = getServerDictionary()
    return NextResponse.json({ error: t.classes.rosterSchemaMissing }, { status: 503 })
  }
  if (!saved) return NextResponse.json({ error: 'save' }, { status: 500 })

  revalidatePath(`/lop/${classId}`)
  revalidatePath(`/lop/${classId}/hoc-sinh`)
  return NextResponse.json({ ...saved, errors: parsed.errors.slice(0, 20) })
}
