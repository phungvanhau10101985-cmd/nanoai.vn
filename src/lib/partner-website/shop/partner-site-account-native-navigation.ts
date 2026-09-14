/**
 * Parser-blocking native navigation for shop storefronts.
 *
 * Next.js App Router + React hydration intercept same-origin `<a>` clicks for client
 * transitions. The first press is swallowed and chrome (Tài khoản / Giỏ hàng) only
 * "blinks" because the DOM is rewritten between pointerdown and click. Bind on
 * `window` capture from a parser-blocking root `<head>` `<script>` (not `next/script`)
 * and hard-navigate with `location.assign`.
 *
 * Do not navigate on `pointerdown` — that would start navigation when the customer
 * is scrolling a product card on mobile. Navigate on `pointerup` (tap, little
 * movement) so the press still wins when React eats the later `click`. Keep the
 * `<a>` from pointerdown: hydration / badge / wrap can detach `event.target`
 * before pointerup, which would otherwise make closest() miss the link. Keep the
 * `<a>` from pointerdown: hydration / badge / wrap can detach `event.target`
 * before pointerup, which would otherwise make closest() miss the link.
 */
export const PARTNER_SITE_NATIVE_NAV_SCRIPT_ID = 'pw-native-navigation'

const JS_ONLY_CHROME_SEL = [
  '[data-nanoai-open-chat]',
  '[data-nanoai-try-on]',
  '[data-pw-cat-toggle]',
  '[data-pw-el="cat-toggle"]',
  '[data-pw-chrome-btn="categories"]',
  '[data-pw-image-search]',
  '[data-pw-add-cart]',
  '[data-pw-pdp-add-cart]',
  '[data-pw-buy]',
  '[data-pw-favorite]',
  '[data-pw-head-back]',
  '[data-pw-chrome-btn="back"]',
  '[data-pw-chrome-btn="chat"]',
  '[data-pw-chrome-btn="chat-zalo"]',
  '[data-pw-chrome-btn="chat-facebook"]',
  '[data-pw-chrome-btn="chat-instagram"]',
  '[data-pw-chrome-btn="chat-whatsapp"]',
  '[data-pw-chrome-btn="logout"]',
  '[data-pw-account-logout]',
  '[data-pw-slide-prev]',
  '[data-pw-slide-next]',
  '[data-pw-grid-more]',
  '[data-pw-native-nav="off"]',
].join(',')

export function buildPartnerSiteNativeNavigationScript(siteSlug: string): string {
  const slug = siteSlug.trim()
  const prefix = slug ? `/site/${slug}` : ''
  const prefixEnc = slug ? `/site/${encodeURIComponent(slug)}` : ''
  return `(function(){
  if(window.__pwNativeNavBound||window.__pwAccountNativeNavBound||window.__pwVisualNativeNavBound){
    window.__pwNativeNavBound=1;
    window.__pwAccountNativeNavBound=1;
    window.__pwVisualNativeNavBound=1;
    return;
  }
  window.__pwNativeNavBound=1;
  window.__pwAccountNativeNavBound=1;
  window.__pwVisualNativeNavBound=1;
  var PREFIX=${JSON.stringify(prefix)};
  var PREFIX_ENC=${JSON.stringify(prefixEnc)};
  var SKIP=${JSON.stringify(JS_ONLY_CHROME_SEL)};
  var tap=null;
  var lastHref='';
  var lastAt=0;
  function liveLink(node){
    if(!node||typeof node.closest!=='function')return null;
    if(node.closest('input,textarea,select,option,[contenteditable="true"]'))return null;
    return node.closest('a[href]');
  }
  function nodeConnected(node){
    if(!node)return false;
    if(node.isConnected===false)return false;
    if(node.isConnected===true)return true;
    try{
      var doc=node.ownerDocument||window.document;
      if(doc&&typeof doc.contains==='function')return doc.contains(node);
    }catch(_){}
    return true;
  }
  function pointLink(x,y){
    try{
      var doc=window.document;
      if(!doc||typeof doc.elementFromPoint!=='function')return null;
      return liveLink(doc.elementFromPoint(x,y));
    }catch(_){return null;}
  }
  function resolveLink(event,saved){
    var target=event&&event.target;
    var link=null;
    if(nodeConnected(target))link=liveLink(target);
    if(!link&&event)link=pointLink(event.clientX,event.clientY);
    if(!link)link=saved||null;
    return link;
  }
  function pathOnPlatform(path){
    var p=String(path||'');
    if(PREFIX&&(p===PREFIX||p.indexOf(PREFIX+'/')===0))return true;
    if(PREFIX_ENC&&PREFIX_ENC!==PREFIX&&(p===PREFIX_ENC||p.indexOf(PREFIX_ENC+'/')===0))return true;
    if(!PREFIX&&p.indexOf('/site/')===0)return true;
    return false;
  }
  function onPlatform(){
    return pathOnPlatform(window.location.pathname||'');
  }
  function stripPrefix(path){
    var p=String(path||'');
    if(PREFIX&&(p===PREFIX||p.indexOf(PREFIX+'/')===0))return p.slice(PREFIX.length)||'/';
    if(PREFIX_ENC&&PREFIX_ENC!==PREFIX&&(p===PREFIX_ENC||p.indexOf(PREFIX_ENC+'/')===0))return p.slice(PREFIX_ENC.length)||'/';
    var m=p.match(/^\\/site\\/[^/]+/);
    if(m)return p.slice(m[0].length)||'/';
    return p;
  }
  function rewriteHref(raw){
    var url=new URL(raw,window.location.href);
    if(!onPlatform()&&pathOnPlatform(url.pathname)){
      var nextPath=stripPrefix(url.pathname);
      if(url.origin!==window.location.origin)return window.location.origin+nextPath+url.search+url.hash;
      url.pathname=nextPath;
    }
    return url.href;
  }
  function go(event,saved){
    if(event.button!=null&&event.button!==0)return;
    if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    var link=resolveLink(event,saved);
    if(!link||link.hasAttribute('download'))return;
    if(link.closest(SKIP)){
      if(event.type==='click'&&link.closest('[data-pw-chrome-btn="categories"],[data-pw-cat-toggle],[data-pw-el="cat-toggle"]')){
        event.preventDefault();
      }
      return;
    }
    var targetName=String(link.getAttribute('target')||'').toLowerCase();
    if(targetName&&targetName!=='_self'&&targetName!=='_top')return;
    var raw=String(link.getAttribute('href')||'').trim();
    if(!raw||raw.charAt(0)==='#'||/^(?:javascript|mailto|tel|data):/i.test(raw))return;
    var href='';
    try{href=rewriteHref(raw);}catch(_){return;}
    var next=null;
    try{next=new URL(href,window.location.href);}catch(_){return;}
    if(next.pathname.indexOf('/api/')===0)return;
    if(next.origin===window.location.origin&&next.pathname===window.location.pathname&&next.search===window.location.search){
      return;
    }
    var now=Date.now();
    if(lastHref===href&&now-lastAt<800)return;
    lastHref=href;
    lastAt=now;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    window.location.assign(href);
  }
  function onPointerDown(event){
    if(event.button!=null&&event.button!==0)return;
    tap={id:event.pointerId,x:event.clientX||0,y:event.clientY||0,link:liveLink(event.target)};
  }
  function onPointerUp(event){
    if(!tap||(event.pointerId!=null&&event.pointerId!==tap.id))return;
    var dx=(event.clientX||0)-tap.x;
    var dy=(event.clientY||0)-tap.y;
    var saved=tap.link;
    tap=null;
    if(dx*dx+dy*dy>144)return;
    go(event,saved);
  }
  window.addEventListener('pointerdown',onPointerDown,true);
  window.addEventListener('pointerup',onPointerUp,true);
  window.addEventListener('click',go,true);
})();`
}

/** Native first-click navigation for inline custom-domain visual HTML. */
export function buildPartnerSiteVisualNativeNavigationScript(siteSlug: string): string {
  return buildPartnerSiteNativeNavigationScript(siteSlug)
}

/** Backup for account-chrome; prefer the `<head>` copy from the site / root layout. */
export const PARTNER_SITE_ACCOUNT_NATIVE_NAV_SCRIPT = buildPartnerSiteNativeNavigationScript('')
