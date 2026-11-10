import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { markSubjectItemOpenedForUser } from '@/lib/lop/class-subject-item-opens'
import { SUBJECT_ITEM_KINDS, type SubjectItemKind } from '@/lib/lop/subject-item-open'

export async function POST(req: Request) {
  const auth = await getUserForAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const body = (await req.json().catch(() => null)) as {
    classId?: unknown
    subjectId?: unknown
    teacherId?: unknown
    kind?: unknown
    itemId?: unknown
  } | null
  const kind = String(body?.kind ?? '')
  if (!SUBJECT_ITEM_KINDS.includes(kind as SubjectItemKind)) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }

  try {
    const result = await markSubjectItemOpenedForUser(auth.user.id, {
      classId: String(body?.classId ?? ''),
      subjectId: String(body?.subjectId ?? ''),
      teacherId: String(body?.teacherId ?? ''),
      kind: kind as SubjectItemKind,
      itemId: String(body?.itemId ?? ''),
    })
    if (!result.ok) return NextResponse.json({ error: 'rejected' }, { status: result.status })
    const classId = String(body?.classId ?? '')
    revalidatePath(`/lop/${classId}`)
    revalidatePath(`/lop/${classId}/on-bai`)
    revalidatePath(`/lop/${classId}/bai-thi`)
    revalidatePath(`/lop/${classId}/phieu-bai-tap`)
    revalidatePath(`/lop/${classId}/diem`)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[api/lop/subject-item-open]', error)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
