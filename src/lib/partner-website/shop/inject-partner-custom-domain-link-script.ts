import { getPublicAppUrlForServer } from '@/lib/auth/public-app-url'
import { partnerSiteInternalPrefix } from '@/lib/messaging/partner-custom-domain-site-path'

const DEFAULT_PLATFORM_HOSTS = ['nanoai.vn', 'www.nanoai.vn'] as const

function collectPlatformHosts(): string[] {
  const hosts = new Set<string>(DEFAULT_PLATFORM_HOSTS)
  try {
    const raw = getPublicAppUrlForServer()
    const u = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
    const host = u.hostname.trim().toLowerCase()
    if (host && host !== 'localhost' && host !== '127.0.0.1') hosts.add(host)
  } catch {
    /* ignore */
  }
  return [...hosts]
}

function stripSitePrefix(pathname: string, prefix: string): string {
  if (pathname === prefix) return '/'
  if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length) || '/'
  return pathname
}

/**
 * Map a shop href onto the custom-domain public path.
 * Strips `/site/{slug}` and any NanoAI origin so clicks stay on the customer host.
 */
export function rewritePartnerCustomDomainPublicHref(
  rawHref: string,
  siteSlug: string,
  platformHosts: readonly string[] = DEFAULT_PLATFORM_HOSTS
): string {
  const href = String(rawHref ?? '').trim()
  if (!href) return rawHref
  const slug = siteSlug.trim()
  if (!slug) return rawHref
  if (/^(mailto|tel|javascript|data):/i.test(href) || href.charAt(0) === '#') return rawHref

  const prefix = partnerSiteInternalPrefix(slug)
  const hostSet = new Set(platformHosts.map((h) => h.trim().toLowerCase()).filter(Boolean))

  const finish = (path: string, search: string, hash: string) => {
    const nextPath = stripSitePrefix(path, prefix)
    return `${nextPath}${search}${hash}` || '/'
  }

  if (href.startsWith('/') && !href.startsWith('//')) {
    try {
      const u = new URL(href, 'https://custom.invalid')
      const next = finish(u.pathname, u.search, u.hash)
      return next === href ? rawHref : next
    } catch {
      return rawHref
    }
  }

  try {
    const parsed = new URL(href.startsWith('//') ? `https:${href}` : href)
    if (!hostSet.has(parsed.hostname.toLowerCase())) return rawHref
    return finish(parsed.pathname, parsed.search, parsed.hash)
  } catch {
    return rawHref
  }
}

function rewriteHtmlAttributeUrls(html: string, siteSlug: string, platformHosts: readonly string[]): string {
  return html.replace(/\b(href|src|action)=("|')([^"']*)\2/gi, (full, attr: string, quote: string, value: string) => {
    const next = rewritePartnerCustomDomainPublicHref(value, siteSlug, platformHosts)
    if (next === value) return full
    return `${attr}=${quote}${next}${quote}`
  })
}

function rewritePlatformBaseTag(html: string, platformHosts: readonly string[]): string {
  const hostSet = new Set(platformHosts.map((h) => h.trim().toLowerCase()).filter(Boolean))
  return html.replace(/<base\b[^>]*>/gi, (tag) => {
    const href = /\bhref\s*=\s*(["'])([^"']*)\1/i.exec(tag)?.[2]?.trim() || ''
    if (!href || (!/^https?:\/\//i.test(href) && !href.startsWith('//'))) return tag
    try {
      const parsed = new URL(href.startsWith('//') ? `https:${href}` : href)
      if (hostSet.has(parsed.hostname.toLowerCase())) return '<base href="/">'
    } catch {
      return tag
    }
    return tag
  })
}

export function rewritePartnerCustomDomainHtml(
  html: string,
  siteSlug: string,
  platformHosts: readonly string[] = collectPlatformHosts()
): string {
  if (!html || !siteSlug.trim()) return html
  return rewriteHtmlAttributeUrls(rewritePlatformBaseTag(html, platformHosts), siteSlug, platformHosts)
}

/** Rewrite /site/{slug}/… and https://nanoai.vn/… anchors to clean paths for custom domain HTML. */
export function injectPartnerCustomDomainLinkRewriteScript(html: string, siteSlug: string): string {
  const slug = siteSlug.trim()
  if (!slug) return html
  const platformHosts = collectPlatformHosts()
  const prepared = rewritePartnerCustomDomainHtml(html, slug, platformHosts)
  const prefix = partnerSiteInternalPrefix(slug)
  const script = `<script data-pw-custom-domain-links>(function(){
var PREFIX=${JSON.stringify(prefix)};
var HOSTS=${JSON.stringify(platformHosts)};
function stripPrefix(path){
  if(path===PREFIX)return '/';
  if(path.indexOf(PREFIX+'/')===0)return path.slice(PREFIX.length)||'/';
  return path;
}
function rewriteHref(raw){
  var h=String(raw||'').trim();
  if(!h)return h;
  if(/^(mailto|tel|javascript|data):/i.test(h)||h.charAt(0)==='#')return h;
  function finish(path,search,hash){return (stripPrefix(path)+(search||'')+(hash||''))||'/';}
  if(h.charAt(0)==='/'&&h.indexOf('//')!==0){
    try{
      var rel=new URL(h,'https://custom.invalid');
      return finish(rel.pathname,rel.search,rel.hash);
    }catch(eRel){return h;}
  }
  try{
    var abs=new URL(h.indexOf('//')===0?('https:'+h):h);
    var host=(abs.hostname||'').toLowerCase();
    var known=false;
    for(var i=0;i<HOSTS.length;i++){if(HOSTS[i]===host){known=true;break;}}
    if(!known)return h;
    return finish(abs.pathname,abs.search,abs.hash);
  }catch(eAbs){return h;}
}
function rewrite(el){
  var h=(el.getAttribute('href')||'').trim();
  if(!h)return;
  var next=rewriteHref(h);
  if(next&&next!==h)el.setAttribute('href',next);
}
document.querySelectorAll('a[href]').forEach(rewrite);
document.addEventListener('click',function(e){
  var a=e.target&&e.target.closest?e.target.closest('a[href]'):null;
  if(!a)return;
  rewrite(a);
  var dest=(a.getAttribute('href')||'').trim();
  if(!dest||dest.charAt(0)==='#'||/^(mailto|tel|javascript|data):/i.test(dest))return;
  var tgt=(a.getAttribute('target')||'').trim();
  if(tgt&&tgt!=='_self')return;
  try{
    if(window.top&&window.top!==window){
      window.top.location.href=a.href;
      e.preventDefault();
    }
  }catch(err){}
},{capture:true});
})();</script>`
  if (/<\/body>/i.test(prepared)) return prepared.replace(/<\/body>/i, `${script}\n</body>`)
  return `${prepared}\n${script}`
}
