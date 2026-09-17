/** SLA cọc: nhắc 2h/20h; chỉ nhả tồn VN, không tự hủy đơn TQ. */

import { DEFAULT_WEB_LOCALE, normalizeWebLocale, type WebLocale } from '@/lib/i18n/config'
import { formatDepositReminderEmailContentForCustomer } from '@/lib/messaging/order-customer-notify-i18n'

export const DEPOSIT_REMIND_HOURS = [2, 20] as const
export type DepositRemindHour = (typeof DEPOSIT_REMIND_HOURS)[number]

export function depositReminderHoursDue(input: {
  createdAt: string | Date
  now?: Date
  remindedAt2h?: string | Date | null
  remindedAt20h?: string | Date | null
}): DepositRemindHour[] {
  const created = input.createdAt instanceof Date ? input.createdAt : new Date(input.createdAt)
  if (Number.isNaN(created.getTime())) return []
  const now = input.now || new Date()
  const ageMs = now.getTime() - created.getTime()
  const due: DepositRemindHour[] = []
  if (ageMs >= 2 * 3600_000 && !input.remindedAt2h) due.push(2)
  if (ageMs >= 20 * 3600_000 && !input.remindedAt20h) due.push(20)
  return due
}

export function depositReminderCopy(input: {
  shopName: string
  orderCode: string
  hours: DepositRemindHour
  openUrl?: string | null
  locale?: WebLocale | string | null
}): { title: string; detail: string; subject: string; subjectRest: string; text: string } {
  const loc = normalizeWebLocale(input.locale ?? '') ?? DEFAULT_WEB_LOCALE
  const mail = formatDepositReminderEmailContentForCustomer({
    locale: loc,
    shopLabel: input.shopName,
    orderCode: input.orderCode,
    hours: input.hours,
  })
  const openUrl = String(input.openUrl || '').trim()
  const text = openUrl ? `${mail.text}\n\n${openUrl}` : mail.text
  return { ...mail, text }
}
