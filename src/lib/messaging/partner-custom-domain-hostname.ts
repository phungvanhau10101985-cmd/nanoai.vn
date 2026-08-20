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
  // sites.nanoai.vn chưa có bản ghi DNS công khai — trỏ CNAME về apex app (cùng VPS, middleware đọc Host).
  return 'nanoai.vn'
}

/** Cặp www ↔ apex (vd. www.tiemanhai.vn ↔ tiemanhai.vn). */
export function partnerCustomDomainWwwApexSibling(hostname: string): string | null {
  const host = hostname.trim().toLowerCase().replace(/\.$/, '')
  if (!host || !HOSTNAME_RE.test(host)) return null
  if (host.startsWith('www.')) {
    const apex = host.slice(4)
    return apex && HOSTNAME_RE.test(apex) ? apex : null
  }
  const www = `www.${host}`
  return HOSTNAME_RE.test(www) ? www : null
}

/** Hostname cần tra DB khi khách gõ www hoặc không www. */
export function partnerCustomDomainHostLookupNames(hostname: string): string[] {
  const host = hostname.trim().toLowerCase().replace(/\.$/, '')
  if (!host) return []
  const sibling = partnerCustomDomainWwwApexSibling(host)
  return sibling ? [host, sibling] : [host]
}

export function partnerCustomDomainHostsMatch(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const left = String(a ?? '').trim().toLowerCase()
  const right = String(b ?? '').trim().toLowerCase()
  if (!left || !right) return false
  if (left === right) return true
  return partnerCustomDomainWwwApexSibling(left) === right
}

/** Tên miền gốc 2 nhãn (tiemanhai.vn) — apex không dùng CNAME, cần A record. */
export function isRegistrableApexHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, '')
  if (!host || !HOSTNAME_RE.test(host) || host.startsWith('www.')) return false
  return host.split('.').length === 2
}

export function partnerCustomDomainApexPair(
  hostname: string
): { apex: string; www: string } | null {
  const host = hostname.trim().toLowerCase().replace(/\.$/, '')
  if (!host) return null
  if (host.startsWith('www.')) {
    const apex = host.slice(4)
    return isRegistrableApexHostname(apex) ? { apex, www: host } : null
  }
  return isRegistrableApexHostname(host) ? { apex: host, www: `www.${host}` } : null
}

/** Hostname SEO chính: ưu tiên tên miền gốc không www (https://tiemanhai.vn/). */
export function partnerCustomDomainSeoHostname(hostname: string): string {
  const host = hostname.trim().toLowerCase().replace(/\.$/, '')
  const pair = partnerCustomDomainApexPair(host)
  return pair ? pair.apex : host
}

export function partnerCustomDomainPublicOrigin(hostname: string): string {
  return `https://${partnerCustomDomainSeoHostname(hostname)}`
}

/** Đổi origin request (www) sang origin SEO (apex) cho canonical/sitemap/OG. */
export function rewritePartnerCustomDomainOriginForSeo(origin: string): string {
  try {
    const url = new URL(origin.includes('://') ? origin : `https://${origin}`)
    const seoHost = partnerCustomDomainSeoHostname(url.hostname)
    if (!seoHost || seoHost === url.hostname.toLowerCase()) {
      return `${url.protocol}//${url.host}`.replace(/\/$/, '')
    }
    url.hostname = seoHost
    url.port = ''
    return url.origin.replace(/\/$/, '')
  } catch {
    return origin.replace(/\/$/, '')
  }
}
