import { promises as dns } from 'dns'
import { getPartnerCustomDomainCnameTarget } from '@/lib/messaging/partner-custom-domain-hostname'

function normalizeDnsName(value: string): string {
  return value.trim().toLowerCase().replace(/\.$/, '')
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
