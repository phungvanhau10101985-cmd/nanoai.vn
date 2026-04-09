import { NextResponse } from 'next/server'
import { isPgConfigured } from '@/lib/db/pool'
import { fetchProfileGender, updateProfileGender } from '@/lib/db/profiles-repo'
import { getUserForAction } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/** GET: giới tính trong `public.profiles` (Postgres). */
export async function GET() {
  try {
    const auth = await getUserForAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Server database is not configured.' }, { status: 503 })
    }
    const gender = await fetchProfileGender(auth.user.id)
    return NextResponse.json({ gender })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/** PATCH: { "gender": "male" | "female" } */
export async function PATCH(request: Request) {
  try {
    const auth = await getUserForAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Server database is not configured.' }, { status: 503 })
    }
    let body: { gender?: unknown }
    try {
      body = (await request.json()) as { gender?: unknown }
    } catch {
      return NextResponse.json({ error: 'JSON không hợp lệ.' }, { status: 400 })
    }
    const g = String(body.gender ?? '').toLowerCase()
    if (g !== 'male' && g !== 'female') {
      return NextResponse.json({ error: 'gender phải là male hoặc female.' }, { status: 400 })
    }
    const out = await updateProfileGender(auth.user.id, g)
    if (!out.ok) {
      const status = out.error === 'profile_not_found' ? 404 : 500
      return NextResponse.json({ error: out.error }, { status })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
