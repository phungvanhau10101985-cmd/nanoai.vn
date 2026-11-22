import { getPublicAppUrlForServer } from '@/lib/auth/public-app-url'

const FALLBACK_PLATFORM_HOSTS = new Set(['nanoai.vn', 'www.nanoai.vn', 'localhost', '127.0.0.1'])

/** Máy local mở bằng IP Wi‑Fi. Điện thoại cùng mạng không phải domain shop. */
function isPrivateLanHostname(hostname: string): boolean {
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true
  return false
}

export function hostnameFromHostHeader(hostHeader: string): string {
  return hostHeader.split(',')[0]?.trim().split(':')[0]?.toLowerCase() ?? ''
}

/** Hostname thuộc domain nền tảng NanoAI (không phải white-label shop). */
export function isPlatformAppHostname(host: string): boolean {
  const h = hostnameFromHostHeader(host)
  if (!h) return true
  if (FALLBACK_PLATFORM_HOSTS.has(h)) return true
  if (isPrivateLanHostname(h)) return true
  if (h.endsWith('.ngrok-free.dev') || h.endsWith('.ngrok.io') || h.endsWith('.ngrok.app')) return true
  if (h.endsWith('.trycloudflare.com')) return true
  if (h.endsWith('.localhost')) return true
  try {
    const platform = getPublicAppUrlForServer()
    const u = new URL(platform.startsWith('http') ? platform : `https://${platform}`)
    if (h === u.hostname.toLowerCase()) return true
  } catch {
    /* ignore */
  }
  return false
}

/**
 * Shop custom domain (gudo.vn, …). Middleware skips `api/`, so push subscribe
 * must read Host / X-Forwarded-Host instead of PARTNER_CUSTOM_DOMAIN_HEADER.
 */
export function isShopCustomDomainHost(hostHeader: string): boolean {
  const hostname = hostnameFromHostHeader(hostHeader)
  if (!hostname) return false
  return !isPlatformAppHostname(hostname)
}
