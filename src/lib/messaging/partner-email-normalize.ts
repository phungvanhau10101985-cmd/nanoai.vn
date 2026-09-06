/**
 * Chuẩn hóa / sửa typo email khi import danh sách nhận tin (cùng nguyên lý 188).
 */

const TLD_FIXES: Array<[RegExp, string]> = [
  [/\.con$/i, '.com'],
  [/\.cmo$/i, '.com'],
  [/\.comn$/i, '.com'],
  [/\.comm$/i, '.com'],
  [/\.coom$/i, '.com'],
  [/\.conm$/i, '.com'],
  [/\.vnn$/i, '.vn'],
]

const DOMAIN_TYPOS: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.cmo': 'gmail.com',
  'gmail.co': 'gmail.com',
  'yahooo.com': 'yahoo.com',
  'yaho.com': 'yahoo.com',
  'yahho.com': 'yahoo.com',
  'yahoo.con': 'yahoo.com',
  'hotmial.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outlook.con': 'outlook.com',
  'iclould.com': 'icloud.com',
  'icloud.con': 'icloud.com',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type EmailNormalizeResult = {
  email: string | null
  original: string
  corrected: boolean
  fixes: string[]
  invalidReason: string | null
}

function basicCleanup(raw: string): string {
  let text = String(raw || '').trim().toLowerCase()
  if (!text || text === 'nan' || text === 'none' || text === 'null' || text === '-') return ''
  if (text.endsWith('.0')) text = text.slice(0, -2)
  text = text.replace(/\s+/g, '').replace(/\u00a0/g, '')
  if (!text.includes('@') && text.includes(';')) text = text.replace(';', '@')
  text = text.replace(/\.{2,}/g, '.').replace(/^\.+|\.+$/g, '')
  return text
}

function applyDomainFixes(text: string): { text: string; fixes: string[] } {
  const fixes: string[] = []
  let candidate = text
  const at = candidate.lastIndexOf('@')
  if (at < 0) return { text: candidate, fixes }
  const local = candidate.slice(0, at)
  let domain = candidate.slice(at + 1)
  for (const [re, to] of TLD_FIXES) {
    if (re.test(domain)) {
      const next = domain.replace(re, to)
      if (next !== domain) {
        fixes.push(`tld:${domain}->${next}`)
        domain = next
      }
    }
  }
  const mapped = DOMAIN_TYPOS[domain]
  if (mapped && mapped !== domain) {
    fixes.push(`domain:${domain}->${mapped}`)
    domain = mapped
  }
  candidate = `${local}@${domain}`
  return { text: candidate, fixes }
}

export function normalizeImportedEmail(raw: string): EmailNormalizeResult {
  const original = String(raw || '').trim()
  const cleaned = basicCleanup(original)
  if (!cleaned) {
    return { email: null, original, corrected: false, fixes: [], invalidReason: 'empty' }
  }
  const { text, fixes } = applyDomainFixes(cleaned)
  if (!EMAIL_RE.test(text) || text.length > 180) {
    return { email: null, original, corrected: fixes.length > 0, fixes, invalidReason: 'invalid' }
  }
  return {
    email: text,
    original,
    corrected: fixes.length > 0 && text !== cleaned,
    fixes,
    invalidReason: null,
  }
}

export function isValidPromoEmail(v: string): boolean {
  const t = v.trim().toLowerCase()
  return EMAIL_RE.test(t) && t.length <= 180
}

export const isValidPartnerEmail = isValidPromoEmail
