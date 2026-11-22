import { NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import { fetchStudentIdentity, saveStudentIdentity } from '@/lib/db/student-identity-pg'
import { getServerDictionary } from '@/lib/i18n/server'
import { parseTeacherGender } from '@/lib/lop/teacher-public-name'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await getUserForAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Server database is not configured.' }, { status: 503 })
  }
  const identity = await fetchStudentIdentity(auth.user.id)
  return NextResponse.json(identity)
}

export async function PATCH(request: Request) {
  const auth = await getUserForAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Server database is not configured.' }, { status: 503 })
  }
  const { t } = getServerDictionary()
  let body: { fullName?: unknown; gender?: unknown; birthDate?: unknown; studentCode?: unknown }
  try {
    body = (await request.json()) as { fullName?: unknown; gender?: unknown; birthDate?: unknown; studentCode?: unknown }
  } catch {
    return NextResponse.json({ error: 'JSON không hợp lệ.' }, { status: 400 })
  }
  const gender = parseTeacherGender(String(body.gender ?? ''))
  if (!gender) {
    return NextResponse.json({ error: t.classes.studentIdentityRequired }, { status: 400 })
  }
  const saved = await saveStudentIdentity({
    userId: auth.user.id,
    fullName: String(body.fullName ?? ''),
    gender,
    birthDate: String(body.birthDate ?? ''),
    studentCode: String(body.studentCode ?? ''),
  })
  if (!saved.ok) {
    const message =
      saved.error === 'name_required' || saved.error === 'birth_required' || saved.error === 'code_required'
        ? t.classes.studentIdentityRequired
        : saved.error === 'code_taken'
          ? t.classes.rosterCodeTaken
          : saved.error === 'schema'
            ? t.classes.rosterSchemaMissing
            : saved.error
    return NextResponse.json({ error: message }, { status: 400 })
  }
  revalidatePath('/lop')
  return NextResponse.json({
    ok: true,
    givenName: saved.givenName,
    birthDate: saved.birthDate,
    gender: saved.gender,
    studentCode: saved.studentCode,
    complete: true,
  })
}
