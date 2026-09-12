/** SLA cọc: nhắc 2h/20h; chỉ nhả tồn VN, không tự hủy đơn TQ. */

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
}): { title: string; detail: string; subject: string; subjectRest: string; text: string } {
  const shop = input.shopName.trim() || 'Shop'
  const code = input.orderCode.trim() || 'đơn'
  const title = `Nhắc đặt cọc sau ${input.hours} giờ`
  const detail = `Đơn ${code} đang chờ đặt cọc. Đây là lời nhắc sau ${input.hours} giờ.`
  const subjectRest = `Nhắc đặt cọc đơn ${code}`
  const subject = `${shop} — ${subjectRest}`
  const lines = [
    `Đơn ${code} tại ${shop} đang chờ đặt cọc.`,
    'Vui lòng hoàn tất chuyển khoản để shop xử lý đơn.',
    `Đây là lời nhắc sau ${input.hours} giờ; nếu đã chuyển khoản, bạn có thể bỏ qua email này.`,
    'Quét mã QR trong email này để đặt cọc, hoặc bấm nút mở đơn nhanh.',
  ]
  const openUrl = String(input.openUrl || '').trim()
  if (openUrl) {
    lines.push('', `Mở đơn nhanh: ${openUrl}`)
  }
  return { title, detail, subject, subjectRest, text: lines.join('\n') }
}
