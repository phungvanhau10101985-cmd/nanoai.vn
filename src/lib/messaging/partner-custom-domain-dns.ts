import { promises as dns } from 'node:dns'
import { getPartnerCustomDomainCnameTarget } from '@/lib/messaging/partner-custom-domain-hostname'

const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/

/** IP VPS mặc định khi resolver công cộng chưa trả A của nanoai.vn. */
export const FALLBACK_PARTNER_CUSTOM_DOMAIN_APEX_IP = '14.225.218.39'

/** Hỏi nhiều resolver vì NXDOMAIN cache / DNS nhà mạng lệch nhau — cùng domain lúc pass lúc fail. */
const PUBLIC_DNS_SERVERS = ['8.8.8.8', '8.8.4.4', '1.1.1.1', '1.0.0.1']
const QUERY_TIMEOUT_MS = 3500

export type PartnerCustomDomainDnsCheck = {
  ok: boolean
  detail: string
  transient?: boolean
}

export type PartnerCustomDomainDnsEvidence = {
  cnames: string[]
  addrs: string[]
  cnameTarget: string
  expectedIps: string[]
  timedOut: boolean
  nxdomain?: boolean
}

function normalizeDnsName(value: string): string {
  return value.trim().toLowerCase().replace(/\.$/, '')
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function dnsErrCode(e: unknown): string {
  if (typeof e === 'object' && e && 'code' in e) {
    return String((e as { code?: string }).code || '')
  }
  return ''
}

function isTransientDnsCode(code: string): boolean {
  return (
    code === 'ETIMEOUT' ||
    code === 'CANCELLED' ||
    code === 'ECANCELLED' ||
    code === 'EAGAIN' ||
    code === 'ESERVFAIL' ||
    code === 'ECONNREFUSED'
  )
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(Object.assign(new Error('DNS timeout'), { code: 'ETIMEOUT' }))
    }, ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      }
    )
  })
}

function cnameMatchesTarget(cname: string, target: string): boolean {
  const n = normalizeDnsName(cname)
  const t = normalizeDnsName(target)
  return n === t || n.endsWith(`.${t}`)
}

/** Gộp kết quả nhiều resolver: một nơi còn NXDOMAIN không được làm fail nếu chỗ khác đã đúng. */
export function evaluatePartnerCustomDomainDns(
  evidence: PartnerCustomDomainDnsEvidence
): PartnerCustomDomainDnsCheck {
  const target = normalizeDnsName(evidence.cnameTarget)
  const cnames = unique(evidence.cnames.map(normalizeDnsName))
  const addrs = unique(evidence.addrs)
  const matchedCname = cnames.filter((row) => cnameMatchesTarget(row, target))
  if (matchedCname.length > 0) {
    return { ok: true, detail: `CNAME → ${cnames.join(', ')}`, transient: false }
  }
  const expected = new Set(evidence.expectedIps.filter((ip) => IPV4_RE.test(ip)))
  const matchedA = addrs.filter((ip) => expected.has(ip))
  if (matchedA.length > 0) {
    return { ok: true, detail: `A → ${unique(matchedA).join(', ')}`, transient: false }
  }
  if (cnames.length === 0 && addrs.length === 0 && evidence.timedOut) {
    return {
      ok: false,
      detail: 'DNS resolver timeout — thử lại sau (không xóa trạng thái đã xác minh).',
      transient: true,
    }
  }
  if (cnames.length === 0 && addrs.length === 0 && evidence.nxdomain) {
    return {
      ok: false,
      detail:
        'NXDOMAIN — tên miền chưa có trên Internet (registry chưa ủy quyền nameserver). Với .vn: trên PA Vietnam kiểm tra domain Active, hồ sơ VNNIC đã duyệt, nameserver ns1/ns2.pavietnam.vn. Chỉ thêm A/CNAME trong panel DNS thì Chrome vẫn báo DNS_PROBE_FINISHED_NXDOMAIN.',
      transient: false,
    }
  }
  const parts: string[] = []
  if (cnames.length > 0) {
    parts.push(`CNAME hiện tại: ${cnames.join(', ')} (cần trỏ tới ${target})`)
  } else {
    parts.push(`Không thấy CNAME tới ${target}`)
  }
  if (addrs.length > 0) {
    parts.push(`A hiện tại: ${addrs.join(', ')} (cần ${[...expected].join(' hoặc ') || 'IP VPS'})`)
  } else {
    parts.push('Không thấy A record')
  }
  return { ok: false, detail: parts.join(' · '), transient: false }
}

async function queryResolver(
  servers: string[] | null,
  host: string,
  kind: 'A' | 'CNAME'
): Promise<{ records: string[]; timeout: boolean; nxdomain: boolean }> {
  try {
    const run = async (): Promise<string[]> => {
      if (servers) {
        const resolver = new dns.Resolver()
        resolver.setServers(servers)
        return kind === 'CNAME' ? resolver.resolveCname(host) : resolver.resolve4(host)
      }
      return kind === 'CNAME' ? dns.resolveCname(host) : dns.resolve4(host)
    }
    const records = await withTimeout(run(), QUERY_TIMEOUT_MS)
    return {
      records: kind === 'CNAME' ? records.map(normalizeDnsName) : records,
      timeout: false,
      nxdomain: false,
    }
  } catch (e) {
    const code = dnsErrCode(e)
    return {
      records: [],
      timeout: isTransientDnsCode(code),
      nxdomain: code === 'ENOTFOUND',
    }
  }
}

async function collectRecords(
  host: string,
  kind: 'A' | 'CNAME'
): Promise<{ records: string[]; timedOut: boolean; nxdomain: boolean }> {
  const jobs = [
    queryResolver(null, host, kind),
    ...PUBLIC_DNS_SERVERS.map((server) => queryResolver([server], host, kind)),
  ]
  const results = await Promise.all(jobs)
  const records = unique(results.flatMap((row) => row.records))
  return {
    records,
    timedOut: results.some((row) => row.timeout),
    nxdomain: records.length === 0 && results.some((row) => row.nxdomain),
  }
}

async function resolveCnameTargetIpv4s(): Promise<string[]> {
  const ips = new Set<string>()
  const fromEnv = process.env.PARTNER_CUSTOM_DOMAIN_APEX_A_TARGET?.trim()
  if (fromEnv && IPV4_RE.test(fromEnv)) ips.add(fromEnv)
  const target = normalizeDnsName(getPartnerCustomDomainCnameTarget())
  const hit = await collectRecords(target, 'A')
  for (const ip of hit.records) {
    if (IPV4_RE.test(ip)) ips.add(ip)
  }
  ips.add(FALLBACK_PARTNER_CUSTOM_DOMAIN_APEX_IP)
  return [...ips]
}

/** IP A record cho tên miền gốc (apex không CNAME được). */
export async function getPartnerCustomDomainApexATarget(): Promise<string> {
  const ips = await resolveCnameTargetIpv4s()
  return ips[0] || FALLBACK_PARTNER_CUSTOM_DOMAIN_APEX_IP
}

async function collectDnsEvidence(hostname: string): Promise<PartnerCustomDomainDnsEvidence> {
  const host = normalizeDnsName(hostname)
  const [cnameHit, aHit, expectedIps] = await Promise.all([
    collectRecords(host, 'CNAME'),
    collectRecords(host, 'A'),
    resolveCnameTargetIpv4s(),
  ])
  return {
    cnames: cnameHit.records,
    addrs: aHit.records,
    cnameTarget: getPartnerCustomDomainCnameTarget(),
    expectedIps,
    timedOut: cnameHit.timedOut || aHit.timedOut,
    nxdomain:
      cnameHit.records.length === 0 &&
      aHit.records.length === 0 &&
      (cnameHit.nxdomain || aHit.nxdomain),
  }
}

/** Kiểm tra CNAME hostname → mục tiêu platform (vd. nanoai.vn). */
export async function verifyPartnerCustomDomainCname(hostname: string): Promise<PartnerCustomDomainDnsCheck> {
  const evidence = await collectDnsEvidence(hostname)
  const full = evaluatePartnerCustomDomainDns(evidence)
  if (full.ok && full.detail.startsWith('CNAME')) return full
  if (evidence.cnames.some((row) => cnameMatchesTarget(row, evidence.cnameTarget))) {
    return { ok: true, detail: `CNAME → ${evidence.cnames.join(', ')}`, transient: false }
  }
  return {
    ok: false,
    detail:
      evidence.cnames.length > 0
        ? `CNAME hiện tại: ${evidence.cnames.join(', ')} (cần trỏ tới ${normalizeDnsName(evidence.cnameTarget)})`
        : `Không thấy CNAME tới ${normalizeDnsName(evidence.cnameTarget)}`,
    transient: evidence.cnames.length === 0 && evidence.timedOut,
  }
}

/** Apex: A trỏ cùng IP với nanoai.vn (CNAME ở root thường không được phép). */
export async function verifyPartnerCustomDomainApexARecord(
  hostname: string
): Promise<PartnerCustomDomainDnsCheck> {
  const evidence = await collectDnsEvidence(hostname)
  const expected = new Set(evidence.expectedIps)
  const matched = evidence.addrs.filter((ip) => expected.has(ip))
  if (matched.length > 0) {
    return { ok: true, detail: `A → ${unique(matched).join(', ')}`, transient: false }
  }
  if (evidence.addrs.length === 0 && evidence.timedOut) {
    return {
      ok: false,
      detail: 'Không đọc được bản ghi A (timeout).',
      transient: true,
    }
  }
  if (evidence.addrs.length === 0) {
    return { ok: false, detail: 'Không đọc được bản ghi A.', transient: false }
  }
  return {
    ok: false,
    detail: `A hiện tại: ${evidence.addrs.join(', ') || '—'} (cần ${[...expected].join(' hoặc ')})`,
    transient: false,
  }
}

/** CNAME (www / subdomain) hoặc A record cùng IP VPS (apex). */
export async function verifyPartnerCustomDomainDns(
  hostname: string
): Promise<PartnerCustomDomainDnsCheck> {
  const evidence = await collectDnsEvidence(hostname)
  return evaluatePartnerCustomDomainDns(evidence)
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
