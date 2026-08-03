import { partnerSiteInternalPrefix } from '@/lib/messaging/partner-custom-domain-site-path'

/** Rewrite /site/{slug}/… anchor hrefs to clean paths for custom domain landing HTML. */
export function injectPartnerCustomDomainLinkRewriteScript(html: string, siteSlug: string): string {
  const slug = siteSlug.trim()
  if (!slug) return html
  const prefix = partnerSiteInternalPrefix(slug)
  const script = `<script data-pw-custom-domain-links>(function(){
var PREFIX=${JSON.stringify(prefix)};
function rewrite(el){
  var h=(el.getAttribute('href')||'').trim();
  if(!h||h.charAt(0)!=='/'||h.indexOf('//')===0)return;
  if(h===PREFIX||h.indexOf(PREFIX+'/')===0){
    el.setAttribute('href',h.slice(PREFIX.length)||'/');
  }
}
document.querySelectorAll('a[href]').forEach(rewrite);
document.addEventListener('click',function(e){
  var a=e.target&&e.target.closest?e.target.closest('a[href]'):null;
  if(!a)return;
  rewrite(a);
},{capture:true});
})();</script>`
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${script}\n</body>`)
  return `${html}\n${script}`
}
