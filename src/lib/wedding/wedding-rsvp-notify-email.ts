import { sendSmtpMail } from '@/lib/email/smtp'
import type { WeddingAttendanceSummary } from '@/lib/wedding/wedding-attendance-summary'

type AttendanceMailInput = {
  kind: 'daily' | 'increase'
  couple: string
  summary: WeddingAttendanceSummary
  previousPeople: number
  resultsUrl: string
  primaryLabel: string
  secondaryLabel: string
  /** Thiệp một người không có nhà thứ hai. */
  includeSecondary?: boolean
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function sideText(label: string, bucket: WeddingAttendanceSummary['groom']): string[] {
  const lines = [
    label,
    `Khách đi: ${bucket.guestsAttending}`,
    `Người đi: ${bucket.peopleAttending}`,
    `Người không đi: ${bucket.peopleDeclined}`,
  ]
  if (bucket.guestsPending > 0) lines.push(`Chưa phản hồi: ${bucket.guestsPending} khách`)
  return lines
}

function sideHtml(label: string, bucket: WeddingAttendanceSummary['groom']): string {
  const row = (name: string, value: string) =>
    `<tr><td style="padding:6px 0;color:#666">${escapeHtml(name)}</td><td style="padding:6px 0;text-align:right;font-weight:700;font-size:18px">${escapeHtml(value)}</td></tr>`
  const pending =
    bucket.guestsPending > 0 ? row('Chưa phản hồi', `${bucket.guestsPending} khách`) : ''
  return `<h2 style="margin:22px 0 8px;font-size:16px">${escapeHtml(label)}</h2>
<table style="width:100%;border-collapse:collapse">
${row('Khách đi', String(bucket.guestsAttending))}
${row('Người đi', String(bucket.peopleAttending))}
${row('Người không đi', String(bucket.peopleDeclined))}
${pending}
</table>`
}

function outsideActive(bucket: WeddingAttendanceSummary['outside']): boolean {
  return bucket.guestsAttending > 0 || bucket.guestsDeclined > 0 || bucket.peopleAttending > 0 || bucket.peopleDeclined > 0
}

export function buildWeddingAttendanceMail(input: AttendanceMailInput): { subject: string; text: string; html: string } {
  const couple = input.couple.trim() || 'thiệp cưới'
  const subject =
    input.kind === 'increase' ? `${couple}: số người đi đã tăng` : `${couple}: kết quả tham dự theo từng nhà`

  const intro =
    input.kind === 'increase'
      ? 'Có khách xác nhận đi thêm. Thư này gửi một lần trong ngày, gộp mọi khách xác nhận thêm. Số liệu tính riêng từng nhà.'
      : 'Khách đã trả lời trên thiệp. Số liệu tính riêng từng nhà.'

  const includeSecondary = input.includeSecondary !== false
  const lines = [intro, '', ...sideText(input.primaryLabel, input.summary.groom)]
  if (includeSecondary) lines.push('', ...sideText(input.secondaryLabel, input.summary.bride))
  if (outsideActive(input.summary.outside)) lines.push('', ...sideText('Ngoài danh sách mời', input.summary.outside))
  lines.push('', `Xem kết quả: ${input.resultsUrl}`)
  const text = lines.join('\n')

  const html = `<!DOCTYPE html><html><body style="font-family:Georgia,serif;line-height:1.55;color:#333;max-width:520px;margin:0 auto;padding:24px">
<p style="margin:0 0 8px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#9f1239">${escapeHtml(couple)}</p>
<p style="margin:0 0 4px">${escapeHtml(intro)}</p>
${sideHtml(input.primaryLabel, input.summary.groom)}
${includeSecondary ? sideHtml(input.secondaryLabel, input.summary.bride) : ''}
${outsideActive(input.summary.outside) ? sideHtml('Ngoài danh sách mời', input.summary.outside) : ''}
<p style="margin:28px 0">
  <a href="${escapeHtml(input.resultsUrl)}" style="display:inline-block;background:#9f1239;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">Xem kết quả</a>
</p>
</body></html>`

  return { subject, text, html }
}

export async function sendWeddingAttendanceMail(input: AttendanceMailInput & { to: string[] }): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!input.to.length) return { ok: false, error: 'no_recipient' }
  const mail = buildWeddingAttendanceMail(input)
  let lastError = 'send_failed'
  let sent = 0
  for (const to of input.to) {
    const result = await sendSmtpMail({
      to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      fromName: input.couple.trim() || undefined,
    })
    if (result.ok) sent += 1
    else lastError = result.error
  }
  if (sent === 0) return { ok: false, error: lastError }
  return { ok: true }
}
