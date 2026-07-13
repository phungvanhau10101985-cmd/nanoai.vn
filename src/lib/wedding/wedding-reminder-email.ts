import { sendSmtpMail } from '@/lib/email/smtp'
import { getPublicAppUrlForServer } from '@/lib/auth/public-app-url'
import type { WeddingReminderDueRow } from '@/lib/db/wedding-cards-pg'
import { DEFAULT_WEB_LOCALE, normalizeWebLocale, type WebLocale } from '@/lib/i18n/config'
import { formatWeddingDateForDisplay } from '@/lib/wedding/wedding-date-normalize'
import { buildWeddingReminderInviteUrl } from '@/lib/wedding/wedding-guest-invite-link'

type ReminderMailCopy = {
  subject: string
  greeting: string
  body: string
  cta: string
  footer: string
}

const COPY: Record<WebLocale, ReminderMailCopy> = {
  vi: {
    subject: 'Nhắc lịch đám cưới {couple}',
    greeting: 'Xin chào{guest}!',
    body: 'Đám cưới của {couple} sẽ diễn ra vào {date}. Đây là lời nhắc theo yêu cầu của bạn — còn {days} ngày nữa là đến ngày trọng đại.',
    cta: 'Xem thiệp cưới',
    footer: 'Bạn nhận email này vì đã đăng ký nhắc lịch trên thiệp mời cưới.',
  },
  en: {
    subject: 'Wedding reminder — {couple}',
    greeting: 'Hello{guest}!',
    body: 'The wedding of {couple} is on {date}. This is your requested reminder — {days} day(s) to go.',
    cta: 'View invitation',
    footer: 'You received this email because you subscribed to a reminder on the wedding invitation.',
  },
  zh: {
    subject: '婚礼提醒 — {couple}',
    greeting: '您好{guest}！',
    body: '{couple} 的婚礼将于 {date} 举行。这是您预约的提醒——还有 {days} 天。',
    cta: '查看请柬',
    footer: '您收到此邮件是因为在婚礼请柬上订阅了提醒。',
  },
  ja: {
    subject: '結婚式のリマインダー — {couple}',
    greeting: '{guest} 様',
    body: '{couple} の結婚式は {date} です。ご希望のリマインダーです — あと {days} 日です。',
    cta: '招待状を見る',
    footer: '結婚式招待状でリマインダーを登録されたため、このメールをお送りしています。',
  },
  ko: {
    subject: '결혼식 알림 — {couple}',
    greeting: '안녕하세요{guest}!',
    body: '{couple}의 결혼식은 {date}입니다. 요청하신 알림입니다 — {days}일 남았습니다.',
    cta: '청첩장 보기',
    footer: '청첩장에서 알림을 신청하셔서 이 메일을 보내드립니다.',
  },
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function resolveEffectiveWeddingDate(row: WeddingReminderDueRow): string | null {
  if (row.inviteVenue === 'groom_home') return row.groomInviteWeddingDate ?? row.weddingDate
  if (row.inviteVenue === 'bride_home') return row.brideInviteWeddingDate ?? row.weddingDate
  return row.weddingDate
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? '')
}

export async function sendWeddingReminderEmail(row: WeddingReminderDueRow): Promise<{ ok: true } | { ok: false; error: string }> {
  const locale = normalizeWebLocale(row.locale) ?? DEFAULT_WEB_LOCALE
  const copy = COPY[locale]
  const couple = `${row.groomName} & ${row.brideName}`.trim()
  const weddingDateIso = resolveEffectiveWeddingDate(row)
  if (!weddingDateIso) return { ok: false, error: 'no_wedding_date' }

  const origin = getPublicAppUrlForServer().replace(/\/$/, '')
  const baseUrl = `${origin}/thiep-moi-cuoi/${encodeURIComponent(row.slug)}`
  const inviteUrl = buildWeddingReminderInviteUrl(baseUrl, {
    guestEmail: row.guestEmail,
    guestName: row.guestName || undefined,
    inviteVenue: row.inviteVenue || undefined,
  })

  const guestToken =
    locale === 'ja'
      ? row.guestName.trim() || 'ご来賓'
      : row.guestName.trim()
        ? ` ${row.guestName.trim()}`
        : ''

  const vars = {
    couple,
    guest: guestToken,
    date: dateLabel,
    days: String(row.daysBefore),
  }

  const subject = fillTemplate(copy.subject, vars)
  const greeting = fillTemplate(copy.greeting, vars)
  const body = fillTemplate(copy.body, vars)
  const text = `${greeting}\n\n${body}\n\n${copy.cta}: ${inviteUrl}\n\n${copy.footer}`
  const html = `<!DOCTYPE html><html><body style="font-family:Georgia,serif;line-height:1.6;color:#333;max-width:520px;margin:0 auto;padding:24px">
<p>${escapeHtml(greeting)}</p>
<p>${escapeHtml(body)}</p>
<p style="margin:28px 0">
  <a href="${escapeHtml(inviteUrl)}" style="display:inline-block;background:#9f1239;color:#fff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:600">${escapeHtml(copy.cta)}</a>
</p>
<p style="font-size:13px;color:#666">${escapeHtml(copy.footer)}</p>
</body></html>`

  return sendSmtpMail({
    to: row.guestEmail,
    subject,
    text,
    html,
    fromName: couple || undefined,
  })
}
