import os from 'os'

/** Link mở ô chia sẻ Zalo với địa chỉ điều khiển điện thoại. */
export function phoneRemoteZaloShareUrl(pageUrl: string): string {
  return `https://zalo.me/share?url=${encodeURIComponent(pageUrl)}`
}

/** Link mở ô chia sẻ Facebook; trên điện thoại có Messenger thì gửi vào chat. */
export function phoneRemoteFacebookShareUrl(pageUrl: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`
}

/** Mở app Messenger trên điện thoại để gửi link. */
export function phoneRemoteMessengerAppShareUrl(pageUrl: string): string {
  return `fb-messenger://share/?link=${encodeURIComponent(pageUrl)}`
}

export function isPhoneRemoteShareMobile(userAgent: string): boolean {
  return /Android|iPhone|iPad|iPod/i.test(userAgent)
}

/** Chuỗi đúng một URL để camera Android và iOS nhận ra link. */
export function phoneRemoteQrPayload(loginUrl: string): string | null {
  const raw = loginUrl.trim()
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return url.href
  } catch {
    return null
  }
}

/** Origin mà trình duyệt điện thoại phải mở. Localhost thì bỏ. IP Wi‑Fi thì giữ để điện thoại cùng mạng vào thẳng. */
export function phoneRemoteBrowserOrigin(input: {
  forwardedHost?: string | null
  host?: string | null
  forwardedProto?: string | null
}): string | null {
  const rawHost = (input.forwardedHost || input.host || '').split(',')[0]?.trim() || ''
  const hostname = rawHost.replace(/^\[|\]$/g, '').split(':')[0]?.trim().toLowerCase() || ''
  if (!hostname) return null
  if (isPublicTunnelHost(hostname)) return `https://${hostname}`
  const proto = (input.forwardedProto || '').split(',')[0]?.trim().toLowerCase()
  if (isPrivateLanHost(hostname)) {
    const scheme = proto === 'https' ? 'https' : 'http'
    return `${scheme}://${rawHost}`
  }
  if (isLocalDevHost(hostname)) return null
  const scheme = proto === 'http' ? 'http' : 'https'
  return `${scheme}://${rawHost}`
}

export function isPrivateLanHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '')
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host)) return true
  return false
}

/** Ưu tiên Wi‑Fi 192.168, rồi các IP mạng riêng khác. Bỏ localhost. */
export function pickLanIpv4(addresses: string[]): string | null {
  const lan = addresses.map((item) => item.trim()).filter(isPrivateLanHost)
  return lan.find((item) => item.startsWith('192.168.')) ?? lan[0] ?? null
}

export function lanDevOriginFromIp(ip: string, port = 3000): string | null {
  if (!isPrivateLanHost(ip)) return null
  const safePort = Number.isInteger(port) && port > 0 && port < 65536 ? port : 3000
  return `http://${ip}:${safePort}`
}

export function isLocalDevHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1') return true
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host)) return true
  return false
}

export function isPublicTunnelHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '')
  return (
    host.endsWith('.trycloudflare.com')
    || host.endsWith('.ngrok-free.dev')
    || host.endsWith('.ngrok.io')
    || host.endsWith('.ngrok.app')
    || host.endsWith('.ngrok.dev')
  )
}

/** Tunnel Cloudflare chỉ mở https cổng 443. Cổng 3000 của máy dev làm link học sinh hết giờ. */
export function phonePublicHref(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  try {
    const url = new URL(trimmed)
    if (!isPublicTunnelHost(url.hostname)) return trimmed
    url.protocol = 'https:'
    url.port = ''
    const path = `${url.pathname}${url.search}${url.hash}`
    if (!path || path === '/') return url.origin
    return `${url.origin}${url.pathname}${url.search}${url.hash}`
  } catch {
    return trimmed
  }
}

/** Địa chỉ http://IP:3000 của máy này trên Wi‑Fi. Mã quét điện thoại local không dùng địa chỉ này. */
export function readLanDevOrigin(port = 3000): string | null {
  const addresses: string[] = []
  const nets = os.networkInterfaces()
  for (const list of Object.values(nets)) {
    for (const net of list ?? []) {
      const family = String(net.family)
      if (net.internal || (family !== 'IPv4' && family !== '4')) continue
      addresses.push(net.address)
    }
  }
  const ip = pickLanIpv4(addresses)
  return ip ? lanDevOriginFromIp(ip, port) : null
}

async function httpsOriginServesApp(origin: string): Promise<boolean> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 4000)
  try {
    const res = await fetch(`${origin.replace(/\/$/, '')}/`, {
      method: 'GET',
      redirect: 'manual',
      signal: ctrl.signal,
      headers: { 'ngrok-skip-browser-warning': '1' },
    })
    if (res.status >= 400) {
      const text = (await res.text()).slice(0, 800)
      if (text.includes('ERR_NGROK')) return false
      return false
    }
    return true
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

/** HTTPS đang mở và tải được trang. Local chỉ nhận tunnel Cloudflare. */
export async function readWorkingHttpsOrigin(extra: Array<string | null | undefined> = []): Promise<string | null> {
  const cloudflare = await readRunningCloudflareOrigin()
  const candidates = [...extra, cloudflare].filter((item): item is string => Boolean(item))
  const seen = new Set<string>()
  for (const origin of candidates) {
    if (seen.has(origin)) continue
    seen.add(origin)
    if (await httpsOriginServesApp(origin)) return origin
  }
  return null
}

const CLOUDFLARED_METRICS_URL = 'http://127.0.0.1:20241/metrics'

/** Lấy hostname HTTPS mà cloudflared đang phục vụ, từ metric local. */
export function cloudflareOriginFromMetrics(text: string): string | null {
  const matches = text.matchAll(/userHostname="([^"]+)"/g)
  const origins: string[] = []
  for (const match of matches) {
    const raw = String(match[1] ?? '').trim()
    if (!raw) continue
    const withScheme = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`
    try {
      const url = new URL(withScheme)
      if (url.protocol === 'https:' || url.protocol === 'http:') origins.push(url.origin)
    } catch {
      /* nhãn metric không phải URL */
    }
  }
  const found = origins.find((item) => item.startsWith('https://')) ?? origins[0] ?? null
  return found ? phonePublicHref(found) : null
}

/** URL công khai của quick tunnel Cloudflare đang mở trên máy này. */
export async function readRunningCloudflareOrigin(): Promise<string | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 800)
  try {
    const res = await fetch(CLOUDFLARED_METRICS_URL, { signal: ctrl.signal, cache: 'no-store' })
    if (!res.ok) return null
    return cloudflareOriginFromMetrics(await res.text())
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** QR test local chỉ dùng tunnel Cloudflare đang chạy. */
export async function readLocalPhonePublicOrigin(): Promise<string> {
  return (await readRunningCloudflareOrigin()) || (await readRunningCloudflareOrigin()) || ''
}
