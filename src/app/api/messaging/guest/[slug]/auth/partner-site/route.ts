import { NextRequest, NextResponse } from 'next/server'
import { resolveFashionMessagingPartnerBySlug } from '@/lib/messaging/resolve-active-messaging-partner'
import {
  applyPartnerSiteCustomerAuthCookies,
  authenticatePartnerSiteCustomer,
} from '@/lib/messaging/partner-site-customer-auth'
import {
  getClientIpFromRequest,
  getRateLimitRetryAfterSec,
  isRateLimited,
} from '@/lib/api/simple-ip-rate-limit'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const RATE_MAX = Math.max(10, parseInt(process.env.PARTNER_SITE_AUTH_RATE_LIMIT_MAX || '40', 10) || 40)
const RATE_WINDOW_MS = Math.max(
  10_000,
  parseInt(process.env.PARTNER_SITE_AUTH_RATE_LIMIT_WINDOW_MS || '600000', 10) || 600_000
)

async function resolvePartner(slug: string) {
  const active = await resolveFashionMessagingPartnerBySlug(slug)
  if (!active) return { error: 'not_found' as const }
  return { partnerId: active.id, embedKey: active.embed_key }
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const p = await resolvePartner(slug)
  if ('error' in p) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { partnerId, embedKey } = p

  const ip = getClientIpFromRequest(request)
  const rlKey = `partner-site-auth:${partnerId}:${ip}`
  if (isRateLimited(rlKey, RATE_MAX, RATE_WINDOW_MS)) {
    const retry = getRateLimitRetryAfterSec(rlKey)
    return NextResponse.json(
      { error: 'Too many requests. Try again later.', retry_after_sec: retry },
      { status: 429, headers: { 'Retry-After': String(retry) } }
    )
  }

  const body = (await request.json().catch(() => null)) as { token?: string } | null
  const token = String(body?.token ?? '').trim()
  if (!token) return NextResponse.json({ error: 'INVALID_TOKEN' }, { status: 400 })

  const result = await authenticatePartnerSiteCustomer({
    partnerId,
    embedKey,
    request,
    tokenRaw: token,
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  const res = NextResponse.json({
    ok: true,
    accountId: result.accountId,
    emailSessionIssued: result.emailSessionIssued,
  })
  applyPartnerSiteCustomerAuthCookies(res, request, result)
  return res
}
