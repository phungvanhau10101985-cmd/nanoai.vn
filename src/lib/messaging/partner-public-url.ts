/** Pure URL builders — safe for client components (no server/DB imports). */

export function buildPartnerChatPublicUrl(origin: string, partnerSlug: string, embed = false): string {
  const base = origin.replace(/\/$/, '')
  const path = `/messaging/p/${encodeURIComponent(partnerSlug)}`
  return embed ? `${base}${path}?embed=1` : `${base}${path}`
}

export function buildPartnerSitePublicUrl(origin: string, siteSlug: string): string {
  const base = origin.replace(/\/$/, '')
  return `${base}/site/${encodeURIComponent(siteSlug)}`
}
