import { NextRequest, NextResponse } from 'next/server'
import {
  guardPartnerCatalogApi,
  headlessPersonalizationCorsHeaders,
  jsonHeadlessPersonalizationWithCors,
} from '@/lib/messaging/partner-catalog-api-guard'
import { headlessCustomerRefFromRequest } from '@/lib/messaging/partner-headless-cart-utils'
import {
  headlessPersonalizationAccountKey,
  parsePersonalizationUtm,
  saveSiteVisitorUtmContext,
  trackSitePersonalizationEventDetailed,
} from '@/lib/partner-website/shop/partner-site-personalization'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function gateToResponse(req: Request, gate: NextResponse) {
  let body: unknown
  try {
    body = await gate.json()
  } catch {
    body = { error: 'Request rejected.' }
  }
  return jsonHeadlessPersonalizationWithCors(req, body, gate.status)
}

export async function OPTIONS(req: Request) {
  const h = new Headers(headlessPersonalizationCorsHeaders(req))
  h.set('Access-Control-Max-Age', '86400')
  return new NextResponse(null, { status: 204, headers: h })
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const gate = await guardPartnerCatalogApi(req, partnerId)
  if (gate) return gateToResponse(req, gate)

  const body = (await req.json().catch(() => null)) as {
    customer_ref?: string
    event?: string
    inventory_id?: string
    inventory_ids?: unknown
    utm_source?: string
    utm_medium?: string
    utm_campaign?: string
    utm_content?: string
    utm_term?: string
  } | null

  const customerRef = headlessCustomerRefFromRequest(req, req.nextUrl) ?? body?.customer_ref?.trim() ?? ''
  const parsedRef = customerRef.match(/^[a-zA-Z0-9._-]{1,120}$/) ? customerRef : null
  if (!parsedRef) {
    return jsonHeadlessPersonalizationWithCors(
      req,
      { error: 'customer_ref required (body, query, or X-Customer-Ref).' },
      400
    )
  }

  const accountKey = headlessPersonalizationAccountKey(parsedRef)
  const event = String(body?.event ?? '').trim().toLowerCase()

  if (event === 'utm_context') {
    const utm = parsePersonalizationUtm(body)
    if (!utm.utm_source && !utm.utm_medium && !utm.utm_campaign && !utm.utm_content && !utm.utm_term) {
      return jsonHeadlessPersonalizationWithCors(req, { error: 'At least one UTM field required.' }, 400)
    }
    const saved = await saveSiteVisitorUtmContext({ partnerId, accountKey, utm })
    if (!saved) return jsonHeadlessPersonalizationWithCors(req, { error: 'Could not save context.' }, 500)
    return jsonHeadlessPersonalizationWithCors(req, { ok: true, customer_ref: parsedRef, utm: saved }, 200)
  }

  if (!event) {
    return jsonHeadlessPersonalizationWithCors(req, { error: 'event required.' }, 400)
  }

  const inventoryId = String(body?.inventory_id ?? '').trim()
  const inventoryIds = Array.isArray(body?.inventory_ids)
    ? body!.inventory_ids
        .filter((x): x is string => typeof x === 'string' && UUID_RE.test(x.trim()))
        .map((x) => x.trim())
        .slice(0, 24)
    : undefined

  const result = await trackSitePersonalizationEventDetailed({
    partnerId,
    accountKey,
    event,
    inventoryId: UUID_RE.test(inventoryId) ? inventoryId : undefined,
    inventoryIds,
  })

  return jsonHeadlessPersonalizationWithCors(
    req,
    {
      ok: result.ok,
      customer_ref: parsedRef,
      ...(typeof result.is_favorite === 'boolean' ? { is_favorite: result.is_favorite } : {}),
    },
    result.ok ? 200 : 400
  )
}
