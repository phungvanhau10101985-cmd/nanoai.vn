import { getPublicAppUrlForServer } from '@/lib/auth/public-app-url'

const FALLBACK_PLATFORM_HOSTS = new Set(['nanoai.vn', 'www.nanoai.vn', 'localhost', '127.0.0.1'])

/** Hostname thuộc domain nền tảng NanoAI (không phải white-label shop). */
export function isPlatformAppHostname(host: string): boolean {
  const h = host.trim().toLowerCase().split(':')[0]
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
