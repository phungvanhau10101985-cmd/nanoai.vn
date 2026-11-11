import { getPublicAppUrlForServer } from '@/lib/auth/public-app-url'
import { getAuthUserEmailFromPg } from '@/lib/db/auth-user-email-pg'
import { pgQuery } from '@/lib/db/pg-query'
import { sendSmtpMail } from '@/lib/email/smtp'
import { DEFAULT_WEB_LOCALE, normalizeWebLocale, type WebLocale } from '@/lib/i18n/config'
import { deliverUserNotificationPg } from '@/lib/notifications/deliver-user-notification-pg'
import { formatWeddingDateForDisplay, weddingDateFromPg } from '@/lib/wedding/wedding-date-normalize'
import { todayIsoInVietnam } from '@/lib/wedding/wedding-card-retention'

/** Nhắc chủ thiệp chưa mua gói khách mời, trước ngày cưới họ đã điền. */
export const WEDDING_UNPAID_PACK_REMINDER_DAYS = 15

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

export type UnpaidPackReminderPick = {
  dateIso: string
  daysBefore: number
}

type ReminderCopy = {
  subject(days: number, couple: string | null): string
  title(days: number): string
  body(days: number, couple: string | null, date: string): string
  cta: string
  footer: string
}

const COPY: Record<WebLocale, ReminderCopy> = {
  vi: {
    subject: (days, couple) =>
      couple ? `Còn ${days} ngày đến ngày cưới ${couple}` : `Còn ${days} ngày đến ngày cưới của bạn`,
    title: (days) => `Còn ${days} ngày đến ngày cưới`,
    body: (days, couple, date) =>
      couple
        ? `Ngày cưới trên thiệp ${couple} là ${date}, còn ${days} ngày. Bạn chưa mua gói khách mời nên chỉ 3 khách đầu mỗi bên hiện link. Mở thiệp để sửa và chọn gói trước ngày cưới.`
        : `Ngày cưới trên thiệp của bạn là ${date}, còn ${days} ngày. Bạn chưa mua gói khách mời nên chỉ 3 khách đầu mỗi bên hiện link. Mở thiệp để sửa và chọn gói trước ngày cưới.`,
    cta: 'Sửa thiệp',
    footer: 'Bạn nhận email này vì đã tạo thiệp cưới trên NanoAI và chưa mua gói khách mời.',
  },
  en: {
    subject: (days, couple) =>
      couple ? `${days} days until ${couple}'s wedding` : `${days} days until your wedding`,
    title: (days) => `${days} days until the wedding`,
    body: (days, couple, date) =>
      couple
        ? `The wedding date on ${couple}'s invitation is ${date}, ${days} day(s) away. You have not bought a guest pack, so only the first 3 guests on each side have a link. Open the invitation to edit it and choose a pack before the wedding.`
        : `The wedding date on your invitation is ${date}, ${days} day(s) away. You have not bought a guest pack, so only the first 3 guests on each side have a link. Open the invitation to edit it and choose a pack before the wedding.`,
    cta: 'Edit invitation',
    footer: 'You received this email because you created a wedding invitation on NanoAI and have not bought a guest pack.',
  },
  zh: {
    subject: (days, couple) => (couple ? `距 ${couple} 的婚礼还有 ${days} 天` : `距您的婚礼还有 ${days} 天`),
    title: (days) => `距婚礼还有 ${days} 天`,
    body: (days, couple, date) =>
      couple
        ? `${couple} 的请柬婚礼日期是 ${date}，还有 ${days} 天。您尚未购买宾客套餐，因此每方仅前 3 位宾客有链接。请打开请柬修改，并在婚礼前选择套餐。`
        : `您的请柬婚礼日期是 ${date}，还有 ${days} 天。您尚未购买宾客套餐，因此每方仅前 3 位宾客有链接。请打开请柬修改，并在婚礼前选择套餐。`,
    cta: '修改请柬',
    footer: '您收到此邮件是因为在 NanoAI 创建了婚礼请柬且尚未购买宾客套餐。',
  },
  ja: {
    subject: (days, couple) =>
      couple ? `${couple} の結婚式まであと ${days} 日` : `結婚式まであと ${days} 日`,
    title: (days) => `結婚式まであと ${days} 日`,
    body: (days, couple, date) =>
      couple
        ? `${couple} の招待状の結婚式日は ${date} で、あと ${days} 日です。ゲストプラン未購入のため、各方とも最初の 3 名だけリンクが表示されます。招待状を開いて修正し、当日までにプランを選んでください。`
        : `招待状の結婚式日は ${date} で、あと ${days} 日です。ゲストプラン未購入のため、各方とも最初の 3 名だけリンクが表示されます。招待状を開いて修正し、当日までにプランを選んでください。`,
    cta: '招待状を編集',
    footer: 'NanoAI で結婚式の招待状を作成し、ゲストプランをまだ購入されていないため、このメールをお送りしています。',
  },
  ko: {
    subject: (days, couple) =>
      couple ? `${couple} 결혼식까지 ${days}일` : `결혼식까지 ${days}일 남았습니다`,
    title: (days) => `결혼식까지 ${days}일`,
    body: (days, couple, date) =>
      couple
        ? `${couple} 청첩장의 결혼식 날짜는 ${date}이며 ${days}일 남았습니다. 하객 패키지를 아직 구매하지 않아 양가 모두 앞 3명만 링크가 열립니다. 청첩장을 열어 수정하고 결혼식 전에 패키지를 선택하세요.`
        : `청첩장의 결혼식 날짜는 ${date}이며 ${days}일 남았습니다. 하객 패키지를 아직 구매하지 않아 양가 모두 앞 3명만 링크가 열립니다. 청첩장을 열어 수정하고 결혼식 전에 패키지를 선택하세요.`,
    cta: '청첩장 수정',
    footer: 'NanoAI에서 청첩장을 만들고 하객 패키지를 아직 구매하지 않아 이 메일을 보냅니다.',
  },
}

function isoDayNumber(iso: string): number | null {
  const match = ISO_DATE.exec(iso)
  if (!match) return null
  const day = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86_400_000
  return Number.isFinite(day) ? day : null
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function weddingUnpaidPackReminderKey(cardId: string): string {
  return `wedding-unpaid-pack-reminder:${cardId}`
}

export function weddingUnpaidPackEditPath(cardId: string): string {
  return `/tao-thiep-moi-cuoi-ai?cardId=${encodeURIComponent(cardId)}`
}

/**
 * Ngày cưới cần nhắc. Đúng 15 ngày trước thì gửi.
 * Cron lỡ ngày đó thì gửi bù một lần nếu thiệp đã tồn tại từ mốc 15 ngày, và ngày cưới vẫn còn ở phía trước.
 */
export function selectUnpaidPackReminder(input: {
  todayIso: string
  createdOnIso: string
  dates: Array<string | null | undefined>
  alreadySent?: boolean
}): UnpaidPackReminderPick | null {
  if (input.alreadySent) return null
  const today = isoDayNumber(input.todayIso)
  const created = isoDayNumber(input.createdOnIso)
  if (today == null || created == null) return null

  const seen = new Set<string>()
  let best: UnpaidPackReminderPick | null = null
  for (const raw of input.dates) {
    const dateIso = weddingDateFromPg(raw)
    if (!dateIso || seen.has(dateIso)) continue
    seen.add(dateIso)
    const day = isoDayNumber(dateIso)
    if (day == null) continue
    const daysBefore = day - today
    if (daysBefore < 1 || daysBefore > WEDDING_UNPAID_PACK_REMINDER_DAYS) continue
    const onSchedule = daysBefore === WEDDING_UNPAID_PACK_REMINDER_DAYS
    const missedSchedule = daysBefore < WEDDING_UNPAID_PACK_REMINDER_DAYS && created <= day - WEDDING_UNPAID_PACK_REMINDER_DAYS
    if (!onSchedule && !missedSchedule) continue
    if (!best || dateIso < best.dateIso) best = { dateIso, daysBefore }
  }
  return best
}

function coupleName(groomName: string, brideName: string): string | null {
  const label = [groomName.trim(), brideName.trim()].filter(Boolean).join(' & ')
  return label || null
}

export function buildWeddingUnpaidPackReminderMail(input: {
  locale?: string | null
  groomName: string
  brideName: string
  dateIso: string
  daysBefore: number
  editUrl: string
}): { subject: string; title: string; body: string; text: string; html: string } {
  const locale = normalizeWebLocale(input.locale) ?? DEFAULT_WEB_LOCALE
  const copy = COPY[locale]
  const couple = coupleName(input.groomName, input.brideName)
  const date = formatWeddingDateForDisplay(input.dateIso, locale)
  const subject = copy.subject(input.daysBefore, couple)
  const title = copy.title(input.daysBefore)
  const body = copy.body(input.daysBefore, couple, date)
  const text = `${body}\n\n${copy.cta}: ${input.editUrl}\n\n${copy.footer}`
  const html = `<!DOCTYPE html><html><body style="font-family:Georgia,serif;line-height:1.6;color:#333;max-width:520px;margin:0 auto;padding:24px">
<p>${escapeHtml(body)}</p>
<p style="margin:28px 0">
  <a href="${escapeHtml(input.editUrl)}" style="display:inline-block;background:#9f1239;color:#fff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:600">${escapeHtml(copy.cta)}</a>
</p>
<p style="font-size:13px;color:#666">${escapeHtml(copy.footer)}</p>
</body></html>`
  return { subject, title, body, text, html }
}

type DueCardRow = {
  id: string
  user_id: string
  groom_name: string
  bride_name: string
  wedding_date: string | null
  groom_invite_wedding_date: string | null
  bride_invite_wedding_date: string | null
  created_on: string
}

export async function sendDueWeddingUnpaidPackReminders(now = new Date()): Promise<{
  due: number
  sent: number
  failed: number
  skippedNoEmail: number
}> {
  const todayIso = todayIsoInVietnam(now)
  const rows = await pgQuery<DueCardRow>(
    `select c.id::text as id,
            c.user_id::text as user_id,
            coalesce(c.groom_name, '') as groom_name,
            coalesce(c.bride_name, '') as bride_name,
            c.wedding_date::text as wedding_date,
            c.groom_invite_wedding_date::text as groom_invite_wedding_date,
            c.bride_invite_wedding_date::text as bride_invite_wedding_date,
            (timezone('Asia/Ho_Chi_Minh', c.created_at))::date::text as created_on
     from public.wedding_cards c
     where c.occasion_key = 'wedding'
       and c.groom_guest_pack is null
       and c.bride_guest_pack is null
       and c.guest_pack is null
       and not exists (
         select 1
         from public.notifications n
         where n.user_id = c.user_id
           and n.meta ->> 'idempotency_key' = 'wedding-unpaid-pack-reminder:' || c.id::text
       )
       and exists (
         select 1
         from unnest(array[c.wedding_date, c.groom_invite_wedding_date, c.bride_invite_wedding_date]) as dates(ceremony)
         where dates.ceremony is not null
           and dates.ceremony > $1::date
           and dates.ceremony <= $1::date + $2::int
       )`,
    [todayIso, WEDDING_UNPAID_PACK_REMINDER_DAYS],
  )

  const origin = getPublicAppUrlForServer().replace(/\/$/, '')
  let due = 0
  let sent = 0
  let failed = 0
  let skippedNoEmail = 0

  for (const row of rows) {
    const pick = selectUnpaidPackReminder({
      todayIso,
      createdOnIso: String(row.created_on ?? ''),
      dates: [row.wedding_date, row.groom_invite_wedding_date, row.bride_invite_wedding_date],
    })
    if (!pick) continue
    due += 1

    const editPath = weddingUnpaidPackEditPath(row.id)
    const mail = buildWeddingUnpaidPackReminderMail({
      groomName: row.groom_name,
      brideName: row.bride_name,
      dateIso: pick.dateIso,
      daysBefore: pick.daysBefore,
      editUrl: `${origin}${editPath}`,
    })
    const notice = {
      user_id: row.user_id,
      type: 'wedding_unpaid_pack_reminder',
      title: mail.title,
      body: mail.body,
      meta: {
        push_url: editPath,
        wedding_card_id: row.id,
        idempotency_key: weddingUnpaidPackReminderKey(row.id),
        skip_email: true,
      },
    }
    const email = await getAuthUserEmailFromPg(row.user_id)
    if (!email) {
      const noted = await deliverUserNotificationPg(notice)
      if (noted) skippedNoEmail += 1
      else failed += 1
      continue
    }

    const mailed = await sendSmtpMail({
      to: email,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    })
    if (!mailed.ok) {
      failed += 1
      console.error('[wedding-unpaid-pack-reminder]', row.id, mailed.error)
      continue
    }

    const noted = await deliverUserNotificationPg(notice)
    if (!noted) console.error('[wedding-unpaid-pack-reminder] bell', row.id)
    sent += 1
  }

  return { due, sent, failed, skippedNoEmail }
}
