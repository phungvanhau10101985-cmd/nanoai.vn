import { NextRequest, NextResponse } from 'next/server'
import {
  fetchBirthdayPromoForPartnerFromPg,
  listBirthdayEligibleUsersForPartnerFromPg,
  listPartnersWithBirthdayPromoEnabledFromPg,
  releaseBirthdayEmailSlotFromPg,
  tryClaimBirthdayEmailSlotFromPg,
} from '@/lib/db/messaging-partner-birthday-promo-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { getPublicAppUrlForServer } from '@/lib/auth/public-app-url'
import {
  birthdayCampaignKey,
  collectInterestInventoryIdsForPartnerUserFromPg,
  daysUntilNextBirthday,
  isInBirthdayOfferWindow,
  nextBirthdayIsoFromProfileYmd,
} from '@/lib/messaging/birthday-promo-interest-inventory-ids'
import { emailCustomerBirthdayPromo } from '@/lib/messaging/email-customer-birthday-promo'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('authorization')?.trim()
  if (!auth?.startsWith('Bearer ')) return false
  const token = auth.slice('Bearer '.length).trim()
  const candidates = new Set<string>()
  const add = (s: string | undefined) => {
    const t = s?.trim()
    if (t) candidates.add(t)
  }
  add(process.env.CRON_SECRET)
  add(process.env.MESSAGING_PARTNER_AI_CRON_SECRET)
  if (candidates.size === 0) return false
  return candidates.has(token)
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  if (!isPgConfigured()) {
    return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503 })
  }

  const partners = await listPartnersWithBirthdayPromoEnabledFromPg()
  if (!partners?.length) {
    return NextResponse.json({ ok: true, sent: 0, partners: 0, message: 'no_enabled_partners' })
  }

  const origin = getPublicAppUrlForServer().replace(/\/$/, '')
  let sent = 0
  let skipped = 0

  for (const p of partners) {
    const promo = await fetchBirthdayPromoForPartnerFromPg(p.partner_id)
    if (!promo?.enabled) continue
    const dMax = promo.offer_days_before_max
    const dMin = promo.offer_days_before_min
    const pct = promo.discount_percent

    const users = await listBirthdayEligibleUsersForPartnerFromPg(p.partner_id)
    if (!users?.length) continue

    for (const u of users) {
      const daysUntil = daysUntilNextBirthday(u.birth_date)
      if (daysUntil == null) {
        skipped += 1
        continue
      }
      // Sale parity 188: offer is active T-7..T0, but marketing email is sent exactly at T-7.
      if (!isInBirthdayOfferWindow(daysUntil, dMax, dMin) || daysUntil !== 7) {
        skipped += 1
        continue
      }
      const nextYmd = nextBirthdayIsoFromProfileYmd(u.birth_date)
      if (!nextYmd) {
        skipped += 1
        continue
      }
      const campaignKey = birthdayCampaignKey(nextYmd)
      const claimed = await tryClaimBirthdayEmailSlotFromPg({
        partnerId: p.partner_id,
        recipientUserId: u.user_id,
        campaignKey,
      })
      if (!claimed) {
        skipped += 1
        continue
      }

      const invIds = await collectInterestInventoryIdsForPartnerUserFromPg({
        partnerId: p.partner_id,
        userId: u.user_id,
        limit: 12,
      })

      const sp = new URLSearchParams()
      if (invIds.length) sp.set('interested_inv', invIds.join(','))
      if (pct > 0) sp.set('bday_discount', String(pct))
      const q = sp.toString()
      const chatUrl = `${origin}/messaging/p/${encodeURIComponent(p.slug)}${q ? `?${q}` : ''}`

      const mail = await emailCustomerBirthdayPromo({
        toEmail: u.email,
        shopDisplayName: p.display_name.trim() || 'Cửa hàng',
        chatUrl,
        discountPercent: pct,
        nextBirthdayLabel: nextYmd,
      })
      if (!mail.ok) {
        await releaseBirthdayEmailSlotFromPg({
          partnerId: p.partner_id,
          recipientUserId: u.user_id,
          campaignKey,
        })
        skipped += 1
        continue
      }
      sent += 1
    }
  }

  return NextResponse.json({
    ok: true,
    sent,
    skipped,
    partners: partners.length,
  })
}
