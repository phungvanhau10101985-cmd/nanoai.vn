import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import {
  countOpenTutoringClasses,
  purchaseTutoringPackage,
  readTutoringPackage,
  tutoringTeacherGrace,
} from '@/lib/db/tutoring-package-pg'
import { TUTORING_PACKAGE_PLANS, parseTutoringSlots } from '@/lib/lop/tutoring-package'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await getUserForAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
  if (!isPgConfigured()) return NextResponse.json({ error: 'Cấu hình máy chủ thiếu DATABASE_URL.' }, { status: 503 })
  const grace = await tutoringTeacherGrace(auth.user.id)
  const pack = await readTutoringPackage(auth.user.id)
  const classCount = await countOpenTutoringClasses(auth.user.id)
  return NextResponse.json({
    ok: true,
    phase: grace.phase,
    daysLeft: grace.daysLeft,
    slots: grace.slots,
    classCount,
    accessEndsAt: pack?.accessEndsAt.toISOString() ?? null,
    plans: TUTORING_PACKAGE_PLANS,
  })
}

export async function POST(request: NextRequest) {
  const auth = await getUserForAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
  if (!isPgConfigured()) return NextResponse.json({ error: 'Cấu hình máy chủ thiếu DATABASE_URL.' }, { status: 503 })
  const body = (await request.json().catch(() => ({}))) as { plan?: string; slots?: unknown }
  const slots = parseTutoringSlots(body.slots)
  if (!slots) return NextResponse.json({ error: 'Số lớp phải từ 1 đến 30.' }, { status: 400 })
  const bought = await purchaseTutoringPackage({
    userId: auth.user.id,
    planId: String(body.plan ?? ''),
    slots,
  })
  if (!bought.ok) {
    if (bought.error === 'insufficient_credits') {
      return NextResponse.json(
        { error: 'insufficient_credits', credits: bought.credits, priceVnd: bought.priceVnd, code: 'INSUFFICIENT_CREDITS' },
        { status: 402 }
      )
    }
    if (bought.error === 'slots_below_classes') {
      return NextResponse.json(
        { error: 'slots_below_classes', credits: bought.credits, priceVnd: bought.priceVnd },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: bought.error || 'Không mua được gói.' }, { status: 400 })
  }
  return NextResponse.json({ ...bought, ok: true })
}
