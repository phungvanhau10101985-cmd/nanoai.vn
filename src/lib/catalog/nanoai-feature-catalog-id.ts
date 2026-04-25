export function toNanoAiFeatureCatalogIdFromHref(href: string): string {
  const normalized = String(href || '')
    .trim()
    .replace(/^\/+/, '')
    .replace(/\/+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
  return `feature_${normalized || 'home'}`
}

export function isPathMatchedByFeatureRoute(pathname: string, featureRoute: string): boolean {
  const path = String(pathname || '').trim() || '/'
  const route = String(featureRoute || '').trim()
  if (!route) return false
  return path === route || path.startsWith(`${route}/`)
}
