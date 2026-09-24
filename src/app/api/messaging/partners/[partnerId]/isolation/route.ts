import { NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import {
  loadPartnerIsolationFactsFromPg,
  savePartnerIsolationAckFromPg,
} from '@/lib/db/messaging-partner-isolation-pg'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'
import {
  buildPartnerIsolationChecklist,
  isPartnerIsolationAckId,
  partnerIsolationProgress,
} from '@/lib/partner-website/shop/partner-shop-isolation'

export const dynamic = 'force-dynamic'

async function authorize(partnerId: string) {
  if (!isPgConfigured()) {
    return { error: NextResponse.json({ ok: false, error: 'Database not configured' }, { status: 503 }) }
  }
  const auth = await getUserForCreditAction()
  if ('error' in auth) {
    return { error: NextResponse.json({ ok: false, error: auth.error }, { status: 401 }) }
  }
  const access = await assertPartnerDashboardAccess(auth.user.id, partnerId)
  if (!access.ok) {
    return { error: NextResponse.json({ ok: false, error: access.error }, { status: access.status }) }
  }
  return { ok: true as const }
}

export async function GET(_request: Request, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const gate = await authorize(partnerId)
  if ('error' in gate && gate.error) return gate.error
  const facts = await loadPartnerIsolationFactsFromPg(partnerId)
  if (!facts) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  const items = buildPartnerIsolationChecklist(facts)
  return NextResponse.json({
    ok: true,
    items,
    ...partnerIsolationProgress(items),
  })
}

export async function PATCH(request: Request, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const gate = await authorize(partnerId)
  if ('error' in gate && gate.error) return gate.error
  const body = (await request.json().catch(() => null)) as { id?: unknown; done?: unknown } | null
  const id = String(body?.id || '').trim()
  if (!isPartnerIsolationAckId(id) || typeof body?.done !== 'boolean') {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 })
  }
  try {
    const saved = await savePartnerIsolationAckFromPg(partnerId, id, body.done)
    if (!saved) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  } catch (error) {
    console.warn('[isolation PATCH]', error)
    return NextResponse.json({ ok: false, error: 'save_failed' }, { status: 503 })
  }
  const facts = await loadPartnerIsolationFactsFromPg(partnerId)
  if (!facts) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  const items = buildPartnerIsolationChecklist(facts)
  return NextResponse.json({
    ok: true,
    items,
    ...partnerIsolationProgress(items),
  })
}
