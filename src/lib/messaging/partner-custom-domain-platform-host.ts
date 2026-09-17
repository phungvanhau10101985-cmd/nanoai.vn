import { getPublicAppUrlForServer } from '@/lib/auth/public-app-url'

const FALLBACK_PLATFORM_HOSTS = new Set(['nanoai.vn', 'www.nanoai.vn', 'localhost', '127.0.0.1'])

export function hostnameFromHostHeader(hostHeader: string): string {
  return hostHeader.split(',')[0]?.trim().split(':')[0]?.toLowerCase() ?? ''
}

/** Hostname thuộc domain nền tảng NanoAI (không phải white-label shop). */
export function isPlatformAppHostname(host: string): boolean {
  const h = hostnameFromHostHeader(host)
  if (!h) return true
  if (FALLBACK_PLATFORM_HOSTS.has(h)) return true
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
