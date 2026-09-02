import { NextRequest, NextResponse } from 'next/server'
import { resolvePartnerShopAdminAccessByEmail } from '@/lib/messaging/partner-staff-shop-admin-access'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import {
  getSiteVisitorProfile,
  resolveSiteVisitorContext,
  resolveSiteVisitorEmail,
  saveSiteVisitorProfile,
} from '@/lib/partner-website/shop/partner-site-personalization'
import {
  parseIsoDateOfBirth,
  parsePartnerShopGender,
} from '@/lib/partner-website/shop/partner-site-profile-demographics'
import { jsonSitePersonalization } from '@/lib/partner-website/shop/partner-site-personalization-response'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const visitor = await resolveSiteVisitorContext(request, shop.partnerId)
  const email = await resolveSiteVisitorEmail(request, shop.partnerId, visitor.thread)
  const [profile, shopAdmin] = await Promise.all([
    getSiteVisitorProfile({
      partnerId: shop.partnerId,
      accountKey: visitor.accountKey,
      thread: visitor.thread,
      email,
    }),
    email
      ? resolvePartnerShopAdminAccessByEmail({
          partnerId: shop.partnerId,
          email,
          industryKey: shop.industryKey,
        })
      : Promise.resolve(null),
  ])

  return jsonSitePersonalization(
    request,
    {
      ok: true,
      profile,
      shopAdmin: shopAdmin ? { href: shopAdmin.href, role: shopAdmin.role } : null,
    },
    200,
    { sessionId: visitor.sessionId, thread: visitor.thread }
  )
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const visitor = await resolveSiteVisitorContext(request, shop.partnerId)
  const email = await resolveSiteVisitorEmail(request, shop.partnerId, visitor.thread)
  if (!email) {
    return jsonSitePersonalization(
      request,
      { ok: false, error: 'AUTH_REQUIRED', requireAuth: true },
      401,
      { sessionId: visitor.sessionId, thread: visitor.thread }
    )
  }

  const body = (await request.json().catch(() => null)) as
    | {
        customer_name?: unknown
        customer_phone?: unknown
        shipping_address?: unknown
        gender?: unknown
        date_of_birth?: unknown
      }
    | null

  const patch: {
    customerName?: string
    customerPhone?: string
    shippingAddress?: string
    gender?: ReturnType<typeof parsePartnerShopGender>
    dateOfBirth?: string | null
  } = {}
  if (body && 'customer_name' in body) {
    patch.customerName = String(body.customer_name ?? '').trim().slice(0, 180)
  }
  if (body && 'customer_phone' in body) {
    patch.customerPhone = String(body.customer_phone ?? '').trim().slice(0, 40)
  }
  if (body && 'shipping_address' in body) {
    patch.shippingAddress = String(body.shipping_address ?? '').trim().slice(0, 500)
  }
  if (body && 'gender' in body) {
    patch.gender = parsePartnerShopGender(body.gender)
  }
  if (body && 'date_of_birth' in body) {
    const raw = String(body.date_of_birth ?? '').trim()
    patch.dateOfBirth = raw ? parseIsoDateOfBirth(raw) : null
    if (raw && !patch.dateOfBirth) {
      return jsonSitePersonalization(
        request,
        { ok: false, error: 'DOB_INVALID' },
        400,
        { sessionId: visitor.sessionId, thread: visitor.thread }
      )
    }
  }

  const saved = await saveSiteVisitorProfile({
    partnerId: shop.partnerId,
    emailNormalized: email,
    emailRaw: email,
    accountKey: visitor.accountKey,
    linkedUserId: visitor.thread.linkedUserId,
    ...patch,
  })
  if (!saved.ok) {
    const status = saved.error === 'SAVE_FAILED' ? 500 : 400
    return jsonSitePersonalization(
      request,
      { ok: false, error: saved.error ?? 'SAVE_FAILED' },
      status,
      { sessionId: visitor.sessionId, thread: visitor.thread }
    )
  }

  const profile = await getSiteVisitorProfile({
    partnerId: shop.partnerId,
    accountKey: visitor.accountKey,
    thread: visitor.thread,
    email,
  })

  return jsonSitePersonalization(
    request,
    { ok: true, profile },
    200,
    { sessionId: visitor.sessionId, thread: visitor.thread }
  )
}
