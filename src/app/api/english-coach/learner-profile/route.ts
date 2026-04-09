import { NextResponse } from 'next/server'
import { isPgConfigured } from '@/lib/db/pool'
import { fetchLearnerProfileFields, updateLearnerProfileFields } from '@/lib/db/profiles-repo'
import { getUserForAction } from '@/lib/auth'

export const dynamic = 'force-dynamic'

type LearnerMeta = {
  full_name?: string
  name?: string
  coach_job?: string
  coach_city?: string
  coach_age?: number | string
  coach_gender?: string
}

function parseGender(v: unknown): 'male' | 'female' | 'other' | null {
  const s = String(v ?? '')
    .trim()
    .toLowerCase()
  if (s === 'male' || s === 'female' || s === 'other') return s
  return null
}

function parseAge(v: unknown): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : Number(String(v).trim())
  if (!Number.isFinite(n)) return null
  const r = Math.round(n)
  if (r < 1 || r > 120) return null
  return r
}

/** GET: full_name + coach fields — ưu tiên cột profiles; metadata chỉ còn tương thích lịch sử. */
export async function GET() {
  try {
    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Cơ sở dữ liệu chưa cấu hình.' }, { status: 503 })
    }
    const auth = await getUserForAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

    const row = await fetchLearnerProfileFields(auth.user.id)

    const um = auth.user.user_metadata as LearnerMeta | undefined
    const metaName = String(um?.full_name || um?.name || '').trim()
    const metaJob = String(um?.coach_job || '').trim()
    const metaCity = String(um?.coach_city || '').trim()
    const metaAge = parseAge(um?.coach_age)
    const metaGender = parseGender(um?.coach_gender)

    const dbName = String(row?.full_name ?? '').trim()
    const dbJob = String(row?.english_coach_job ?? '').trim()
    const dbCity = String(row?.english_coach_city ?? '').trim()
    const dbAge = row?.english_coach_age != null ? parseAge(row.english_coach_age) : null
    const dbGender = parseGender(row?.english_coach_gender)

    return NextResponse.json({
      fullName: dbName || metaName || null,
      coachJob: dbJob || metaJob || null,
      coachCity: dbCity || metaCity || null,
      coachAge: dbAge ?? metaAge,
      coachGender: dbGender ?? metaGender,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

type PatchBody = {
  fullName?: unknown
  coachJob?: unknown
  coachCity?: unknown
  coachAge?: unknown
  coachGender?: unknown
}

/** PATCH: lưu đủ coach fields + full_name (Postgres sau khi xác thực). */
export async function PATCH(request: Request) {
  try {
    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Cơ sở dữ liệu chưa cấu hình.' }, { status: 503 })
    }
    const auth = await getUserForAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

    let body: PatchBody
    try {
      body = (await request.json()) as PatchBody
    } catch {
      return NextResponse.json({ error: 'JSON không hợp lệ.' }, { status: 400 })
    }

    const fullName = String(body.fullName ?? '').trim()
    if (!fullName || fullName.length > 200) {
      return NextResponse.json({ error: 'Tên hiển thị không hợp lệ.' }, { status: 400 })
    }

    const coachJob = String(body.coachJob ?? '').trim().slice(0, 500)
    const coachCity = String(body.coachCity ?? '').trim().slice(0, 500)
    const coachAge = parseAge(body.coachAge)
    if (coachAge == null) {
      return NextResponse.json({ error: 'Tuổi không hợp lệ (1–120).' }, { status: 400 })
    }
    const coachGender = parseGender(body.coachGender)
    if (!coachGender) {
      return NextResponse.json({ error: 'Giới tính phải là male, female hoặc other.' }, { status: 400 })
    }

    const out = await updateLearnerProfileFields(auth.user.id, {
      full_name: fullName,
      english_coach_job: coachJob || null,
      english_coach_city: coachCity || null,
      english_coach_age: coachAge,
      english_coach_gender: coachGender,
    })
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
