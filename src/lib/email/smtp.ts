import nodemailer from 'nodemailer'

export function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim() &&
      process.env.SMTP_FROM?.trim()
  )
}

export async function sendSmtpMail(opts: {
  to: string
  subject: string
  text: string
  html?: string
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

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user: process.env.SMTP_USER!.trim(),
        pass: process.env.SMTP_PASS!.trim(),
      },
    })

    await transporter.sendMail({
      from: process.env.SMTP_FROM!.trim(),
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      ...(opts.html ? { html: opts.html } : {}),
    })
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[smtp]', msg)
    return { ok: false, error: msg }
  }
}
