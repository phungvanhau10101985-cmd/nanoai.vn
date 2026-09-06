import {
  fetchBirthdayPromoForPartnerFromPg,
  listBirthdayEligibleUsersForPartnerFromPg,
  listPartnersWithBirthdayPromoEnabledFromPg,
  releaseBirthdayEmailSlotFromPg,
  tryClaimBirthdayEmailSlotFromPg,
} from '@/lib/db/messaging-partner-birthday-promo-pg'
import { fetchPartnerEmailSendSettingsFromPg } from '@/lib/db/messaging-partner-email-management-pg'
import {
  birthdayCampaignKey,
  daysUntilNextBirthday,
  isInBirthdayOfferWindow,
  nextBirthdayIsoFromProfileYmd,
} from '@/lib/messaging/birthday-promo-interest-inventory-ids'
import { sendPartnerBirthdayPromoEmail } from '@/lib/messaging/partner-promo-email'
import { resolvePartnerShopEmailContext } from '@/lib/messaging/partner-shop-email-context'

export type BirthdayPromoBatchResult = {
  partners: number
  sent: number
  skipped: number
  deferredQuota: number
}

export async function runPartnerBirthdayPromoBatchForPartner(
  partnerId: string,
  opts?: { force?: boolean }
): Promise<{ sent: number; skipped: number; deferredQuota: number }> {
  const settings = await fetchPartnerEmailSendSettingsFromPg(partnerId)
  if (!opts?.force && settings && settings.birthday_cron_enabled === false) {
    return { sent: 0, skipped: 0, deferredQuota: 0 }
  }
  const promo = await fetchBirthdayPromoForPartnerFromPg(partnerId)
  if (!promo?.enabled) return { sent: 0, skipped: 0, deferredQuota: 0 }
  const users = await listBirthdayEligibleUsersForPartnerFromPg(partnerId)
  if (!users?.length) return { sent: 0, skipped: 0, deferredQuota: 0 }

  const ctx = await resolvePartnerShopEmailContext(partnerId)
  let sent = 0
  let skipped = 0
  let deferredQuota = 0
  const dMax = promo.offer_days_before_max
  const dMin = promo.offer_days_before_min
  const pct = promo.discount_percent

  for (const u of users) {
    const daysUntil = daysUntilNextBirthday(u.birth_date)
    if (daysUntil == null) {
      skipped += 1
      continue
    }
    if (!opts?.force && (!isInBirthdayOfferWindow(daysUntil, dMax, dMin) || daysUntil !== 7)) {
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
      partnerId,
      recipientKey: u.recipient_key,
      campaignKey,
      recipientEmail: u.email,
      recipientUserId: u.user_id || undefined,
    })
    if (!claimed) {
      skipped += 1
      continue
    }
    const mail = await sendPartnerBirthdayPromoEmail({
      ctx,
      toEmail: u.email,
      recipientKey: u.recipient_key,
      customerName: u.customer_name,
      discountPercent: pct,
      nextBirthdayLabel: nextYmd,
      campaignKey,
    })
    if (!mail.ok) {
      await releaseBirthdayEmailSlotFromPg({
        partnerId,
        recipientKey: u.recipient_key,
        campaignKey,
      })
      if (mail.error === 'warmup_quota') deferredQuota += 1
      else skipped += 1
      continue
    }
    sent += 1
  }
  return { sent, skipped, deferredQuota }
}

export async function runPartnerBirthdayPromoBatchAll(): Promise<BirthdayPromoBatchResult> {
  const partners = await listPartnersWithBirthdayPromoEnabledFromPg()
  if (!partners?.length) return { partners: 0, sent: 0, skipped: 0, deferredQuota: 0 }
  let sent = 0
  let skipped = 0
  let deferredQuota = 0
  for (const p of partners) {
    const one = await runPartnerBirthdayPromoBatchForPartner(p.partner_id)
    sent += one.sent
    skipped += one.skipped
    deferredQuota += one.deferredQuota
  }
  return { partners: partners.length, sent, skipped, deferredQuota }
}

export async function runPartnerBirthdayPromoBatch(input?: {
  partnerId?: string
  forceIgnoreCronFlag?: boolean
}): Promise<BirthdayPromoBatchResult> {
  if (input?.partnerId) {
    const one = await runPartnerBirthdayPromoBatchForPartner(input.partnerId, {
      force: input.forceIgnoreCronFlag,
    })
    return { partners: 1, ...one }
  }
  return runPartnerBirthdayPromoBatchAll()
}
