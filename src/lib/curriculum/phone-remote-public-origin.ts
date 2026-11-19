import os from 'os'

/** Domain ngrok cố định của máy local (cổng 3000). */
export const LOCAL_PHONE_NGROK_ORIGIN = 'https://amia-canelike-exhibitively.ngrok-free.dev'

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

type NgrokTunnel = {
  public_url?: string
  proto?: string
  config?: { addr?: string }
}

/** Địa chỉ http://IP:3000 của máy này trên Wi‑Fi, để điện thoại cùng mạng quét mã. */
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

/** Đọc URL https mà ngrok đang mở, ưu tiên tunnel trỏ cổng 3000. */
export async function readRunningNgrokOrigin(): Promise<string | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 800)
  try {
    const res = await fetch('http://127.0.0.1:4040/api/tunnels', { signal: ctrl.signal, cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as { tunnels?: NgrokTunnel[] }
    const tunnels = Array.isArray(data.tunnels) ? data.tunnels : []
    const https = tunnels.filter((t) => typeof t.public_url === 'string' && t.public_url.startsWith('https://'))
    const onDevPort = https.find((t) => /:3000\b/.test(String(t.config?.addr || '')))
    const chosen = onDevPort ?? https[0]
    return chosen?.public_url?.replace(/\/$/, '') || null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
