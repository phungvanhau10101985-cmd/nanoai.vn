import { NextResponse } from 'next/server'
import { getClientIpFromRequest, isRateLimited } from '@/lib/api/simple-ip-rate-limit'
import { parseCurriculumMobileLead } from '@/lib/curriculum/curriculum-mobile-lead'
import {
  findRecentCurriculumMobileLeadId,
  insertCurriculumMobileLead,
} from '@/lib/db/curriculum-mobile-leads-pg'
import { isLikelyBotUserAgent } from '@/lib/errors/customer-error-filter'
import { sendSmtpMail } from '@/lib/email/smtp'

export const dynamic = 'force-dynamic'

const SUPPORT_EMAIL = 'support@nanoai.vn'
const LOCALES = new Set(['vi', 'en', 'zh', 'ja', 'ko'])

export async function POST(req: Request) {
  if (isLikelyBotUserAgent(req.headers.get('user-agent'))) {
    return NextResponse.json({ ok: true, ignored: true })
  }
  const ip = getClientIpFromRequest(req)
  if (isRateLimited(`curriculum-mobile-lead:${ip}`, 8, 30 * 60_000)) {
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 })
  }
  const parsed = parseCurriculumMobileLead(body)
  if (!parsed.ok) return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 })
  if ('ignored' in parsed) return NextResponse.json({ ok: true, ignored: true })

  const localeRaw =
    body && typeof body === 'object' && !Array.isArray(body)
      ? String((body as { locale?: unknown }).locale || '').trim().toLowerCase()
      : ''
  const locale = LOCALES.has(localeRaw) ? localeRaw : 'vi'
  const userAgent = String(req.headers.get('user-agent') || '').replace(/\s+/g, ' ').trim().slice(0, 400)

  try {
    const existing = await findRecentCurriculumMobileLeadId(parsed.lead.contactKey)
    if (existing) return NextResponse.json({ ok: true, duplicate: true })
    await insertCurriculumMobileLead({ lead: parsed.lead, locale, ip, userAgent })
  } catch (e) {
    console.error('[curriculum-mobile-lead]', e instanceof Error ? e.message : e)
    return NextResponse.json({ ok: false, error: 'save_failed' }, { status: 503 })
  }

  const lead = parsed.lead
  const text = [
    'Khách xin link mở Giáo trình AI trên máy tính.',
    `Họ tên: ${lead.name}`,
    `Liên hệ: ${lead.contact}`,
    `Môn / cấp: ${lead.subject}`,
    `Ngôn ngữ: ${locale}`,
  ].join('\n')
  void sendSmtpMail({
    to: SUPPORT_EMAIL,
    subject: 'Giáo trình: khách xin link mở trên máy tính',
    text,
    fromName: 'NanoAI',
    ...(lead.contactKind === 'email' ? { replyTo: lead.contact } : {}),
  }).then((result) => {
    if (!result.ok && result.error !== 'smtp_not_configured') {
      console.error('[curriculum-mobile-lead] mail', result.error)
    }
  })

  return NextResponse.json({ ok: true })
}
