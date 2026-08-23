import { NextRequest, NextResponse } from 'next/server'
import { upsertVisitorProfileHintFromPg } from '@/lib/db/messaging-partner-recommendation-pg'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { resolveSiteVisitorContext } from '@/lib/partner-website/shop/partner-site-personalization'
import { jsonSitePersonalization } from '@/lib/partner-website/shop/partner-site-personalization-response'

export const dynamic = 'force-dynamic'

function parseGender(v: unknown): 'male' | 'female' | null {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : ''
  return s === 'male' || s === 'female' ? s : null
}

/** Guest/login hint — same as 188 `POST /user-behavior/guest-profile-hint`. */
export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = (await request.json().catch(() => null)) as {
    gender?: unknown
    birth_year?: unknown
    birthYear?: unknown
  } | null
  const gender = parseGender(body?.gender)
  const rawYear = Number(body?.birth_year ?? body?.birthYear)
  const birthYear = Number.isFinite(rawYear) && rawYear >= 1900 && rawYear <= 2100 ? Math.floor(rawYear) : null
  if (!gender) {
    return NextResponse.json({ error: 'gender required (male|female)' }, { status: 400 })
  }

  const visitor = await resolveSiteVisitorContext(request, shop.partnerId)
  const ok = await upsertVisitorProfileHintFromPg({
    partnerId: shop.partnerId,
    accountKey: visitor.accountKey,
    gender,
    birthYear,
  })
  if (!ok) {
    return jsonSitePersonalization(
      request,
      { ok: false, error: 'SAVE_FAILED' },
      500,
      { sessionId: visitor.sessionId, thread: visitor.thread }
    )
  }

  return jsonSitePersonalization(
    request,
    { ok: true, hint: { gender, birth_year: birthYear } },
    200,
    { sessionId: visitor.sessionId, thread: visitor.thread }
  )
}
