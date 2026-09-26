import { partnerCustomDomainPublicOrigin } from '@/lib/messaging/partner-custom-domain-hostname'
import { hostnameFromHostHeader, isPlatformAppHostname } from '@/lib/messaging/partner-custom-domain-platform-host'

/**
 * Host + sitemap origin for robots.txt.
 * Custom domain uses the shop host. `/robots.txt` is not rewritten into `/site/{slug}`,
 * so the shop host may only be on `Host` / `X-Forwarded-Host`, not the custom-domain header.
 */
export function resolveRobotsPublicOrigin(input: {
  customDomainHost?: string | null
  requestHost?: string | null
  platformOrigin: string
}): string {
  for (const raw of [input.customDomainHost, input.requestHost]) {
    const host = hostnameFromHostHeader(String(raw || ''))
    if (!host || isPlatformAppHostname(host)) continue
    return partnerCustomDomainPublicOrigin(host)
  }
  return String(input.platformOrigin || '').replace(/\/$/, '')
}
