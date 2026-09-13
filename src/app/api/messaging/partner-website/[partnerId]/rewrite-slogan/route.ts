import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import { fetchPartnerWebsiteByPartnerIdPg } from '@/lib/db/messaging-partner-websites-pg'
import { normalizeWebLocale, type WebLocale } from '@/lib/i18n/config'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'
import { rewritePartnerShopSloganWithAi } from '@/lib/partner-website/shop/partner-site-shop-slogan-ai'
import {
  partnerShopSloganFromTheme,
  partnerShopSloganProductsFromTheme,
  sanitizePartnerShopSlogan,
  sanitizePartnerShopSloganProducts,
} from '@/lib/partner-website/shop/partner-site-shop-slogan'

export const maxDuration = 30

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ partnerId: string }> }
) {
  const { partnerId } = await ctx.params
  if (!isPgConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'website')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const body = (await req.json().catch(() => ({}))) as {
    mode?: 'rewrite' | 'create'
    currentSlogan?: string
    idea?: string
    products?: string
    locale?: WebLocale
  }
  const website = await fetchPartnerWebsiteByPartnerIdPg(pid)
  const shopName = website?.title?.trim() || 'Shop'
  const currentSlogan =
    sanitizePartnerShopSlogan(body.currentSlogan) || partnerShopSloganFromTheme(website?.theme)
  const idea = sanitizePartnerShopSlogan(body.idea, 240)
  const products =
    sanitizePartnerShopSloganProducts(body.products) ||
    partnerShopSloganProductsFromTheme(website?.theme)
  const mode = body.mode === 'create' || !currentSlogan ? 'create' : 'rewrite'
  if (mode === 'rewrite' && !currentSlogan && !idea) {
    return NextResponse.json({ error: 'slogan or idea required' }, { status: 400 })
  }
  if (mode === 'create' && !products && !idea) {
    return NextResponse.json({ error: 'products required' }, { status: 400 })
  }

  const rewritten = await rewritePartnerShopSloganWithAi({
    mode,
    shopName,
    locale: normalizeWebLocale(body.locale || website?.locale || 'vi') ?? 'vi',
    currentSlogan,
    idea,
    products,
  })
  if (!rewritten) return NextResponse.json({ error: 'AI could not write slogan' }, { status: 502 })
  return NextResponse.json({ success: true, ...rewritten })
}
