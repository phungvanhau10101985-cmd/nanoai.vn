import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { fetchTeachingSubjectsPg } from '@/lib/db/classes-pg'
import { fetchSubjectNameExtrasPg, proposeSubjectNameEdit, voteSubjectName, type NameEditChoice } from '@/lib/db/name-edit-votes'
import { isPgConfigured } from '@/lib/db/pool'
import { listedClassSubjects } from '@/lib/lop/class-subject'
import { normalizeTeachingSubject } from '@/lib/lop/normalize-teaching-subject'

export async function GET() {
  const auth = await getUserForAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Server database is not configured.' }, { status: 503 })
  }

  const custom = (await fetchTeachingSubjectsPg()) ?? []
  const extras = await fetchSubjectNameExtrasPg()
  const base = [
    ...listedClassSubjects().map((s) => ({ id: s.id, label: s.labelVi })),
    ...custom
      .filter((row) => !listedClassSubjects().some((s) => s.id === row.id))
      .map((row) => ({ id: row.id, label: row.label })),
  ]
  const items: Array<{ id: string; labelVi: string; labelEn: string; choice: 'original' | 'edited' | null }> = []
  for (const row of base) {
    const label = extras.overrides.get(row.id) || row.label
    const pending = extras.edits.get(row.id)
    if (!label) continue
    items.push({
      id: row.id,
      labelVi: pending?.originalName || label,
      labelEn: pending?.originalName || label,
      choice: pending ? 'original' : null,
    })
    if (pending?.editedName) {
      items.push({
        id: row.id,
        labelVi: pending.editedName,
        labelEn: pending.editedName,
        choice: 'edited',
      })
    }
  }
  return NextResponse.json({ items })
}

export async function POST(req: NextRequest) {
  const auth = await getUserForAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Server database is not configured.' }, { status: 503 })
  }

  const body = await req.json().catch(() => ({}))
  const subjectId = String(body?.subjectId ?? '').trim()
  const choice = body?.choice === 'edited' || body?.choice === 'original' ? (body.choice as NameEditChoice) : null
  if (subjectId && choice) {
    const voted = await voteSubjectName({ subjectId, teacherId: auth.user.id, choice })
    if (!voted.ok) return NextResponse.json({ error: voted.error }, { status: 400 })
    return NextResponse.json({
      success: true,
      subjectId,
      canonicalName: voted.canonicalName,
      resolved: voted.resolved,
    })
  }
  if (subjectId && String(body?.action ?? '') === 'rename') {
    const extras = await fetchSubjectNameExtrasPg()
    const listed = listedClassSubjects().find((item) => item.id === subjectId)
    const custom = (await fetchTeachingSubjectsPg()) ?? []
    const originalName =
      extras.overrides.get(subjectId) ||
      extras.edits.get(subjectId)?.originalName ||
      listed?.labelVi ||
      custom.find((item) => item.id === subjectId)?.label ||
      ''
    if (!originalName) return NextResponse.json({ error: 'Không tìm thấy môn.' }, { status: 404 })
    const proposed = await proposeSubjectNameEdit({
      subjectId,
      teacherId: auth.user.id,
      editedName: String(body?.name ?? ''),
      originalName,
    })
    if (!proposed.ok) return NextResponse.json({ error: proposed.error }, { status: 400 })
    return NextResponse.json({
      success: true,
      subjectId,
      canonicalName: proposed.canonicalName,
      resolved: proposed.resolved,
    })
  }

  const name = String(body?.name ?? '').replace(/\s+/g, ' ').trim()
  const resolved = await normalizeTeachingSubject(name, auth.user.id)
  if (resolved === 'empty') {
    return NextResponse.json({ error: 'Vui lòng gõ tên môn.' }, { status: 400 })
  }
  if (resolved === 'rejected' || resolved === 'failed') {
    return NextResponse.json({ error: 'Không lưu được tên môn. Hãy gõ tên môn rõ hơn.' }, { status: 422 })
  }

  return NextResponse.json({
    item: {
      id: resolved.id,
      labelVi: resolved.label,
      labelEn: resolved.label,
    },
  })
}
