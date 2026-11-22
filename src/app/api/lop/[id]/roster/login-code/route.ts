import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getUserForAction } from '@/lib/auth'
import { teacherCanTeachInClassPg } from '@/lib/db/classes-pg'
import { reissueRosterLoginCodePg } from '@/lib/db/class-entry-pg'
import { tutoringClassFeatureBlock } from '@/lib/db/tutoring-package-pg'
import { getServerDictionary } from '@/lib/i18n/server'

export const dynamic = 'force-dynamic'

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

  const body = (await request.json().catch(() => null)) as { studentCode?: unknown } | null
  const saved = await reissueRosterLoginCodePg(classId, String(body?.studentCode ?? ''))
  if (saved === 'schema') {
    const { t } = getServerDictionary()
    return NextResponse.json({ error: t.classes.rosterSchemaMissing }, { status: 503 })
  }
  if (saved === 'missing') return NextResponse.json({ error: 'missing' }, { status: 404 })
  if (!saved) return NextResponse.json({ error: 'save' }, { status: 500 })

  revalidatePath(`/lop/${classId}`)
  revalidatePath(`/lop/${classId}/hoc-sinh`)
  return NextResponse.json(saved)
}
