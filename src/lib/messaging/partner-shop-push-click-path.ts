import {
  mapPartnerInternalPathToPublic,
  partnerSiteHref,
} from '@/lib/messaging/partner-custom-domain-site-path'

function splitPath(raw: string): { pathname: string; search: string; hash: string } {
  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw)
      return { pathname: u.pathname || '/', search: u.search, hash: u.hash }
    } catch {
      return { pathname: '/', search: '', hash: '' }
    }
  }
  const hashIdx = raw.indexOf('#')
  const withoutHash = hashIdx >= 0 ? raw.slice(0, hashIdx) : raw
  const hash = hashIdx >= 0 ? raw.slice(hashIdx) : ''
  const qIdx = withoutHash.indexOf('?')
  const pathname = (qIdx >= 0 ? withoutHash.slice(0, qIdx) : withoutHash) || '/'
  const search = qIdx >= 0 ? withoutHash.slice(qIdx) : ''
  return { pathname: pathname.startsWith('/') ? pathname : `/${pathname}`, search, hash }
}

/** Relative click path for shop Web Push — SW prepends `self.location.origin`. */
export function partnerShopPushClickPath(input: {
  href: string
  siteSlug: string
  customDomain: boolean
}): string {
  const slug = input.siteSlug.trim()
  const fallback = partnerSiteHref(slug, '/account/notifications', input.customDomain)
  const raw = input.href.trim()
  if (!raw) return fallback

  const { pathname, search, hash } = splitPath(raw)
  const suffix = `${search}${hash}`

  if (input.customDomain) {
    const mapped = mapPartnerInternalPathToPublic(slug, pathname)
    return `${mapped || pathname}${suffix}`
  }

  const prefix = `/site/${encodeURIComponent(slug)}`
  if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
    return `${pathname}${suffix}`
  }
  return `${partnerSiteHref(slug, pathname, false)}${suffix}`
}
