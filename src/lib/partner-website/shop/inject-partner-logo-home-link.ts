export const PARTNER_LOGO_HOME_LINK_SCRIPT_ID = 'pw-logo-home-link'

function shopHomeHref(siteSlug: string, customDomain?: boolean): string {
  const slug = siteSlug.trim()
  if (!slug) return '/'
  return customDomain ? '/' : `/site/${encodeURIComponent(slug)}`
}

/** Logo không nằm trong <a> (hoặc href rỗng/#) → về trang chủ. */
export function injectPartnerLogoHomeLinkScript(
  html: string,
  siteSlug: string,
  customDomain?: boolean
): string {
  const slug = siteSlug.trim()
  const trimmed = html.trim()
  if (!slug || !trimmed) return html
  const home = shopHomeHref(slug, customDomain)
  const script = `<script id="${PARTNER_LOGO_HOME_LINK_SCRIPT_ID}">(function(){
var HOME=${JSON.stringify(home)};
var SEL='img.pw-logo,img.pw-shop-logo,img.pw-shop-footer-logo,img.site-logo,[data-pw-logo-added]';
function isEmptyHref(h){h=String(h||'').trim();return !h||h==='#'||h.toLowerCase().indexOf('javascript:')===0}
function wrap(img){
  if(!img||img.nodeType!==1)return;
  var a=img.closest?img.closest('a'):null;
  if(a){
    if(isEmptyHref(a.getAttribute('href')))a.setAttribute('href',HOME);
    return;
  }
  var link=document.createElement('a');
  link.className='pw-brand';
  link.setAttribute('href',HOME);
  link.setAttribute('data-pw-logo-home','1');
  link.style.display='contents';
  if(!img.parentNode)return;
  img.parentNode.insertBefore(link,img);
  link.appendChild(img);
}
function run(){document.querySelectorAll(SEL).forEach(wrap)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);
else run();
})();</script>`
  if (trimmed.includes(PARTNER_LOGO_HOME_LINK_SCRIPT_ID)) {
    return trimmed.replace(
      new RegExp(`<script id="${PARTNER_LOGO_HOME_LINK_SCRIPT_ID}">[\\s\\S]*?<\\/script>`, 'i'),
      script
    )
  }
  if (/<\/body>/i.test(trimmed)) return trimmed.replace(/<\/body>/i, `${script}\n</body>`)
  return `${trimmed}\n${script}`
}
