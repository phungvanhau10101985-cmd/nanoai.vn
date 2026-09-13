const CUSTOM_DOMAIN_PATH_ATTR_RE =
  /(\b(?:href|action|data-pw-account-fallback-href)\s*=\s*)(["'])([^"']*)\2/gi

/** Make saved visual chrome links native custom-domain paths before React hydration. */
export function rewritePartnerSiteCustomDomainHtmlPaths(
  html: string,
  siteSlug: string,
  customDomain: boolean
): string {
  if (!customDomain || !html.trim()) return html
  const prefix = `/site/${siteSlug.trim()}`
  if (prefix === '/site/') return html

  return html.replace(
    CUSTOM_DOMAIN_PATH_ATTR_RE,
    (full, lead: string, quote: string, value: string) => {
      if (value !== prefix && !value.startsWith(`${prefix}/`)) return full
      const next = value.slice(prefix.length) || '/'
      return `${lead}${quote}${next}${quote}`
    }
  )
}
