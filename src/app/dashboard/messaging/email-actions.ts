'use server'

import { revalidatePath } from 'next/cache'
import { getUserForCreditAction } from '@/lib/auth'
import { isSmtpConfigured } from '@/lib/email/smtp'
import { isPgConfigured } from '@/lib/db/pool'
import { fetchBirthdayPromoForPartnerFromPg } from '@/lib/db/messaging-partner-birthday-promo-pg'
import {
  deactivateNewsletterSubscriberFromPg,
  getPartnerEmailManagementOverviewFromPg,
  importNewsletterEmailsFromPg,
  listActiveNewsletterEmailsFromPg,
  listPartnerNewsletterSubscribersFromPg,
  type PartnerEmailSendChannel,
  updatePartnerEmailSendSettingsFromPg,
} from '@/lib/db/messaging-partner-email-management-pg'
import { resolvePartnerDashboardAccessFromPg } from '@/lib/messaging/partner-dashboard-access'
import { partnerStaffHasPerm } from '@/lib/messaging/partner-staff-permissions'
import { runPartnerBirthdayPromoBatch } from '@/lib/messaging/partner-birthday-promo-batch'
import { isValidPartnerEmail } from '@/lib/messaging/partner-email-normalize'
import {
  resolvePartnerShopEmailContext,
  sendPartnerBirthdayPromoEmail,
  sendPartnerBroadcastEmail,
  sendPartnerCartAbandonEmail,
  sendPartnerComebackEmail,
  sendPartnerNewsletterWelcomeEmail,
} from '@/lib/messaging/partner-promo-email'
import { isValidUuidString } from '@/lib/validate-uuid'

async function requireUser() {
  const result = await getUserForCreditAction()
  if ('error' in result) return { error: result.error }
  return { user: result.user }
}

async function assertEmailHub(userId: string, partnerId: string): Promise<{ ok: true } | { error: string }> {
  if (!isValidUuidString(userId) || !isValidUuidString(partnerId)) return { error: 'Forbidden.' }
  const access = await resolvePartnerDashboardAccessFromPg(userId, partnerId)
  if (access == null) return { error: 'Forbidden.' }
  if (partnerStaffHasPerm(access, 'marketing_campaigns') || partnerStaffHasPerm(access, 'website')) {
    return { ok: true }
  }
  return { error: 'Forbidden.' }
}

function revalidateEmailPaths() {
  revalidatePath('/dashboard/messaging/settings')
}

export async function getPartnerEmailManagementOverviewAction(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const gate = await assertEmailHub(auth.user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }
  const overview = await getPartnerEmailManagementOverviewFromPg(partnerId, isSmtpConfigured())
  if (!overview) return { error: 'unavailable' }
  return { ok: true as const, overview }
}

export async function savePartnerEmailSendSettingsAction(input: {
  partnerId: string
  warmupEnabled: boolean
  startLimit: number
  dailyIncrement: number
  maxLimit: number | null
  birthdayCronEnabled: boolean
  cartAbandonEmailEnabled: boolean
  comebackEmailEnabled: boolean
  newsletterWelcomeEmailEnabled: boolean
}) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const gate = await assertEmailHub(auth.user.id, input.partnerId)
  if ('error' in gate) return { error: gate.error }
  const row = await updatePartnerEmailSendSettingsFromPg({
    partnerId: input.partnerId,
    warmupEnabled: input.warmupEnabled,
    startLimit: input.startLimit,
    dailyIncrement: input.dailyIncrement,
    maxLimit: input.maxLimit,
    birthdayCronEnabled: input.birthdayCronEnabled,
    cartAbandonEmailEnabled: input.cartAbandonEmailEnabled,
    comebackEmailEnabled: input.comebackEmailEnabled,
    newsletterWelcomeEmailEnabled: input.newsletterWelcomeEmailEnabled,
  })
  if (!row) return { error: 'unavailable' }
  revalidateEmailPaths()
  return { ok: true as const }
}

export async function runPartnerBirthdayPromoNowAction(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const gate = await assertEmailHub(auth.user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  if (!isSmtpConfigured()) return { error: 'smtp_not_configured' }
  const result = await runPartnerBirthdayPromoBatch({ partnerId, forceIgnoreCronFlag: true })
  revalidateEmailPaths()
  return { ok: true as const, ...result }
}

export type PartnerPromoTestKind = PartnerEmailSendChannel

export async function sendPartnerPromoTestEmailAction(input: {
  partnerId: string
  toEmail: string
  kind: PartnerPromoTestKind
  subject?: string
  message?: string
}) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const gate = await assertEmailHub(auth.user.id, input.partnerId)
  if ('error' in gate) return { error: gate.error }
  if (!isSmtpConfigured()) return { error: 'smtp_not_configured' }
  const email = input.toEmail.trim().toLowerCase()
  if (!isValidPartnerEmail(email)) return { error: 'invalid_email' }
  const ctx = await resolvePartnerShopEmailContext(input.partnerId)
  if (!ctx) return { error: 'unavailable' }
  const recipientKey = `email:${email}`
  const flags = { skipOptOut: true, skipWarmup: true }
  let sent
  if (input.kind === 'birthday') {
    const promo = await fetchBirthdayPromoForPartnerFromPg(input.partnerId)
    sent = await sendPartnerBirthdayPromoEmail({
      ctx,
      toEmail: email,
      discountPercent: promo?.discount_percent || 10,
      nextBirthdayLabel: new Date().toISOString().slice(0, 10),
      recipientKey,
      ...flags,
    })
  } else if (input.kind === 'cart_abandon') {
    sent = await sendPartnerCartAbandonEmail({
      ctx,
      toEmail: email,
      promoCode: 'TEST-CART',
      discountPercent: 5,
      maxDiscountAmount: 80_000,
      validDays: 3,
      cartItems: [{ name: 'Demo', quantity: 1 }],
      recipientKey,
      ...flags,
    })
  } else if (input.kind === 'comeback') {
    sent = await sendPartnerComebackEmail({
      ctx,
      toEmail: email,
      promoCode: 'TEST-BACK',
      discountPercent: 10,
      maxDiscountAmount: 100_000,
      validDays: 5,
      recipientKey,
      ...flags,
    })
  } else if (input.kind === 'newsletter_welcome') {
    sent = await sendPartnerNewsletterWelcomeEmail({
      ctx,
      toEmail: email,
      recipientKey,
      skipWarmup: true,
    })
  } else {
    sent = await sendPartnerBroadcastEmail({
      ctx,
      toEmail: email,
      subject: input.subject?.trim() || ctx.shopDisplayName,
      message: input.message?.trim() || ctx.shopDisplayName,
      recipientKey,
      ...flags,
    })
  }
  if (!sent.ok) return { error: sent.error }
  revalidateEmailPaths()
  return { ok: true as const }
}

export async function listPartnerNewsletterSubscribersAction(input: {
  partnerId: string
  q?: string
  activeOnly?: boolean | null
  skip?: number
  limit?: number
}) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const gate = await assertEmailHub(auth.user.id, input.partnerId)
  if ('error' in gate) return { error: gate.error }
  const data = await listPartnerNewsletterSubscribersFromPg(input)
  return { ok: true as const, ...data }
}

export async function importPartnerNewsletterEmailsAction(input: {
  partnerId: string
  text?: string
  lines?: string[]
}) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const gate = await assertEmailHub(auth.user.id, input.partnerId)
  if ('error' in gate) return { error: gate.error }
  const raw = input.lines?.length
    ? input.lines
    : String(input.text || '')
        .split(/\r?\n/)
        .map((l) => l.trim())
  const result = await importNewsletterEmailsFromPg({
    partnerId: input.partnerId,
    lines: raw,
    source: 'import',
  })
  revalidateEmailPaths()
  return { ok: true as const, result }
}

export async function exportPartnerNewsletterCsvAction(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const gate = await assertEmailHub(auth.user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  const emails = await listActiveNewsletterEmailsFromPg(partnerId, 20_000)
  const csv = ['email', ...emails].join('\n')
  return { ok: true as const, csv, count: emails.length }
}

export async function deactivatePartnerNewsletterSubscriberAction(input: {
  partnerId: string
  email: string
}) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const gate = await assertEmailHub(auth.user.id, input.partnerId)
  if ('error' in gate) return { error: gate.error }
  await deactivateNewsletterSubscriberFromPg(input)
  revalidateEmailPaths()
  return { ok: true as const }
}

export async function sendPartnerNewsletterBroadcastAction(input: {
  partnerId: string
  subject: string
  message: string
}) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const gate = await assertEmailHub(auth.user.id, input.partnerId)
  if ('error' in gate) return { error: gate.error }
  if (!isSmtpConfigured()) return { error: 'smtp_not_configured' }
  const subject = input.subject.trim()
  const message = input.message.trim()
  if (!subject || !message) return { error: 'invalid_email' }
  const ctx = await resolvePartnerShopEmailContext(input.partnerId)
  if (!ctx) return { error: 'unavailable' }
  const emails = await listActiveNewsletterEmailsFromPg(input.partnerId, 20_000)
  let sent = 0
  let skipped = 0
  let failed = 0
  for (const email of emails) {
    const res = await sendPartnerBroadcastEmail({
      ctx,
      toEmail: email,
      subject,
      message,
      recipientKey: `email:${email}`,
    })
    if (res.ok) sent += 1
    else if (res.error === 'warmup_quota') {
      skipped += emails.length - sent - failed - skipped
      break
    } else if (res.error === 'opt_out') skipped += 1
    else failed += 1
  }
  revalidateEmailPaths()
  return { ok: true as const, sent, skipped, failed, total: emails.length }
}
