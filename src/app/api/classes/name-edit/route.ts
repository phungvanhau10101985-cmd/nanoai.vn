import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { proposeClassNameEdit, voteClassName, type NameEditChoice } from '@/lib/db/name-edit-votes'
import { isPgConfigured } from '@/lib/db/pool'

export async function POST(req: NextRequest) {
  const auth = await getUserForAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Server database is not configured.' }, { status: 503 })
  }

  const body = await req.json().catch(() => ({}))
  const classId = String(body?.classId ?? '').trim()
  if (!classId) return NextResponse.json({ error: 'Thiếu lớp.' }, { status: 400 })

  const choice = body?.choice === 'edited' || body?.choice === 'original' ? (body.choice as NameEditChoice) : null
  if (choice) {
    const voted = await voteClassName({ classId, teacherId: auth.user.id, choice })
    if (!voted.ok) return NextResponse.json({ error: voted.error }, { status: 400 })
    return NextResponse.json({
      success: true,
      classId,
      canonicalName: voted.canonicalName,
      resolved: voted.resolved,
    })
  }

  const name = String(body?.name ?? '').replace(/\s+/g, ' ').trim()
  const proposed = await proposeClassNameEdit({ classId, teacherId: auth.user.id, editedName: name })
  if (!proposed.ok) return NextResponse.json({ error: proposed.error }, { status: 400 })
  return NextResponse.json({
    success: true,
    classId,
    canonicalName: proposed.canonicalName,
    resolved: proposed.resolved,
  })
}
