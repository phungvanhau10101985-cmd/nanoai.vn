import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import {
  deletePartnerCustomerAccountFromPg,
  fetchPartnerCustomerForAdminFromPg,
  setPartnerCustomerActiveFromPg,
} from '@/lib/db/messaging-partner-customers-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function gate(partnerId: string) {
  if (!isPgConfigured()) return { error: NextResponse.json({ error: 'Database not configured' }, { status: 503 }) }
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { error: NextResponse.json({ error: auth.error }, { status: 401 }) }
  const access = await assertPartnerDashboardAccess(auth.user.id, partnerId, 'website_customers')
  if (!access.ok) return { error: NextResponse.json({ error: access.error }, { status: access.status }) }
  return { auth }
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ partnerId: string; accountId: string }> }) {
  const { partnerId, accountId } = await ctx.params
  const pid = partnerId.trim()
  const id = accountId.trim()
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const gated = await gate(pid)
  if ('error' in gated && gated.error) return gated.error
  const member = await fetchPartnerCustomerForAdminFromPg({ partnerId: pid, accountId: id })
  if (!member) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ member })
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ partnerId: string; accountId: string }> }) {
  const { partnerId, accountId } = await ctx.params
  const pid = partnerId.trim()
  const id = accountId.trim()
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const gated = await gate(pid)
  if ('error' in gated && gated.error) return gated.error
  const body = (await req.json().catch(() => null)) as { isActive?: boolean } | null
  if (typeof body?.isActive !== 'boolean') {
    return NextResponse.json({ error: 'isActive' }, { status: 400 })
  }
  const ok = await setPartnerCustomerActiveFromPg({ partnerId: pid, accountId: id, isActive: body.isActive })
  if (!ok) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const member = await fetchPartnerCustomerForAdminFromPg({ partnerId: pid, accountId: id })
  return NextResponse.json({ member })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ partnerId: string; accountId: string }> }) {
  const { partnerId, accountId } = await ctx.params
  const pid = partnerId.trim()
  const id = accountId.trim()
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const gated = await gate(pid)
  if ('error' in gated && gated.error) return gated.error
  const result = await deletePartnerCustomerAccountFromPg({ partnerId: pid, accountId: id })
  if (!result.ok) {
    const status = result.error === 'not_found' ? 404 : 500
    return NextResponse.json({ error: result.error }, { status })
  }
  return NextResponse.json({ ok: true })
}
