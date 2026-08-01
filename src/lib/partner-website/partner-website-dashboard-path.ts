/** Tenant-scoped website admin URL (preferred). */
export function partnerWebsiteDashboardPath(partnerSlug: string): string {
  const slug = partnerSlug.trim()
  if (!slug) return '/dashboard/messaging/website'
  return `/dashboard/messaging/p/${encodeURIComponent(slug)}/website`
}

/** Legacy hub URL with partner UUID query (redirects to slug route when possible). */
export function partnerWebsiteDashboardLegacyPath(partnerId: string): string {
  const id = partnerId.trim()
  if (!id) return '/dashboard/messaging/website'
  return `/dashboard/messaging/website?partner=${encodeURIComponent(id)}`
}
