import { NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import { fetchTeacherIdentity, saveTeacherIdentity } from '@/lib/db/teacher-identity-pg'
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
  const { locale } = getServerDictionary()
  const identity = await fetchTeacherIdentity(auth.user.id, locale)
  return NextResponse.json(identity)
}

export async function PATCH(request: Request) {
  const auth = await getUserForAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Server database is not configured.' }, { status: 503 })
  }
  const { locale, t } = getServerDictionary()
  let body: { fullName?: unknown; gender?: unknown }
  try {
    body = (await request.json()) as { fullName?: unknown; gender?: unknown }
  } catch {
    return NextResponse.json({ error: 'JSON không hợp lệ.' }, { status: 400 })
  }
  const gender = parseTeacherGender(String(body.gender ?? ''))
  if (!gender) {
    return NextResponse.json({ error: t.classes.teacherIdentityRequired }, { status: 400 })
  }
  const saved = await saveTeacherIdentity({
    userId: auth.user.id,
    fullName: String(body.fullName ?? ''),
    gender,
    locale,
  })
  if (!saved.ok) {
    const message = saved.error === 'name_required' ? t.classes.teacherIdentityRequired : saved.error
    return NextResponse.json({ error: message }, { status: 400 })
  }
  revalidatePath('/lop')
  return NextResponse.json({ ok: true, publicName: saved.publicName })
}
