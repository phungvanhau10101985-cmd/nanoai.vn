const HOSTNAME_RE =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i

const BLOCKED_HOSTS = new Set([
  'nanoai.vn',
  'www.nanoai.vn',
  'localhost',
  '127.0.0.1',
])

/** Chuẩn hóa hostname khách nhập (bỏ https://, path, port). */
export function normalizePartnerCustomDomainHostname(raw: string): string | null {
  let s = String(raw ?? '').trim().toLowerCase()
  if (!s) return null
  s = s.replace(/^https?:\/\//, '')
  s = s.split('/')[0] ?? ''
  s = s.split(':')[0] ?? ''
  s = s.replace(/\.$/, '')
  if (!s || s.length > 253 || !HOSTNAME_RE.test(s)) return null
  if (BLOCKED_HOSTS.has(s)) return null
  if (s.endsWith('.nanoai.vn')) return null
  return s
}

export function getPartnerCustomDomainCnameTarget(): string {
  const fromEnv = process.env.PARTNER_CUSTOM_DOMAIN_CNAME_TARGET?.trim().toLowerCase()
  if (fromEnv) return fromEnv.replace(/\.$/, '')
  return 'sites.nanoai.vn'
}
