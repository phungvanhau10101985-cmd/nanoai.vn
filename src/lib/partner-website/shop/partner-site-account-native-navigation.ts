/**
 * React may hold the first click while an account route is still selectively hydrating.
 * Account links intentionally use a native page navigation so the first click cannot be lost.
 */
export const PARTNER_SITE_ACCOUNT_NATIVE_NAV_SCRIPT = String.raw`
(function(){
  if(window.__pwAccountNativeNavBound)return;
  window.__pwAccountNativeNavBound=1;
  window.addEventListener('click',function(event){
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    var target=event.target;
    if(!target||typeof target.closest!=='function')return;
    var link=target.closest('a[href]');
    if(!link||link.hasAttribute('download'))return;
    var targetName=(link.getAttribute('target')||'').toLowerCase();
    if(targetName&&targetName!=='_self')return;
    var raw=(link.getAttribute('href')||'').trim();
    if(!raw||raw.charAt(0)==='#'||/^(?:javascript|mailto|tel):/i.test(raw))return;
    var href='';
    try{href=new URL(raw,window.location.href).href;}catch(_){return;}
    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.assign(href);
  },true);
})();`

/** Native first-click navigation for inline custom-domain visual HTML. */
export function buildPartnerSiteVisualNativeNavigationScript(siteSlug: string): string {
  const prefix = `/site/${siteSlug.trim()}`
  return String.raw`
(function(){
  if(window.__pwVisualNativeNavBound)return;
  window.__pwVisualNativeNavBound=1;
  var PREFIX=${JSON.stringify(prefix)};
  var ON_PLATFORM=window.location.pathname===PREFIX||window.location.pathname.indexOf(PREFIX+'/')===0;
  window.addEventListener('click',function(event){
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    var target=event.target;
    if(!target||typeof target.closest!=='function')return;
    var link=target.closest('a[href]');
    if(!link||link.hasAttribute('download'))return;
    var targetName=(link.getAttribute('target')||'').toLowerCase();
    if(targetName&&targetName!=='_self')return;
    var raw=(link.getAttribute('href')||'').trim();
    if(!raw||raw.charAt(0)==='#'||/^(?:javascript|mailto|tel):/i.test(raw))return;
    var href='';
    try{
      var url=new URL(raw,window.location.href);
      if(!ON_PLATFORM&&url.origin===window.location.origin&&(url.pathname===PREFIX||url.pathname.indexOf(PREFIX+'/')===0)){
        url.pathname=url.pathname.slice(PREFIX.length)||'/';
      }
      href=url.href;
    }catch(_){return;}
    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.assign(href);
  },true);
})();`
}
