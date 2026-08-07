import { NextRequest, NextResponse } from 'next/server'
import { insertPartnerWebsiteLeadPg } from '@/lib/db/partner-website-leads-pg'
import { fetchPartnerWebsiteByPartnerIdPg } from '@/lib/db/messaging-partner-websites-pg'
import { emitPartnerOutboundLeadCreated } from '@/lib/messaging/partner-outbound-webhook-emit'
import { guardPartnerInventorySearchApi } from '@/lib/messaging/partner-inventory-search-api-guard'
import {
  headlessWriteCorsHeaders,
  jsonHeadlessWriteWithCors,
} from '@/lib/messaging/partner-catalog-api-guard'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function gateToWriteResponse(req: Request, gate: NextResponse) {
  let body: unknown
  try {
    body = await gate.json()
  } catch {
    body = { error: 'Request rejected.' }
  }
  return jsonHeadlessWriteWithCors(req, body, gate.status)
}

export async function OPTIONS(req: Request) {
  const h = new Headers(headlessWriteCorsHeaders(req))
  h.set('Access-Control-Max-Age', '86400')
  return new NextResponse(null, { status: 204, headers: h })
}

/**
 * POST lead — form liên hệ headless (Bearer, CORS).
 * Body JSON: name (required), phone?, email?, message?, site_slug? (default: slug site đã publish).
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const gate = await guardPartnerInventorySearchApi(req, partnerId, 'leads')
  if (gate) return gateToWriteResponse(req, gate)

  let body: {
    name?: string
    phone?: string
    email?: string
    message?: string
    site_slug?: string
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return jsonHeadlessWriteWithCors(req, { error: 'Invalid JSON body.' }, 400)
  }

  const name = String(body.name ?? '').trim()
  if (name.length < 1) {
    return jsonHeadlessWriteWithCors(req, { error: 'Name required.' }, 400)
  }

  const website = await fetchPartnerWebsiteByPartnerIdPg(partnerId)
  const siteSlugFromBody = String(body.site_slug ?? '').trim().toLowerCase()
  const siteSlug =
    siteSlugFromBody ||
    (website?.isPublished && website.siteSlug?.trim()
      ? website.siteSlug.trim().toLowerCase()
      : '')

  if (!siteSlug) {
    return jsonHeadlessWriteWithCors(
      req,
      { error: 'site_slug required (no published site slug for this partner).' },
      400
    )
  }

  const saved = await insertPartnerWebsiteLeadPg({
    partnerId,
    siteSlug,
    name,
    phone: String(body.phone ?? '').trim(),
    email: String(body.email ?? '').trim(),
    message: String(body.message ?? '').trim(),
  })

  if (!saved) {
    return jsonHeadlessWriteWithCors(req, { error: 'Could not save lead.' }, 500)
  }

  emitPartnerOutboundLeadCreated(partnerId, saved)

  return jsonHeadlessWriteWithCors(
    req,
    {
      ok: true,
      id: saved.id,
      site_slug: saved.siteSlug,
      status: saved.status,
    },
    200
  )
}
