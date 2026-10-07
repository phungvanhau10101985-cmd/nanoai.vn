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
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function line(label: string, guests: number, peopleGoing: number, peopleDeclined: number): string {
  return `${label}: ${guests} khách đi, ${peopleGoing} người đi, ${peopleDeclined} người không đi`
}

export function buildWeddingAttendanceMail(input: AttendanceMailInput): { subject: string; text: string; html: string } {
  const couple = input.couple.trim() || 'thiệp cưới'
  const going = input.summary.total.peopleAttending
  const declined = input.summary.total.peopleDeclined
  const guests = input.summary.total.guestsAttending
  const subject =
    input.kind === 'increase'
      ? `${couple}: số người đi tăng lên ${going}`
      : `${couple}: ${going} người đi, ${declined} người không đi`

  const intro =
    input.kind === 'increase'
      ? `Số người xác nhận đi tăng từ ${input.previousPeople} lên ${going}. Thư này gửi một lần trong ngày, gộp mọi khách xác nhận thêm.`
      : 'Tổng kết khách đã trả lời trên thiệp.'

  const lines = [
    intro,
    '',
    `Tổng: ${guests} khách đi, ${going} người đi, ${declined} người không đi.`,
    `Chưa phản hồi: ${input.summary.total.guestsPending} khách.`,
    line(input.primaryLabel, input.summary.groom.guestsAttending, input.summary.groom.peopleAttending, input.summary.groom.peopleDeclined),
    line(input.secondaryLabel, input.summary.bride.guestsAttending, input.summary.bride.peopleAttending, input.summary.bride.peopleDeclined),
  ]
  if (input.summary.outside.guestsAttending > 0 || input.summary.outside.guestsDeclined > 0) {
    lines.push(
      line(
        'Ngoài danh sách mời',
        input.summary.outside.guestsAttending,
        input.summary.outside.peopleAttending,
        input.summary.outside.peopleDeclined,
      ),
    )
  }
  lines.push('', `Xem kết quả: ${input.resultsUrl}`)
  const text = lines.join('\n')

  const row = (label: string, value: string) =>
    `<tr><td style="padding:8px 0;color:#666">${escapeHtml(label)}</td><td style="padding:8px 0;text-align:right;font-weight:700;font-size:18px">${escapeHtml(value)}</td></tr>`

  const html = `<!DOCTYPE html><html><body style="font-family:Georgia,serif;line-height:1.55;color:#333;max-width:520px;margin:0 auto;padding:24px">
<p style="margin:0 0 8px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#9f1239">${escapeHtml(couple)}</p>
<p style="margin:0 0 16px">${escapeHtml(intro)}</p>
<table style="width:100%;border-collapse:collapse">
${row('Khách đi', String(guests))}
${row('Người đi', String(going))}
${row('Người không đi', String(declined))}
${row('Chưa phản hồi', `${input.summary.total.guestsPending} khách`)}
</table>
<p style="margin:18px 0 0;font-size:14px">${escapeHtml(line(input.primaryLabel, input.summary.groom.guestsAttending, input.summary.groom.peopleAttending, input.summary.groom.peopleDeclined))}</p>
<p style="margin:4px 0 0;font-size:14px">${escapeHtml(line(input.secondaryLabel, input.summary.bride.guestsAttending, input.summary.bride.peopleAttending, input.summary.bride.peopleDeclined))}</p>
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
