import { isSmtpConfigured, sendSmtpMail } from '@/lib/email/smtp'
import { getPublicAppUrlForServer } from '@/lib/auth/public-app-url'
import { fetchMessagingPartnersByIdsFromPg } from '@/lib/db/messaging-partners-pg'
import { fetchPartnerWebsiteByPartnerIdPg } from '@/lib/db/messaging-partner-websites-pg'
import { hasMarketingOptOutFromPg } from '@/lib/db/messaging-partner-marketing-campaigns-pg'
import {
  fetchGuestEmailForNotificationFromPg,
  incrementPartnerNotificationBroadcastEmailSentFromPg,
  markPartnerCustomerNotificationEmailStatusFromPg,
  type PartnerCustomerNotificationRow,
} from '@/lib/db/messaging-partner-customer-notifications-pg'
import { buildMarketingOptOutUrl } from '@/lib/messaging/marketing-opt-out-token'
import { resolvePartnerWebsitePublicUrl } from '@/lib/partner-website/resolve-partner-website-public-url'
import { partnerWebsitePublicPath } from '@/lib/partner-website/partner-website-slug'
import { partnerSiteAccountTabPath } from '@/lib/partner-website/shop/partner-site-shop-paths'

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim().toLowerCase())
}

export async function resolveShopNotificationCenterUrl(partnerId: string): Promise<string> {
  const website = await fetchPartnerWebsiteByPartnerIdPg(partnerId)
  const siteSlug = website?.siteSlug?.trim() ?? ''
  if (!siteSlug) {
    const origin = getPublicAppUrlForServer().replace(/\/$/, '')
    return `${origin}/account/notifications`
  }
  const publicUrl = await resolvePartnerWebsitePublicUrl({
    partnerId,
    siteSlug,
    isPublished: Boolean(website?.isPublished),
  })
  const base =
    publicUrl?.replace(/\/$/, '') ||
    `${getPublicAppUrlForServer().replace(/\/$/, '')}${partnerWebsitePublicPath(siteSlug)}`
  const path = partnerSiteAccountTabPath(siteSlug, 'notifications')
  if (publicUrl) {
    return `${base}/account/notifications`
  }
  return `${getPublicAppUrlForServer().replace(/\/$/, '')}${path}`
}

export async function sendPartnerCustomerNotificationEmail(input: {
  partnerId: string
  guestAccountId: string
  title: string
  body: string
  href?: string
  email?: string | null
}): Promise<{ status: 'sent' | 'skipped' | 'failed'; reason?: string }> {
  if (!isSmtpConfigured()) return { status: 'skipped', reason: 'smtp_off' }

  const email =
    input.email?.trim().toLowerCase() ||
    (await fetchGuestEmailForNotificationFromPg({
      partnerId: input.partnerId,
      guestAccountId: input.guestAccountId,
    }))
  if (!email || !isValidEmail(email)) return { status: 'skipped', reason: 'no_email' }

  const recipientKey = `guest:${input.guestAccountId}`
  const optedOut = await hasMarketingOptOutFromPg({
    partnerId: input.partnerId,
    recipientKey,
    email,
  })
  if (optedOut) return { status: 'skipped', reason: 'opt_out' }

  const partners = await fetchMessagingPartnersByIdsFromPg([input.partnerId])
  const shopName = partners?.[0]?.display_name?.trim() || 'Shop'
  const website = await fetchPartnerWebsiteByPartnerIdPg(input.partnerId)
  const siteSlug = website?.siteSlug?.trim() ?? ''
  const origin = getPublicAppUrlForServer().replace(/\/$/, '')
  const inboxUrl = await resolveShopNotificationCenterUrl(input.partnerId)
  const ctaUrl = input.href?.trim()
    ? input.href.startsWith('http')
      ? input.href
      : `${origin}${input.href.startsWith('/') ? '' : '/'}${input.href}`
    : inboxUrl
  const optOutUrl = siteSlug
    ? buildMarketingOptOutUrl({
        appOrigin: origin,
        slug: siteSlug,
        payload: { partnerId: input.partnerId, recipientKey, email },
      })
    : ''

  const textLines = [
    shopName,
    '',
    input.title.trim(),
    '',
    input.body.trim(),
    '',
    ctaUrl,
  ]
  if (optOutUrl) textLines.push('', `Hủy nhận email: ${optOutUrl}`)

  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#111827">
  <p style="font-size:13px;color:#6b7280;margin:0 0 12px">${escapeHtml(shopName)}</p>
  <h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(input.title)}</h1>
  <p style="white-space:pre-line;line-height:1.55;margin:0 0 20px">${escapeHtml(input.body)}</p>
  <p><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px">Xem thông báo</a></p>
  ${
    optOutUrl
      ? `<p style="font-size:12px;color:#9ca3af;margin-top:24px"><a href="${escapeHtml(optOutUrl)}" style="color:#6b7280">Hủy nhận email</a></p>`
      : ''
  }
</div>`

  const sent = await sendSmtpMail({
    to: email,
    subject: input.title.trim().slice(0, 180) || shopName,
    text: textLines.join('\n'),
    html,
    fromName: shopName,
    listUnsubscribe: optOutUrl || undefined,
  })
  if (!sent.ok) return { status: 'failed', reason: sent.error.slice(0, 60) }
  return { status: 'sent' }
}

export async function deliverPendingPartnerNotificationEmail(
  row: PartnerCustomerNotificationRow
): Promise<'sent' | 'skipped' | 'failed'> {
  const result = await sendPartnerCustomerNotificationEmail({
    partnerId: row.partnerId,
    guestAccountId: row.guestAccountId,
    title: row.title,
    body: row.body,
    href: row.href,
  })
  await markPartnerCustomerNotificationEmailStatusFromPg({
    notificationId: row.id,
    status: result.status,
    error: result.reason,
  })
  if (result.status === 'sent' && row.broadcastId) {
    await incrementPartnerNotificationBroadcastEmailSentFromPg(row.broadcastId, 1)
  }
  return result.status
}
