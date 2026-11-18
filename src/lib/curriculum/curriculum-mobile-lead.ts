/**
 * Link Zalo Official Account. Điền `https://zalo.me/…` khi có OA.
 * Để trống thì nút Zalo cuộn tới form.
 */
export const CURRICULUM_MOBILE_ZALO_URL = ''

export function curriculumMobileZaloHref(url: string = CURRICULUM_MOBILE_ZALO_URL): string {
  const trimmed = url.trim()
  if (/^https:\/\/(zalo\.me|oa\.zalo\.me)\//i.test(trimmed)) return trimmed
  return '#dang-ky'
}

export type CurriculumMobileLeadContactKind = 'email' | 'phone'

export type CurriculumMobileLeadInput = {
  name: string
  contact: string
  contactKey: string
  contactKind: CurriculumMobileLeadContactKind
  subject: string
}

function clip(value: unknown, max: number): string {
  const text = typeof value === 'string' ? value : ''
  return text.replace(/[\u0000\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
}

function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase()
  if (email.length < 6 || email.length > 120) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  return email
}

/** Số Việt Nam về dạng 0xxxxxxxxx. */
export function normalizeVietnamPhone(raw: string): string | null {
  const compact = raw.replace(/[\s.-]/g, '')
  if (/^\+84\d{9}$/.test(compact)) return `0${compact.slice(3)}`
  if (/^84\d{9}$/.test(compact)) return `0${compact.slice(2)}`
  if (/^0\d{9}$/.test(compact)) return compact
  return null
}

export function parseCurriculumMobileLead(body: unknown):
  | { ok: true; ignored: true }
  | { ok: true; lead: CurriculumMobileLeadInput }
  | { ok: false } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false }
  const record = body as Record<string, unknown>
  const honeypot = clip(record.company_website, 200)
  if (honeypot) return { ok: true, ignored: true }

  const name = clip(record.name, 80)
  const subject = clip(record.subject, 120)
  const contactRaw = clip(record.contact, 120)
  if (name.length < 2 || subject.length < 2 || !contactRaw) return { ok: false }

  if (contactRaw.includes('@')) {
    const email = normalizeEmail(contactRaw)
    if (!email) return { ok: false }
    return {
      ok: true,
      lead: { name, subject, contact: email, contactKey: email, contactKind: 'email' },
    }
  }

  const phone = normalizeVietnamPhone(contactRaw)
  if (!phone) return { ok: false }
  return {
    ok: true,
    lead: { name, subject, contact: phone, contactKey: phone, contactKind: 'phone' },
  }
}
