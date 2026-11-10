/**
 * IP khách cho Meta CAPI. Pixel thường thấy IPv6; nếu header có IPv6 công cộng thì gửi IPv6,
 * không thì IPv4 công cộng. Bỏ địa chỉ loopback / link-local / mạng riêng.
 */

function stripMapped(raw: string): string {
  let ip = raw.trim()
  if (ip.startsWith('[') && ip.includes(']')) ip = ip.slice(1, ip.indexOf(']'))
  const zone = ip.indexOf('%')
  if (zone >= 0) ip = ip.slice(0, zone)
  if (ip.toLowerCase().startsWith('::ffff:')) ip = ip.slice(7)
  return ip
}

function isPublicIpv4(ip: string): boolean {
  if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip)) return false
  const parts = ip.split('.').map((n) => Number(n))
  if (parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false
  const [a, b] = parts
  if (a === 0 || a === 10 || a === 127) return false
  if (a === 169 && b === 254) return false
  if (a === 172 && b >= 16 && b <= 31) return false
  if (a === 192 && b === 168) return false
  if (a === 100 && b >= 64 && b <= 127) return false
  return true
}

function isPublicIpv6(ip: string): boolean {
  if (!ip.includes(':') || !/^[0-9a-fA-F:]+$/.test(ip)) return false
  const lower = ip.toLowerCase()
  if (lower === '::' || lower === '::1') return false
  if (lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd')) return false
  return true
}

function pushCandidates(into: string[], raw: string | null | undefined): void {
  const text = String(raw ?? '').trim()
  if (!text) return
  for (const part of text.split(',')) {
    const ip = stripMapped(part)
    if (!ip || into.includes(ip)) continue
    if (isPublicIpv4(ip) || isPublicIpv6(ip)) into.push(ip)
  }
}

/** Ưu tiên IPv6 công cộng, rồi tới IPv4. `cf-connecting-ip` đứng trước chuỗi proxy. */
export function metaClientIpFromHeaders(headers: { get(name: string): string | null }): string | null {
  const found: string[] = []
  pushCandidates(found, headers.get('cf-connecting-ip'))
  pushCandidates(found, headers.get('true-client-ip'))
  pushCandidates(found, headers.get('x-real-ip'))
  pushCandidates(found, headers.get('x-forwarded-for'))
  return found.find((ip) => ip.includes(':')) || found[0] || null
}
