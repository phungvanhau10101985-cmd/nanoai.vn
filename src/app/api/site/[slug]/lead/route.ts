import { NextRequest, NextResponse } from 'next/server'
import {
  fetchPublishedWebsitePartnerIdBySlugPg,
  insertPartnerWebsiteLeadPg,
} from '@/lib/db/partner-website-leads-pg'
import { emitPartnerOutboundLeadCreated } from '@/lib/messaging/partner-outbound-webhook-emit'

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params
    const site = await fetchPublishedWebsitePartnerIdBySlugPg(slug)
    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 })
    }

    const body = (await req.json()) as {
      name?: string
      phone?: string
      email?: string
      message?: string
    }

    const name = String(body.name ?? '').trim()
    if (name.length < 1) {
      return NextResponse.json({ error: 'Name required' }, { status: 400 })
    }

    const saved = await insertPartnerWebsiteLeadPg({
      partnerId: site.partnerId,
      siteSlug: site.siteSlug,
      name,
      phone: String(body.phone ?? '').trim(),
      email: String(body.email ?? '').trim(),
      message: String(body.message ?? '').trim(),
    })

    if (!saved) {
      return NextResponse.json({ error: 'Could not save lead' }, { status: 500 })
    }

    emitPartnerOutboundLeadCreated(site.partnerId, saved)

    return NextResponse.json({ success: true, id: saved.id })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
