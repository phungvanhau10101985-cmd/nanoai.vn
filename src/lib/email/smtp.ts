import nodemailer from 'nodemailer'

export function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim() &&
      process.env.SMTP_FROM?.trim()
  )
}

/** Ghép display name shop vào địa chỉ From cố định (giữ nguyên domain đã xác thực SPF/DKIM). */
function buildFromWithName(baseFrom: string, fromName?: string): string {
  const name = fromName?.trim()
  if (!name) return baseFrom
  const m = /<([^>]+)>/.exec(baseFrom)
  const address = (m ? m[1] : baseFrom).trim()
  if (!address) return baseFrom
  const safeName = name.replace(/["\\]/g, '').replace(/[\r\n]/g, ' ').slice(0, 78)
  return `"${safeName}" <${address}>`
}

export async function sendSmtpMail(opts: {
  to: string
  subject: string
  text: string
  html?: string
  /** Ghép tên shop vào From — không đổi địa chỉ (giữ deliverability). */
  fromName?: string
  replyTo?: string
  /** Ví dụ List-Unsubscribe cho email marketing. */
  headers?: Record<string, string>
  /** Giá trị header List-Unsubscribe (URL/mailto). Tự bật One-Click. */
  listUnsubscribe?: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSmtpConfigured()) {
    return { ok: false, error: 'smtp_not_configured' }
  }

  const host = process.env.SMTP_HOST!.trim()
  const port = Number(process.env.SMTP_PORT || '587')
  const secure =
    process.env.SMTP_SECURE === 'true' ||
    process.env.SMTP_SECURE === '1' ||
    port === 465
  const tlsRejectUnauthorized = process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== '0'

  const headers: Record<string, string> = { ...(opts.headers ?? {}) }
  if (opts.listUnsubscribe) {
    headers['List-Unsubscribe'] = opts.listUnsubscribe
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click'
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user: process.env.SMTP_USER!.trim(),
        pass: process.env.SMTP_PASS!.trim(),
      },
      ...(tlsRejectUnauthorized ? {} : { tls: { rejectUnauthorized: false } }),
    })

    await transporter.sendMail({
      from: buildFromWithName(process.env.SMTP_FROM!.trim(), opts.fromName),
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      ...(opts.html ? { html: opts.html } : {}),
      ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
      ...(Object.keys(headers).length ? { headers } : {}),
    })
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[smtp]', msg)
    return { ok: false, error: msg }
  }
}
