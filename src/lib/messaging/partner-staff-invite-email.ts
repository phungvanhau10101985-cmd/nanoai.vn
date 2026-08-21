import { DEFAULT_WEB_LOCALE, normalizeWebLocale, type WebLocale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { getPublicAppUrlForServer } from '@/lib/auth/public-app-url'
import { fetchMessagingPartnersByIdsFromPg } from '@/lib/db/messaging-partners-pg'
import { insertNotificationPg } from '@/lib/db/notifications-repo'
import { isSmtpConfigured, sendSmtpMail } from '@/lib/email/smtp'
import { sendPushNotificationsToUser } from '@/lib/push/send-to-user'

function fillPlaceholders(s: string, vars: Record<string, string>): string {
  let out = s
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(v)
  }
  return out
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function resolveInviteLocale(locale?: string | null): WebLocale {
  return normalizeWebLocale(locale) ?? DEFAULT_WEB_LOCALE
}

/** Trang quản trị shop — nhân viên được mời mở link này sau khi đăng nhập. */
export function partnerStaffAdminPath(
  partnerId: string,
  industryKey?: string | null
): string {
  const id = partnerId.trim()
  if (!id) return '/dashboard/messaging/settings'
  if (industryKey === 'hotel') {
    return `/dashboard/hospitality/settings?partner=${encodeURIComponent(id)}`
  }
  return `/dashboard/messaging/settings?partner=${encodeURIComponent(id)}`
}

/** Origin dashboard NanoAI — không dùng hostname domain shop (vd. tiemanhai.vn). */
export function partnerStaffAdminOrigin(): string {
  const configured =
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
    ''
  if (configured) return configured.replace(/\/$/, '')
  return 'http://localhost:3000'
}

/** Link tuyệt đối trang quản trị — domain shop không có `/dashboard`. */
export function partnerStaffAdminAbsoluteUrl(
  partnerId: string,
  industryKey?: string | null
): string {
  return buildPartnerStaffInviteAdminUrl({
    origin: partnerStaffAdminOrigin(),
    partnerId,
    industryKey,
  })
}

export function buildPartnerStaffInviteAdminUrl(input: {
  origin: string
  partnerId: string
  industryKey?: string | null
}): string {
  const origin = String(input.origin || '').replace(/\/$/, '') || 'http://localhost:3000'
  return `${origin}${partnerStaffAdminPath(input.partnerId, input.industryKey)}`
}

export function buildPartnerStaffInviteEmailContent(input: {
  locale?: string | null
  shopName: string
  inviterEmail: string
  adminUrl: string
}): { subject: string; text: string; html: string; title: string; body: string } {
  const locale = resolveInviteLocale(input.locale)
  const t = getDictionary(locale).partnerMessaging
  const shopName = input.shopName.trim() || 'Shop'
  const inviterEmail = input.inviterEmail.trim() || 'NanoAI'
  const vars = { shop: shopName, inviter: inviterEmail }
  const title = fillPlaceholders(t.teamInviteMailTitle, vars)
  const body = fillPlaceholders(t.teamInviteMailBody, vars)
  const subject = fillPlaceholders(t.teamInviteMailSubject, vars)
  const cta = t.teamInviteMailCta
  const needLogin = t.teamInviteMailNeedLogin
  const orLink = t.teamInviteMailOrLink
  const ignore = t.teamInviteMailIgnore
  const adminUrl = input.adminUrl.trim()

  const text = [title, '', body, '', `${cta}:`, adminUrl, '', needLogin, '', ignore].join('\n')
  const html = `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#111827">
  <p style="font-size:13px;color:#6b7280;margin:0 0 12px">${escapeHtml(shopName)}</p>
  <h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(title)}</h1>
  <p style="line-height:1.55;margin:0 0 20px">${escapeHtml(body)}</p>
  <p style="margin:0 0 16px"><a href="${escapeHtml(adminUrl)}" style="display:inline-block;padding:12px 22px;background:#111827;color:#ffffff !important;text-decoration:none;border-radius:10px;font-size:15px;font-weight:600">${escapeHtml(cta)}</a></p>
  <p style="font-size:13px;line-height:1.5;color:#4b5563;margin:0 0 12px">${escapeHtml(needLogin)}</p>
  <p style="font-size:12px;color:#6b7280;margin:0">${escapeHtml(orLink)} <a href="${escapeHtml(adminUrl)}">${escapeHtml(adminUrl)}</a></p>
  <p style="font-size:12px;color:#9ca3af;margin:20px 0 0">${escapeHtml(ignore)}</p>
</div>`

  return { subject, text, html, title, body }
}

export async function sendPartnerStaffInviteEmail(input: {
  to: string
  partnerId: string
  memberUserId: string
  invitedByEmail?: string | null
  locale?: string | null
}): Promise<{ ok: boolean; adminUrl?: string; error?: string }> {
  const to = input.to.trim().toLowerCase()
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { ok: false, error: 'invalid_email' }
  }

  const partners = await fetchMessagingPartnersByIdsFromPg([input.partnerId])
  const partner = partners?.[0]
  const shopName = partner?.display_name?.trim() || 'Shop'
  const adminPath = partnerStaffAdminPath(input.partnerId, partner?.industry_key)
  const adminUrl = buildPartnerStaffInviteAdminUrl({
    origin: getPublicAppUrlForServer(),
    partnerId: input.partnerId,
    industryKey: partner?.industry_key,
  })
  const content = buildPartnerStaffInviteEmailContent({
    locale: input.locale,
    shopName,
    inviterEmail: input.invitedByEmail?.trim() || '',
    adminUrl,
  })

  try {
    await insertNotificationPg({
      user_id: input.memberUserId,
      type: 'partner_staff_invite',
      title: content.title,
      body: content.body,
      meta: { partner_id: input.partnerId, push_url: adminPath },
    })
  } catch (e) {
    console.warn('[sendPartnerStaffInviteEmail] notification', e)
  }

  try {
    await sendPushNotificationsToUser(input.memberUserId, {
      title: content.title,
      body: content.body,
      url: adminPath,
    })
  } catch (e) {
    console.warn('[sendPartnerStaffInviteEmail] push', e)
  }

  if (!isSmtpConfigured()) {
    return { ok: false, adminUrl, error: 'smtp_not_configured' }
  }

  const sent = await sendSmtpMail({
    to,
    subject: content.subject,
    text: content.text,
    html: content.html,
    fromName: shopName,
  })
  if (!sent.ok) {
    console.warn('[sendPartnerStaffInviteEmail] smtp', sent.error)
    return { ok: false, adminUrl, error: sent.error }
  }
  return { ok: true, adminUrl }
}
