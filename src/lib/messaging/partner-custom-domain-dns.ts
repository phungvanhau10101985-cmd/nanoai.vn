import { promises as dns } from 'dns'
import { getPartnerCustomDomainCnameTarget } from '@/lib/messaging/partner-custom-domain-hostname'

const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/

function normalizeDnsName(value: string): string {
  return value.trim().toLowerCase().replace(/\.$/, '')
}

async function resolveCnameTargetIpv4s(): Promise<string[]> {
  const fromEnv = process.env.PARTNER_CUSTOM_DOMAIN_APEX_A_TARGET?.trim()
  if (fromEnv && IPV4_RE.test(fromEnv)) return [fromEnv]
  const target = normalizeDnsName(getPartnerCustomDomainCnameTarget())
  try {
    return await dns.resolve4(target)
  } catch {
    return []
  }
}

/** IP A record cho tên miền gốc (apex không CNAME được). */
export async function getPartnerCustomDomainApexATarget(): Promise<string> {
  const ips = await resolveCnameTargetIpv4s()
  return ips[0] || '14.225.218.39'
}

/** Kiểm tra CNAME hostname → mục tiêu platform (vd. sites.nanoai.vn). */
export async function verifyPartnerCustomDomainCname(hostname: string): Promise<{ ok: boolean; detail: string }> {
  const target = normalizeDnsName(getPartnerCustomDomainCnameTarget())
  const host = normalizeDnsName(hostname)
  try {
    const cnames = await dns.resolveCname(host)
    const matched = cnames.some((r) => {
      const n = normalizeDnsName(r)
      return n === target || n.endsWith(`.${target}`)
    })
    if (matched) {
      return { ok: true, detail: `CNAME → ${cnames.join(', ')}` }
    }
    return { ok: false, detail: `CNAME hiện tại: ${cnames.join(', ') || '—'} (cần trỏ tới ${target})` }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, detail: msg || 'Không đọc được bản ghi CNAME.' }
  }
}

/** Apex: A/AAAA trỏ cùng IP với nanoai.vn (CNAME ở root thường không được phép). */
export async function verifyPartnerCustomDomainApexARecord(
  hostname: string
): Promise<{ ok: boolean; detail: string }> {
  const host = normalizeDnsName(hostname)
  const expected = new Set(await resolveCnameTargetIpv4s())
  if (expected.size === 0) {
    return { ok: false, detail: 'Không đọc được IP đích của nền tảng để đối chiếu A record.' }
  }
  try {
    const addrs = await dns.resolve4(host)
    const matched = addrs.filter((ip) => expected.has(ip))
    if (matched.length > 0) {
      return { ok: true, detail: `A → ${matched.join(', ')}` }
    }
    return {
      ok: false,
      detail: `A hiện tại: ${addrs.join(', ') || '—'} (cần ${[...expected].join(' hoặc ')})`,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, detail: msg || 'Không đọc được bản ghi A.' }
  }
}

/** CNAME (www / subdomain) hoặc A record cùng IP VPS (apex). */
export async function verifyPartnerCustomDomainDns(
  hostname: string
): Promise<{ ok: boolean; detail: string }> {
  const cname = await verifyPartnerCustomDomainCname(hostname)
  if (cname.ok) return cname
  const apexA = await verifyPartnerCustomDomainApexARecord(hostname)
  if (apexA.ok) return apexA
  return {
    ok: false,
    detail: [cname.detail, apexA.detail].filter(Boolean).join(' · '),
  }
}

/** Thử HTTPS tới hostname — xác nhận SSL đang hoạt động (cert hợp lệ qua proxy). */
export async function probePartnerCustomDomainSsl(hostname: string): Promise<{ ok: boolean; detail: string }> {
  const host = normalizeDnsName(hostname)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)
  try {
    const res = await fetch(`https://${host}/`, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
    })
    if (res.ok || res.status === 301 || res.status === 302 || res.status === 404 || res.status === 403) {
      return { ok: true, detail: `HTTPS ${res.status}` }
    }
    return { ok: false, detail: `HTTPS trả ${res.status}` }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, detail: msg || 'Không kết nối được HTTPS.' }
  } finally {
    clearTimeout(timer)
  }
}
